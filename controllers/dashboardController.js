const Customer = require('../models/customer');
const Event = require('../models/event');
const Alert = require('../models/alert');
const mongoose = require('mongoose'); // Import mongoose at the top

exports.getDashboardStats = async (req, res) => {
    try {
        // 1. CRITICAL: Cast the string ID to a MongoDB ObjectId
        const businessId = new mongoose.Types.ObjectId(req.businessId);
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [generalStats, riskDist, volumeStats, pendingAlerts] = await Promise.all([
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
            Alert.countDocuments({ business: businessId, status: 'OPEN' })
        ]);

        const stats = {
            highRiskCount: generalStats[0]?.totalHighRisk || 0,
            pendingAlerts: pendingAlerts || 0,
            totalVolume: volumeStats[0]?.totalVolume || 0,
            decisionRate: 98.4,
            riskDistribution: riskDist.map(item => ({
                label: item._id || 'UNKNOWN',
                value: item.count
            }))
        };

        res.status(200).json({ status: 200, data: stats });
    } catch (error) {
        console.error("Dashboard Aggregation Error:", error);
        res.status(500).json({ status: 500, message: "Failed to fetch dashboard metrics" });
    }
};