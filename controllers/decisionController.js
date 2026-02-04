const Decision = require('../models/decision');
const response = require('../services/response');
const { logAction } = require('../middlewares');


exports.overrideDecision = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, overrideReason } = req.body;

        // Ensure your auth middleware populates these in the session
        const adminId = req.session.userId;
        const adminName = req.session.userName || 'System Admin';

        // 1. Validation
        if (!['APPROVE', 'DECLINE'].includes(status)) {
            return res.status(400).json(response(400, null, "Invalid status choice"));
        }

        if (!overrideReason || overrideReason.length < 5) {
            return res.status(400).json(response(400, null, "A valid reason is required for audit trails"));
        }

        // 2. Prepare the history object
        const overrideEntry = {
            status,
            reason: overrideReason,
            adminId: adminId,
            adminName: adminName,
            createdAt: new Date()
        };

        // 3. Update the Decision: Set current status AND push to history
        const updatedDecision = await Decision.findOneAndUpdate(
            { _id: id, business: req.session.businessId },
            {
                $set: { status }, // Update the main status
                $push: { manualOverrides: overrideEntry } // Append to history array
            },
            { new: true }
        ).populate('eventId');

        if (!updatedDecision) {
            return res.status(404).json(response(404, null, "Decision record not found"));
        }

        // --- AUDIT LOG ENTRY ---
        // We log the change of state. This is vital for accountability.
        await logAction(req, 'OVERRIDE_DECISION', 'Risk Operations', {
            decisionId: id,
            newStatus: status,
            reason: overrideReason,
            transactionAmount: updatedDecision.eventId?.payload?.transaction_amount
        });

        res.json(response(200, updatedDecision, "Decision history updated successfully"));
    } catch (error) {
        console.error("Override Error:", error);
        res.status(500).json(response(500, null, "Internal server error during override"));
    }
};