const mongoose = require('mongoose');
const { Schema } = mongoose;

const decisionSchema = new Schema({
    business: { // Essential for multi-tenancy queries
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    eventId: {
        type: Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    // Changed to Number so you can perform math/analytics (e.g., average score)
    score: {
        type: Number,
        required: true,
        default: 0
    },
    // Combined Status: The final "answer" for the PSP/Lender
    status: {
        type: String,
        enum: ['APPROVE', 'REVIEW', 'DECLINE'],
        default: 'APPROVE'
    },
    // Enhanced TriggeredRules: Store a snapshot of the rule details
    triggeredRules: [{
        ruleId: { type: Schema.Types.ObjectId, ref: 'Rule' },
        name: String,        // Name at the time of the event
        scoreAdded: Number,  // Weight at the time of the event
        action: String       // e.g., if this rule specifically was a "DECLINE" rule
    }],
    manualOverrides: [{
        status: { type: String, enum: ['APPROVE', 'DECLINE'] },
        reason: String,
        adminId: { type: Schema.Types.ObjectId, ref: 'SystemUser' },
        adminName: String, // Denormalizing name for easy display
        createdAt: { type: Date, default: Date.now }
    }],
    processingTimeMs: { // Helps you monitor if your API is getting slow
        type: Number
    }
}, { timestamps: true });

module.exports = mongoose.model('Decision', decisionSchema);