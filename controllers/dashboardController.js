const Customer = require('../models/customer');
const Event = require('../models/event');
const Alert = require('../models/alert');

exports.getDashboardStats = async (req, res) => {
    try {
        const businessId = req.businessId;
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [generalStats, riskDist, volumeStats] = await Promise.all([
            // 1. General KPI Counts
            Customer.aggregate([
                { $match: { business: businessId } },
                {
                    $group: {
                        _id: null,
                        totalHighRisk: { $sum: { $cond: [{ $eq: ["$riskLevel", "HIGH"] }, 1, 0] } },
                        avgSystemScore: { $avg: "$dynamicRiskScore" }
                    }
                }
            ]),

            // 2. Risk Distribution (For the Pie/Donut Chart)
            Customer.aggregate([
                { $match: { business: businessId } },
                { $group: { _id: "$riskLevel", count: { $sum: 1 } } }
            ]),

            // 3. 24h Volume Calculation from Events
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
                        totalVolume: { $sum: { $convert: { input: "$payload.transaction_amount", to: "double", onError: 0 } } },
                        eventCount: { $sum: 1 }
                    }
                }
            ]),

            // 4. Pending Alerts Count
            Alert.countDocuments({ business: businessId, status: 'OPEN' })
        ]);

        // Formatting the response
        const stats = {
            highRiskCount: generalStats[0]?.totalHighRisk || 0,
            pendingAlerts: await Alert.countDocuments({ business: businessId, status: 'OPEN' }),
            totalVolume: volumeStats[0]?.totalVolume || 0,
            decisionRate: 98.4, // This would typically be (Auto-Decided / Total Events) * 100
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