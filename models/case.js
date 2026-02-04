const mongoose = require('mongoose');
const { Schema } = mongoose;

const caseSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    event: { type: Schema.Types.ObjectId, ref: 'Event' },

    // A readable ID for the compliance team (e.g., JUNI-2026-001)
    caseReference: { type: String, unique: true },

    title: String, // The name of the primary rule hit
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    status: { type: String, enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'], default: 'OPEN' },

    // Context for the officer
    totalRiskScore: Number,
    triggeredRules: Array, // Array of the rule names/scores hit

    // Investigation fields
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes: String,
    resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Case', caseSchema);