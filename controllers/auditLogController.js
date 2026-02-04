const response = require('../services/response');
const AuditLog = require('../models/auditLog');
const { logAction } = require('../middlewares');


exports.getAuditLogs = async (req, res) => {
    const logs = await AuditLog.find({ business: req.session.businessId })
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .limit(100);
    // LOG: Data Access
    // It is important to know who viewed the master event list for audit compliance.
    await logAction(req, 'VIEW_AUDIT_LOGS', 'Audit Log Monitoring', {
        resultsCount: logs.length
    });
    res.json(response(200, logs));
};

exports.logSanctionScreening =async (req, res) => {
    const { query, resultsFound } = req.body;

    await logAction(req, 'SANCTION_SCREEN_PERFORMED', 'Compliance', {
        searchQuery: query,
        matchCount: resultsFound,
        timestamp: new Date()
    });

    res.json({ status: 'logged' });
};