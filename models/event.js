const mongoose = require('mongoose');
const { Schema } = mongoose;

const eventSchema = new Schema({
    // 1. SYSTEM CONTEXT (The "Searchable" Headers)
    business: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true,
        index: true
    },
    domain: {
        type: String,
        required: true,
        enum: ['PSP', 'REMITTANCE', 'CREDIT', 'GENERAL'],
        index: true
    },
    actionType: {
        type: String,
        required: true, // REGISTRATION, TRANSACTION, etc.
        index: true
    },

    // 2. THE FLEXIBLE DATA (The "Everything Bagel")
    payload: {
        type: Schema.Types.Mixed,
        required: true
    },

    // 3. INTELLIGENCE & TECH CONTEXT
    enrichedData: {
        type: Schema.Types.Mixed,
        default: null
    },
    ip: { type: String, index: true },
    deviceId: { type: String, index: true },

}, { timestamps: true });

// INDEXES: This is where we ensure the "Simple" model stays "Fast"
// This allows you to open a Merchant's profile and see their specific events instantly.
eventSchema.index({ business: 1, 'payload.merchant_id': 1, createdAt: -1 });

// This helps you find all transactions for a specific ID across the system.
eventSchema.index({ 'payload.transaction_id': 1 });

module.exports = mongoose.model('Event', eventSchema);