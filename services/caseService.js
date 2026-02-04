const Case = require('../models/case');

exports.createCaseFromDecision = async (event, customerId, decisionResult) => {
    // 1. Only create a Case for significant risks
    if (!decisionResult.triggeredRules || decisionResult.triggeredRules.length === 0 || decisionResult.score < 30) {
        return null;
    }

    // 2. Determine Severity
    const severity = decisionResult.score >= 80 ? 'CRITICAL' : decisionResult.score >= 50 ? 'HIGH' : 'MEDIUM';

    // 3. Create ONE consolidated case for the transaction
    const newCase = new Case({
        business: event.business,
        customer: customerId,
        event: event._id,
        caseReference: `AML-${Date.now().toString().slice(-6)}`,
        title: decisionResult.triggeredRules[0]?.name || "Multiple AML Scenarios Detected",
        severity: severity,
        status: 'OPEN',
        totalRiskScore: decisionResult.score,
        triggeredRules: decisionResult.triggeredRules.map(r => ({
            name: r.name,
            score: r.scoreAdded
        }))
    });

    try {
        await newCase.save();
        return newCase;
    } catch (error) {
        console.error('Error creating AML case:', error);
    }
};