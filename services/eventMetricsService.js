const Event = require('../models/event');
const Customer = require('../models/customer');
const mongoose = require('mongoose');

exports.getMetricsSnapshot = async (customer, currentEvent) => {
    const businessId = customer.business;
    const { payload } = currentEvent;
    const isRemittance = payload.transactionType?.toLowerCase() === 'remittance';

    // Time windows
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    

    const stats = await Event.aggregate([
        {
            $match: {
                business: businessId,
                // Match the business/MTO history
                "payload.merchantId": payload.merchantId,
                createdAt: { $gte: threeMonthsAgo }
            }
        },
        {
            $facet: {
                // 1. Business/MTO Level Volume (Rules 1.1.1, 1.1.3, 1.1.6)
                "businessVolume": [
                    {
                        $group: {
                            _id: null,
                            threeMonthDailyAvg: { $avg: "$payload.amount" },
                            globalAvg: { $avg: "$payload.amount" },
                            currentDayVolume: {
                                $sum: { $cond: [{ $gte: ["$createdAt", twentyFourHoursAgo] }, "$payload.amount", 0] }
                            },
                            cumulative30d: {
                                $sum: { $cond: [{ $gte: ["$createdAt", thirtyDaysAgo] }, "$payload.amount", 0] }
                            }
                        }
                    }
                ],
                // 2. Individual Sender Logic (Remittance Rule 1.1.2 & 1.1.07)
                "senderAnalysis": [
                    {
                        $match: {
                            "payload.senderName": payload.senderName || "N/A",
                            createdAt: { $gte: fifteenDaysAgo }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            senderFifteenDaySum: { $sum: "$payload.amount" },
                            senderDailyTransactionCount: {
                                $sum: { $cond: [{ $gte: ["$createdAt", twentyFourHoursAgo] }, 1, 0] }
                            }
                        }
                    }
                ],
                // 3. One-to-Many & Similar Amounts (Rules 1.1.7, 1.1.4)
                "patternAnalysis": [
                    { $match: { createdAt: { $gte: fiveDaysAgo } } },
                    {
                        $group: {
                            _id: "$payload.accountNumber",
                            totalByAccount: { $sum: "$payload.amount" },
                            similarCount: {
                                $sum: {
                                    $cond: [
                                        { $lte: [{ $abs: { $subtract: ["$payload.amount", payload.amount || 0] } }, { $multiply: [payload.amount || 0, 0.05] }] },
                                        1, 0
                                    ]
                                }
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            uniqueOutboundCount5d: { $sum: 1 },
                            outboundSum5d: { $sum: "$totalByAccount" },
                            similarAmountCount5d: { $sum: "$similarCount" }
                        }
                    }
                ],
                // 4. Beneficiary Analysis (Rule 1.1.11)
                "beneficiaryAnalysis": [
                    {
                        $match: {
                            createdAt: { $gte: thirtyDaysAgo },
                            "payload.accountNumber": payload.accountNumber || "N/A"
                        }
                    },
                    { $count: "count" }
                ]
            }
        }
    ]);

    const res = stats[0];

    const muleStats = await Event.aggregate([
        {
            $match: {
                business: businessId,
                "payload.accountNumber": payload.accountNumber, // Focus on the Ghanaian recipient
                createdAt: { $gte: sevenDaysAgo }
            }
        },
        {
            $facet: {
                // Count unique senders for Rule 1301
                "senderConvergence": [
                    { $match: { createdAt: { $gte: seventyTwoHoursAgo } } },
                    { $group: { _id: "$payload.senderName" } },
                    { $count: "count" }
                ],
                // Calculate Inbound vs Outbound for Rule 1302
                "passThrough": [
                    { $match: { createdAt: { $gte: fourHoursAgo } } },
                    {
                        $group: {
                            _id: null,
                            totalIn: { $sum: { $cond: [{ $in: ["$payload.transactionType", ["remittance", "topup"]] }, "$payload.amount", 0] } },
                            totalOut: { $sum: { $cond: [{ $in: ["$payload.transactionType", ["transfer", "withdrawal", "payout"]] }, "$payload.amount", 0] } }
                        }
                    }
                ],
                // Count unique countries for Rule 1303
                "corridorDiversity": [
                    { $group: { _id: "$payload.senderCountry" } },
                    { $count: "count" }
                ]
            }
        }
    ]);
    const mRes = muleStats[0];
    const totalIn = mRes.passThrough[0]?.totalIn || 0;
    const totalOut = mRes.passThrough[0]?.totalOut || 0;

    // --- NEW GEOGRAPHIC RISK TIER LOGIC ---
    const highRiskCountries = ["KP", "IR", "MM"]; // Tier 1: Blacklist
    const greyListCountries = ["DZ", "AO", "BO", "BG", "CM", "CI", "CD", "HT", "KE", "LA", "LB", "MC", "NA", "NP", "SS", "SY", "VE", "VN", "VG", "YE", "NG", "ZA"]; // Tier 2: Monitoring
    const tier3Countries = ["AF", "SO", "SD", "LY", "PK", "BD"]; // Tier 3: High Corruption/Conflict

    const senderCountry = payload.senderCountry?.toUpperCase();
    let riskTier = 4; // Default: Low Risk

    if (highRiskCountries.includes(senderCountry)) {
        riskTier = 1;
    } else if (greyListCountries.includes(senderCountry)) {
        riskTier = 2;
    } else if (tier3Countries.includes(senderCountry)) {
        riskTier = 3;
    }

    // 1. Define Conflict Jurisdictions
    const conflictTier1 = ["AF", "SY", "YE", "SO", "IQ", "SD", "SS", "LY", "CD", "MM", "ML", "BF", "CF"];
    const conflictTier2 = ["NG", "NE", "TD", "MZ", "ET", "KE", "LB", "PS", "PK", "PH"];

    let conflictTier = 3; // Low risk by default

    if (conflictTier1.includes(senderCountry)) conflictTier = 1;
    else if (conflictTier2.includes(senderCountry)) conflictTier = 2;

    return {
        // Business Stats
        currentDayVolume: res.businessVolume[0]?.currentDayVolume || 0,
        threeMonthDailyAvg: res.businessVolume[0]?.threeMonthDailyAvg || 0,
        dailyAverage: res.businessVolume[0]?.globalAvg || 0,
        cumulative30d: res.businessVolume[0]?.cumulative30d || 0,
        monthlyAverage: (res.businessVolume[0]?.globalAvg || 0) * 30,

        // Sender/Remittance Stats
        senderFifteenDaySum: res.senderAnalysis[0]?.senderFifteenDaySum || 0,
        senderDailyTransactionCount: res.senderAnalysis[0]?.senderDailyTransactionCount || 0,
        fifteenDaySum: res.businessVolume[0]?.cumulative30d / 2, // Fallback for business-level structuring

        // Pattern Stats
        uniqueOutboundCount5d: res.patternAnalysis[0]?.uniqueOutboundCount5d || 0,
        outboundSum5d: res.patternAnalysis[0]?.outboundSum5d || 0,
        similarAmountCount5d: res.patternAnalysis[0]?.similarAmountCount5d || 0,
        sameBeneficiaryCount30d: res.beneficiaryAnalysis[0]?.count || 0,

        // Status & Metadata
        previousStatus: customer.status,
        isRemittance: isRemittance,

        // New Geographic Metric
        countryRiskTier: riskTier,
        uniqueSendersToBeneficiary72h: mRes.senderConvergence[0]?.count || 0,
        passThroughRatio4h: totalIn > 0 ? (totalOut / totalIn) : 0,
        uniqueCorridors7d: mRes.corridorDiversity[0]?.count || 0,

        conflictRiskTier: conflictTier,
        // Provide a helper to check keywords in descriptions
        descriptionKeywords: (payload.description || "").toLowerCase()
    };
};

/**
 * checkSharedIdentity
 * Matches transaction names against MTO Director/UBO lists.
 */
exports.checkSharedIdentity = async (sender, payload) => {
    // 1. Find if the recipient is another customer in our system
    const receiver = await Customer.findOne({
        "settlementInfo.accountNumber": payload.accountNumber
    });

    const getSurname = (name) => name?.trim().split(' ').pop().toUpperCase();

    // PARTY NAMES (Remittance Sender or MTO Name)
    const partyName = payload.senderName || sender.name;
    const recipientName = payload.recipientName || (receiver ? receiver.name : null);

    // 2. Exact Match Check (Is the sender/recipient a director of the MTO?)
    const mtoDirectors = sender.directors || [];

    const isDirectorExactMatch = mtoDirectors.some(d =>
        d.name.toUpperCase() === partyName.toUpperCase() ||
        (recipientName && d.name.toUpperCase() === recipientName.toUpperCase())
    );

    if (isDirectorExactMatch) return { matchType: 'EXACT', match: true };

    // 3. Relative Match (Surname matching)
    const partySurname = getSurname(partyName);
    const isRelativeMatch = mtoDirectors.some(d => getSurname(d.name) === partySurname);

    if (isRelativeMatch) return { matchType: 'RELATIVE', match: true };

    return { matchType: 'NONE', match: false };
};