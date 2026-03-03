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
const mongoose = require('mongoose');


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
        res.json(response(201, {
            event: savedEvent,
            decision: decisionResult,
            unregistered: !customer
        }, 'Event processed and assessed'));

    } catch (error) {
        console.error('Error in createEvent:', error);
        res.json(response(500, null, 'Internal Server Error'));
    }
};



exports.getEvents = async (req, res) => {
    try {
        const { page = 1, limit = 15, search, status, startDate, endDate } = req.body.params;
        const businessId = new mongoose.Types.ObjectId(req.businessId || req.session.businessId);


        // 1. Initialize an array for mandatory conditions
        let criteria = [{ business: businessId }];

        // 2. Status Filter - Ensure it's exactly what's in the DB (APPROVE, REVIEW, DECLINE)
        if (status && status !== 'ALL') {
            criteria.push({ status: status.toUpperCase() });
        }

        // 3. Date Range
        if (startDate || endDate) {
            let dateQuery = {};
            if (startDate) dateQuery.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateQuery.$lte = end;
            }
            criteria.push({ createdAt: dateQuery });
        }

        // 4. Search Logic - Wrapped in its own OR but kept inside the AND criteria
        if (search && search.trim() !== '') {
            const searchRegex = new RegExp(search, 'i');
            criteria.push({
                $or: [
                    { "triggeredRules.name": searchRegex },
                    { "manualOverrides.reason": searchRegex },
                    { "status": searchRegex } // Optional: allow searching by status name too
                ]
            });
        }

        // Combine everything into a single query object
        const finalQuery = { $and: criteria };

        const skip = (parseInt(page) - 1) * parseInt(limit);


        const [docs, total] = await Promise.all([
            Decision.find(finalQuery)
                .populate('eventId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Decision.countDocuments(finalQuery)
        ]);

        res.json({
            status: 200,
            data: {
                docs,
                total,
                page: parseInt(page),
                hasMore: total > skip + docs.length
            }
        });
    } catch (error) {
        console.error("GetEvents Error:", error);
        res.json({ status: 500, message: "Internal Server Error" });
    }
};


exports.getEventTransactionsByType = async (req, res) => {
    try {
        const { type } = req.params;
        const { page = 1, limit = 15, search, status, startDate, endDate } = req.query;
        const businessId = new mongoose.Types.ObjectId(req.businessId || req.session.businessId);

        // 1. Map URL param to DB constant
        const typeMap = {
            'collections': 'collection',
            'remittance': 'remittance',
            'payout': 'payout',
            'topup': 'top-up',
            'transfer': 'transfer'
        };

        // 2. Build Criteria
        let criteria = [
            { business: businessId }
        ];

        // 3. Status Filter
        if (status && status !== 'ALL') {
            criteria.push({ status: status.toUpperCase() });
        }

        // 4. Date Range
        if (startDate || endDate) {
            let dateQuery = {};
            if (startDate) dateQuery.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateQuery.$lte = end;
            }
            criteria.push({ createdAt: dateQuery });
        }

        const finalQuery = { $and: criteria };

        // 5. Populate and Filter by Transaction Type
        // Since transactionType is inside eventId.payload, we filter in the populate match
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [docs, total] = await Promise.all([
            Decision.find(finalQuery)
                .populate({
                    path: 'eventId',
                    match: { 'payload.transactionType': typeMap[type.toLowerCase()] }
                })
                .sort({ createdAt: -1 })
                .lean(),
            Decision.countDocuments(finalQuery)
        ]);

        // Filter out decisions where the event didn't match the type
        const filteredDocs = docs.filter(d => d.eventId !== null);
        const paginatedDocs = filteredDocs.slice(skip, skip + parseInt(limit));

        res.json({
            status: 200,
            data: {
                docs: paginatedDocs,
                total: filteredDocs.length,
                page: parseInt(page),
                hasMore: filteredDocs.length > skip + paginatedDocs.length
            }
        });
    } catch (error) {
        res.json({ message: "Error fetching filtered transactions" });
    }
};
