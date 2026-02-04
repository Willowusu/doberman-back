const mongoose = require('mongoose');
const { Schema } = mongoose;

const alertLogSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event' },

    // Links to either a custom Alert OR a seeded JUNI Rule
    alert: { type: Schema.Types.ObjectId, ref: 'Alert' },
    rule: { type: Schema.Types.ObjectId, ref: 'Rule' },

    triggerName: String,  // e.g., "High Volume Tripwire" or "AML-1110: Dormant Account"
    triggerValue: Number, // The amount or count at the time of hit

    // Case Management Fields
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM'
    },
    status: {
        type: String,
        enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FLAGGED_FOR_FIC'],
        default: 'OPEN'
    },

    // Investigation Audit
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes: String,
    resolvedAt: Date,

    // Snapshot of the notification status (for the AlertService)
    notificationStatus: {
        type: String,
        enum: ['DELIVERED', 'FAILED', 'NOT_REQUIRED'],
        default: 'DELIVERED'
    }
}, { timestamps: true });

module.exports = mongoose.model('AlertLog', alertLogSchema);