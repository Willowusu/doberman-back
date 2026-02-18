const response = require('../services/response');
const Rule = require('../models/rule');
const Event = require('../models/event');
const Decision = require('../models/decision');
const { logAction } = require('../middlewares');
const jsonLogic = require('json-logic-js');



exports.createRule = async (req, res) => {
    try {
        // We now include 'domain' and 'logic' (sent as 'logic' from frontend)
        const { name, description, domain, logic, action, priority, score } = req.body;
        const business = req.session.businessId;

        if (!business) {
            return res.status(401).json(response(401, null, 'Unauthorized'));
        }

        const newRule = new Rule({
            business,
            name,
            description,
            domain: domain || 'ALL',
            logic, // This is the JSONLogic object
            action: action?.toUpperCase(), // Standardize to uppercase
            priority,
            score: Number(score),
            isActive: true
        });

        await newRule.save();

        // --- AUDIT LOG ENTRY ---
        await logAction(req, 'CREATE_RULE', 'Risk Engine', {
            ruleName: name,
            scoreImpact: score,
            actionTrigger: action
        });

        res.status(201).json(response(201, newRule, 'Rule deployed successfully'));
    } catch (error) {
        console.error('Error creating rule:', error);
        res.status(500).json(response(500, null, 'Internal Server Error'));
    }
};

exports.getRules = async (req, res) => {
    try {
        const businessId = req.session.businessId;

        if (!businessId) {
            return res.json(response(401, null, "Unauthorized: No business context found"));
        }

        // Query only for documents matching this specific business
        const rules = await Rule.find({ business: businessId })
            .sort({ createdAt: -1 })
            .limit(50);

       

        res.json(response(200, rules, "Rules retrieved successfully"));
    } catch (error) {
        console.error('Error fetching rules:', error);
        res.json(response(500, null, "Error fetching rules"));
    }
};

exports.getRule = async (req, res) => {
    try {
        const businessId = req.session.businessId;
        const ruleId = req.params.id;

        if (!businessId) {
            return res.json(response(401, null, "Unauthorized: No business context found"));
        }

        // Query only for documents matching this specific business
        const rule = await Rule.findOne({ business: businessId, _id: ruleId })

        

        res.json(response(200, rule, "Rules retrieved successfully"));
    } catch (error) {
        res.json(response(500, null, "Error fetching rules"));
    }
};

exports.updateRule = async (req, res) => {
    try {
        // 1. Extract the new standardized fields
        const { name, description, domain, logic, action, priority, score } = req.body;
        const business = req.session.businessId;
        const ruleId = req.params.id;

        // 2. Perform the update
        // We ensure we match by BOTH _id and business for multi-tenant security
        const updatedRule = await Rule.findOneAndUpdate(
            { business, _id: ruleId },
            {
                name,
                description,
                domain: domain || 'ALL',
                logic, // Updated from logicJson
                action: action?.toUpperCase(), // Ensure uppercase consistency
                priority,
                score
            },
            { new: true, runValidators: true }
        );

        if (!updatedRule) {
            return res.status(404).json(response(404, null, 'Rule not found or unauthorized'));
        }

        // --- AUDIT LOG ENTRY ---
        await logAction(req, 'UPDATE_RULE', 'Risk Engine', {
            ruleName: updatedRule?.name,
            ruleId: ruleId
        });

        // 3. Send success response
        res.json(response(200, updatedRule, 'Rule updated successfully'));
    } catch (error) {
        console.error('Error updating rule:', error);
        res.status(500).json(response(500, null, 'Internal Server Error'));
    }
};

exports.deleteRule = async (req, res) => {
    try {
        // Extract rule data from request body

        const business = req.session.businessId;
        const ruleId = req.params.id;

        // Example Backend Check
        const ruleUsed = await Decision.findOne({ "triggeredRules.ruleId": ruleId });

        if (ruleUsed) {
            return res.json(400, null,
                "This rule cannot be deleted because it has been used in past decisions. Please archive it instead."
            );
        }
        // Proceed with delete only if it was never triggered

        const deletedRule = await Rule.findOneAndDelete(
            { business, _id: ruleId },
        );

        // --- AUDIT LOG ENTRY ---
        await logAction(req, 'DELETE_RULE', 'Risk Engine', {
            ruleName: deletedRule?.name,
            ruleId: ruleId
        });
        

        // Send success response
        res.json(response(201, deletedRule, 'Rule deleted successfully'));
    } catch (error) {
        console.error('Error deleting rule:', error);
        res.json(response(500, null, 'Internal Server Error'));
    }
}

exports.toggleRuleStatus = async (req, res) => {
    try {
        // Extract rule data from request body

        const { isActive } = req.body;
        const business = req.session.businessId;
        const ruleId = req.params.id;

       
        const updatedRuleStatus = await Rule.findOneAndUpdate(
            { business, _id: ruleId },
            {isActive},
        );
        // --- AUDIT LOG ENTRY ---
        // Disabling a rule is often safer than deleting it, but still high-impact.
        await logAction(req, 'TOGGLE_RULE', 'Risk Engine', {
            ruleName: updatedRuleStatus.name,
            newStatus: isActive ? 'ENABLED' : 'DISABLED'
        });
        // Send success response
        res.json(response(201, updatedRuleStatus, 'Rule status updated successfully'));
    } catch (error) {
        console.error('Error updating rule status:', error);
        res.json(response(500, null, 'Internal Server Error'));
    }
}

exports.testRuleLogic = async (req, res) => {
    try {
        const { logic } = req.body;
        const business = req.session.businessId;

        // 1. Fetch the last 50-100 real events for this business
        const sampleEvents = await Event.find({ business })
            .sort({ createdAt: -1 })
            .limit(50);

        // 2. Run the draft logic against each event
        const results = sampleEvents.map(event => {
            // Prepare the data object exactly how the engine sees it
            const data = {
                ...event.payload,
                domain: event.domain,
                ipAddress: event.ipAddress,
                enrichedData: event.enrichedData,
                metrics: {}, // You could optionally fetch real metrics here
            };

            const isHit = jsonLogic.apply(logic, data);

            return {
                eventId: event._id,
                action_type: event.action_type,
                amount: event.payload?.amount || 0,
                isHit
            };
        });

        const totalHits = results.filter(r => r.isHit).length;

        res.json(response(200, {
            totalChecked: results.length,
            totalHits,
            hitRate: `${((totalHits / results.length) * 100).toFixed(1)}%`,
            sampleHits: results.filter(r => r.isHit).slice(0, 5)
        }, "Test completed"));

    } catch (error) {
        console.error('Test Rule Error:', error);
        res.status(500).json(response(500, null, 'Error testing rule logic'));
    }
};