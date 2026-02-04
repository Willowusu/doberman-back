const response = require('../services/response');
const Event = require('../models/event');
const Decision = require('../models/decision');
const Customer = require('../models/customer');
const ipCheck = require('../services/ipCheck');
const emailCheck = require('../services/emailCheck');
const phonenumberCheck = require('../services/phonenumberCheck');
const eventDecisionService = require('../services/eventDecision');
const eventMetricsService = require('../services/eventMetricsService');
const alertService = require('../services/alertService');
const caseService = require('../services/caseService');   // JUNI Case Management
const { checkSanctions } = require('../services/sanctionsCheck');
const { searchPepList } = require('../services/pepService');


const { logAction } = require('../middlewares');



exports.createEvent = async (req, res) => {
    try {
       
        const { actionType, payload } = req.body;
        payload.domain = req.domain || 'PSP'; // Set domain from session or default
        const externalId = payload?.merchantId;
        const business = req.businessId;

        // 1. Mandatory Check: Does this customer exist?
        const customer = await Customer.findOne({ business, externalId });


        if (!customer) {
            console.warn(`Event received for unregistered customer: ${externalId}`);
        }

        // 2. Conditional Enrichment & Sanctions Check
        let ipDetails = {}, emailDetails = {}, phoneDetails = {}, sanctionsDetails = {};

        const isRemittance = payload?.transactionType?.toLowerCase() === 'remittance';

        if (isRemittance) {
            // Parallel Sanctions Check for Remittance
            const [senderHit, recipientHit] = await Promise.all([
                checkSanctions(payload?.senderName),
                checkSanctions(payload?.recipientName)
            ]);

            sanctionsDetails = {
                sender: senderHit,
                recipient: recipientHit,
                anyMatch: (senderHit?.found || recipientHit?.found) || false
            };
            
            // Parallel Sanctions Check for Remittance
            const [senderPepHit, recipientPepHit] = await Promise.all([
                searchPepList(payload?.senderName),
                searchPepList(payload?.recipientName)
            ]);

            pepScreeningDetails = {
                sender: senderPepHit,
                recipient: recipientPepHit,
                anyMatch: (senderPepHit?.found || recipientPepHit?.found) || false
            };


        } else {
            // Standard Enrichment for non-remittance
            [ipDetails, emailDetails, phoneDetails] = await Promise.all([
                ipCheck.ipDetails(ip || payload?.ip),
                emailCheck.emailDetails(payload?.customerEmail || payload?.userEmail),
                phonenumberCheck.phonenumberDetails(payload?.phoneNumber || payload?.phone)
            ]);
        }

        // 3. Save the Raw Event
        const newEvent = new Event({
            business,
            domain: req.domain || 'PAYMENTS',
            actionType: actionType?.toUpperCase(),
            payload,
            ipAddress: payload?.ip || null,
            deviceId: payload?.deviceId || null,
            enrichedData: { ipDetails, emailDetails, phoneDetails, sanctionsDetails, pepScreeningDetails }
        });
        const savedEvent = await newEvent.save();

        // 4. PROCESS DECISION & ALERTS (ONLY if customer exists)
        let decisionResult = { score: 0, actions: [], triggeredRules: [] };

        if (customer) {
            // A. Trigger your CUSTOM Tripwires (Original Alert System)
            // This handles your SIMPLE/AGGREGATE logic and Slack/Email settings
            await alertService.processCustomerAlerts(savedEvent, customer._id);

            // B. Prepare Data for Global JUNI AML Decision
            const [metrics, identityInfo] = await Promise.all([
                eventMetricsService.getMetricsSnapshot(customer, savedEvent),
                eventMetricsService.checkSharedIdentity(customer, savedEvent.payload)
            ]);

            const dataPool = {
                payload: savedEvent.payload,
                customer: customer, // The MTO (Juni Holdings Inc)
                enrichedData: savedEvent.enrichedData,
                metrics: metrics,   // MTO-level metrics (Total daily volume, etc.)

                // Technical Metadata
                ipAddress: savedEvent.ipAddress || null,
                deviceId: savedEvent.deviceId || null,

                // Actor Context (Crucial for Remittance)
                actors: {
                    senderName: savedEvent.payload?.senderName || null,
                    recipientName: savedEvent.payload?.recipientName || null,
                    senderCountry: savedEvent.payload?.senderCountry || null,
                    // We use these for "One-to-Many" or "Sanctions" rules
                },

                user: {
                    // For standard payments, this is the customer. 
                    // For Remittance, we treat the Sender as the primary user entity.
                    userEmail: savedEvent.payload?.customerEmail || savedEvent.payload?.senderEmail || null,
                    userPhone: savedEvent.payload?.phoneNumber || savedEvent.payload?.phone || null,
                },

                internal: {
                    identityInfo: identityInfo, // Shared identity between MTO directors and transaction parties
                    listHits: [],
                    isRemittance: savedEvent.payload?.transactionType?.toLowerCase() === 'remittance'
                }
            };

            // C. Run Global Decision Engine
            decisionResult = await eventDecisionService.runEventDecision(savedEvent, dataPool);


            // D. Create JUNI AML Case (Case Management System)
            // This logs the hits for the 13 JUNI rules into the Dashboard Feed
            await caseService.createCaseFromDecision(savedEvent, customer._id, decisionResult);

        } else {
            // Default decision for unregistered entities
            decisionResult.score = 100;
            decisionResult.reason = "Unregistered entity attempted transaction";
        }

        // 5. Update Customer Behavioral Metrics
        if (customer) {
            const amount = Number(payload?.transactionAmount || payload?.amount || 0);
            const txType = payload?.transactionType?.toLowerCase();

            const inboundTypes = ['collection', 'collections', 'topup'];
            const outboundTypes = ['transfer', 'payout', 'remittance', 'withdrawal', 'disbursements'];

            customer.totalTransactions += 1;
            customer.lastSeen = new Date();

            if (inboundTypes.includes(txType)) {
                customer.totalInboundVolume += amount;
            } else if (outboundTypes.includes(txType)) {
                customer.totalOutboundVolume += amount;
            }

            // 6. Update Customer Risk Scoring
            if (decisionResult.score > 75) {
                customer.totalFlags += 1;
            }

            // Update Dynamic Behavioral Score
            const count = customer.totalTransactions;
            customer.dynamicRiskScore = ((customer.dynamicRiskScore * (count - 1)) + decisionResult.score) / count;

            // Final Risk Level (The higher of Matrix Baseline vs. Live Behavior)
            const effectiveScore = Math.max(customer.onboardingRiskScore || 0, customer.dynamicRiskScore);

            if (effectiveScore > 60) customer.riskLevel = 'HIGH';
            else if (effectiveScore > 50) customer.riskLevel = 'MEDIUM-HIGH';
            else if (effectiveScore > 40) customer.riskLevel = 'MEDIUM';
            else customer.riskLevel = 'LOW';

            await customer.save();
        }

        // 7. Final Response
        res.status(201).json(response(201, {
            event: savedEvent,
            decision: decisionResult,
            unregistered: !customer
        }, 'Event processed and assessed'));

    } catch (error) {
        console.error('Error in createEvent:', error);
        res.status(500).json(response(500, null, 'Internal Server Error'));
    }
};

//this gets the events and the decisions attached to the events
exports.getEvents = async (req, res) => {
    try {
        const businessId = req.session.businessId;

        if (!businessId) {
            return res.json(response(401, null, "Unauthorized: No business context found"));
        }

        // Query only for documents matching this specific business
        const events = await Decision.find({ business: businessId }).populate('eventId')
            .sort({ createdAt: -1 })
            .limit(50);

        // LOG: Data Access
        // It is important to know who viewed the master event list for audit compliance.
        await logAction(req, 'VIEW_EVENT_LOGS', 'Event Monitoring', {
            resultsCount: events.length
        });

        res.json(response(200, events, "Events retrieved successfully"));
    } catch (error) {
        res.json(response(500, null, "Error fetching events"));
    }
};
