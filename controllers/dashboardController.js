const Customer = require('../models/customer');
const Event = require('../models/event');
const Alert = require('../models/alert');
const Decision = require('../models/decision'); // Ensure this is imported
const mongoose = require('mongoose');
const response = require('../services/response');

exports.getDashboardStats = async (req, res) => {
    try {
        // 1. CRITICAL: Cast the string ID to a MongoDB ObjectId
        const businessId = new mongoose.Types.ObjectId(req.session.businessId);
        console.log("Business ID (ObjectId):", businessId);
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [generalStats, riskDist, volumeStats, pendingAlerts, decisionStats] = await Promise.all([
            // 1. General KPI Counts
            Customer.aggregate([
                { $match: { business: businessId } }, // Now matching ObjectId to ObjectId
                {
                    $group: {
                        _id: null,
                        totalHighRisk: { $sum: { $cond: [{ $eq: ["$riskLevel", "HIGH"] }, 1, 0] } },
                    }
                }
            ]),

            // 2. Risk Distribution
            Customer.aggregate([
                { $match: { business: businessId } },
                { $group: { _id: "$riskLevel", count: { $sum: 1 } } }
            ]),

            // 3. 24h Volume Calculation
            // Note: Ensure the field name matches your Event schema (payload.amount vs payload.transaction_amount)
            Event.aggregate([
                {
                    $match: {
                        business: businessId,
                        createdAt: { $gte: twentyFourHoursAgo }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalVolume: { $sum: { $convert: { input: "$payload.amount", to: "double", onError: 0 } } }
                    }
                }
            ]),

            // 4. Pending Alerts Count
            Alert.countDocuments({ business: businessId, status: 'OPEN' }),

            // 5. Decision Rate Calculation (Placeholder - Implement your logic here)
            // Add this as the 5th item in your Promise.all array
            Decision.aggregate([
                {
                    $match: {
                        business: businessId,
                        createdAt: { $gte: twentyFourHoursAgo }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalCount: { $sum: 1 },
                        autoCount: {
                            $sum: {
                                // Count as "Auto" only if status is NOT 'REVIEW'
                                $cond: [{ $in: ["$status", ["APPROVE", "DECLINE"]] }, 1, 0]
                            }
                        }
                    }
                }
            ])


        ]);

        const dStats = decisionStats[0] || { totalCount: 0, autoCount: 0 };
        const rate = dStats.totalCount > 0
            ? (dStats.autoCount / dStats.totalCount) * 100
            : 100; // Default to 100% efficiency if no traffic

        const stats = {
            highRiskCount: generalStats[0]?.totalHighRisk || 0,
            pendingAlerts: pendingAlerts || 0,
            totalVolume: volumeStats[0]?.totalVolume || 0,
            decisionRate: parseFloat(rate.toFixed(1)), // e.g., 94.2
            riskDistribution: riskDist.map(item => ({
                label: item._id || 'UNKNOWN',
                value: item.count
            }))
        };

        res.json(response(200, stats, "Dashboard metrics fetched successfully"));
    } catch (error) {
        console.error("Dashboard Aggregation Error:", error);
        res.json(response(500, null, "Failed to fetch dashboard metrics"));
    }
};
