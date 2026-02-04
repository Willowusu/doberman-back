const response = require('../services/response');
const Customer = require('../models/customer');
const Decision = require('../models/decision');
const { logAction } = require('../middlewares');
const { calculateCustomerRisk } = require('../services/calculateCustomerRisk');
const { checkSanctions } = require('../services/sanctionsCheck');
const { searchPepList } = require('../services/pepService');

exports.registerCustomer = async (req, res) => {
    try {
        const businessId = req.businessId;
        const {
            externalId, name, email, phone,
            complianceData, settlementInfo, directors,
            riskProfile = {}
        } = req.body;

        if (!externalId) return res.status(400).json(response(400, null, "externalId is required"));

        // 1. Run Sanctions Check (Live PEP check)
        const isSanctioned = await checkSanctions(name);
        const pepMatches = await searchPepList(name).length > 0;


        // 2. Setup Defaults & Sanctions injection
        const finalRiskProfile = {
            originationMethod: riskProfile.originationMethod || 'Solicited',
            isSignOnComplete: riskProfile.isSignOnComplete ?? true,
            hasGhanaCard: riskProfile.hasGhanaCard ?? true,
            isIdVerified: riskProfile.isIdVerified ?? false,
            residencyStatus: riskProfile.residencyStatus || 'Resident',
            purpose: riskProfile.purpose || 'Collections',
            nationality: riskProfile.nationality || 'Ghana',
            industry: riskProfile.industry || 'Salaried worker',
            isPep: pepMatches,
            isSanctioned: isSanctioned.found,
            productType: riskProfile.productType || 'Payment Link',
            expectedMonthlyVolume: riskProfile.expectedMonthlyVolume || 0,
            locationZone: riskProfile.locationZone || 'Greater Accra',
            rgdStatus: riskProfile.rgdStatus || 'Not identified',
            thirdPartyOversight: riskProfile.thirdPartyOversight || 'Not required'
        };

        // 3. Calculate Risk Score using the profile
        // Note: If your function is synchronous, remove 'await'
        const assessment = await calculateCustomerRisk({ riskProfile: finalRiskProfile });


        const registrationPayload = {
            business: businessId,
            externalId,
            name,
            email,
            phone,
            complianceData,
            settlementInfo,
            directors: directors || [],
            riskProfile: finalRiskProfile,

            // --- MATCHING YOUR MODEL ---
            onboardingRiskScore: assessment.totalScore, // Saved as the Matrix baseline
            dynamicRiskScore: assessment.totalScore,    // Initialize behavior at the same level

            // Format riskLevel string for the Enum (LOW, MEDIUM, MEDIUM-HIGH, HIGH)
            riskLevel: assessment.riskLevel.toUpperCase().replace(/\s+/g, '-'),

            status: isSanctioned.found ? 'PENDING_REVIEW' : 'ACTIVE'
        };

        const customer = await Customer.findOneAndUpdate(
            { business: businessId, externalId: externalId },
            { $set: registrationPayload },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Audit the result
        await logAction(req, 'CUSTOMER_REGISTERED', 'Compliance', {
            name: customer.name,
            onboardingScore: customer.onboardingRiskScore,
            riskLevel: customer.riskLevel
        });

        res.status(201).json(response(201, customer, 'Customer assessed and registered successfully'));
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json(response(500, null, 'Failed to register customer'));
    }
};


exports.getCustomers = async (req, res) => {
    try {
        // 1. Destructure 'search' from the query params
        const { page = 1, limit = 10, startDate, endDate, search, riskLevel } = req.query;
        const query = { business: req.session.businessId };


        // 1. Add Risk Level Filter
        if (riskLevel && riskLevel !== 'ALL') {
            query.riskLevel = riskLevel;
        }

        // 2. Date Range Filtering
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // 3. SEARCH LOGIC GOES HERE
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { externalId: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;


        const [docs, total] = await Promise.all([
            Customer.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Customer.countDocuments(query)
        ]);



        res.status(200).json({
            status: 200,
            data: {
                docs,
                total,
                page: parseInt(page),
                hasMore: total > skip + docs.length
            }
        });
    } catch (error) {
        console.error("GetCustomers Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getCustomerById = async (req, res) => {
    try {
        const businessId = req.session.businessId;
        const customerId = req.params.id;

        if (!businessId) {
            return res.json(response(401, null, "Unauthorized: No business context found"));
        }

        // Query only for documents matching this specific business
        const customer = await Customer.findOne({ business: businessId, _id: customerId })
        if (customer) {
            // LOG: Access to sensitive PII (Personally Identifiable Information)
            // It is critical to know who viewed a specific customer's profile
            await logAction(req, 'VIEW_CUSTOMER_DETAIL', 'Customer Management', {
                customerId: customerId,
                customerName: customer.name
            });
        }

        res.json(response(200, customer, "Customer retrieved successfully"));
    } catch (error) {
        res.json(response(500, null, "Error fetching customer"));
    }
}

exports.getCustomerHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.session.businessId;

        // 1. Get the customer to find their externalId
        const customer = await Customer.findOne({ _id: id, business: businessId });
        if (!customer) return res.status(404).json(response(404, null, 'Customer not found'));

        /**
         * 2. Find all Decisions for this business.
         * We populate 'eventId' and use the 'match' property to filter by the new payload structure.
         */
        const decisions = await Decision.find({ business: businessId })
            .populate({
                path: 'eventId',
                match: {
                    $or: [
                        { 'payload.merchantId': customer.externalId },
                        { 'payload.userId': customer.externalId }
                    ]
                }
            })
            .sort({ createdAt: -1 })
            .limit(50); // Good practice to limit history for performance

        // 3. Filter out decisions that didn't match the eventId criteria
        const filteredDecisions = decisions.filter(d => d.eventId !== null);

        // LOG: View Transaction History
        // History contains financial movement data, highly sensitive
        await logAction(req, 'VIEW_CUSTOMER_HISTORY', 'Customer Management', {
            customerId: id,
            externalId: customer.externalId
        });

        res.json(response(200, filteredDecisions, 'History fetched'));
    } catch (error) {
        console.error('History Fetch Error:', error);
        res.status(500).json(response(500, null, 'Internal error'));
    }
};