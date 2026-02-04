const jsonLogic = require('json-logic-js');
const Rule = require('../models/rule');
const Decision = require('../models/decision');
const Business = require('../models/business');
const moment = require('moment');

// --- CUSTOM OPERATORS FOR JUNI AML ---
// In services/eventDecisionService.js
jsonLogic.add_operation("contains_any", (str, keywords) => {
    if (!str || !keywords) return false;
    const lowerStr = str.toLowerCase();
    return keywords.some(keyword => lowerStr.includes(keyword.toLowerCase()));
});

// Logic for AML-118: diff_days
jsonLogic.add_operation("diff_days", (date1, date2) => {
    const d1 = moment(date1);
    const d2 = date2 === "now" ? moment() : moment(date2);
    return Math.abs(d1.diff(d2, 'days'));
});

// Logic for AML-119: diff_months
jsonLogic.add_operation("diff_months", (date1, date2) => {
    const d1 = moment(date1);
    const d2 = date2 === "now" ? moment() : moment(date2);
    return Math.abs(d1.diff(d2, 'months'));
});

// 2. Check if a value exists in our List Hits (Blacklists)
jsonLogic.add_operation("in_list", (value, listType, listHits) => {
    return listHits.some(hit => hit.value === value && hit.listType === listType);
});

exports.runEventDecision = async (event, dataPoolOverride = null) => {
    const startTime = Date.now();
    let totalScore = 0;
    let triggeredRules = [];

    // 1. Parallel Fetch
    const [businessData, activeRules] = await Promise.all([
        Business.findById(event.business).select('thresholds'),
        Rule.find({ business: event.business, isActive: true })
    ]);

    /**
     * 2. Prepare Data Pool
     * We use the dataPoolOverride if passed from the controller (which contains metrics),
     * otherwise we fallback to a basic pool.
     */
    const dataPool = dataPoolOverride || {
        payload: event.payload,
        enrichedData: event.enrichedData,
        ipAddress: event.ipAddress,
        deviceId: event.deviceId,
        metrics: {}, // Empty fallback
        internal: { listHits: [] }
    };

    // 3. Logic Evaluation Loop
    for (const rule of activeRules) {
        try {
            // JsonLogic handles the deep nesting (e.g., metrics.currentDayVolume) automatically
            const isMatch = jsonLogic.apply(rule.logic, dataPool);

            if (isMatch) {
                totalScore += rule.score;
                triggeredRules.push({
                    ruleId: rule._id,
                    name: rule.name,
                    scoreAdded: rule.score,
                    action: rule.action
                });
            }
        } catch (err) {
            console.error(`Rule [${rule.name}] logic error:`, err);
        }
    }

    // 4. Threshold & Final Status
    let finalStatus = 'APPROVE';
    const thresholds = businessData?.thresholds || { decline: 80, review: 30 };

    if (totalScore >= thresholds.decline) finalStatus = 'DECLINE';
    else if (totalScore >= thresholds.review) finalStatus = 'REVIEW';

    // 5. Save Decision
    const decision = new Decision({
        business: event.business,
        eventId: event._id,
        score: totalScore,
        status: finalStatus,
        triggeredRules: triggeredRules,
        processingTimeMs: Date.now() - startTime
    });

    return await decision.save();
};