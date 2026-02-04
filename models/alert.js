const mongoose = require('mongoose');
const { Schema } = mongoose;

const alertSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    name: { type: String, required: true },
    description: String,

    type: {
        type: String,
        enum: ['SIMPLE', 'AGGREGATE'],
        default: 'SIMPLE'
    },

    // For AGGREGATE behavior alerts (summing or counting over time)
    aggregation: {
        metric: { type: String, enum: ['COUNT', 'SUM'] },
        field: { type: String, default: 'transaction_amount' },
        windowHours: { type: Number, default: 24 },
        threshold: { type: Number }
    },

    // The logic used by JsonLogic
    logic: { type: Object, required: true },

    // The notification destination
    settings: {
        channel: { type: String, enum: ['EMAIL', 'SLACK', 'WEBHOOK'], default: 'EMAIL' },
        recipient: { type: String, required: true }, // Email or Webhook URL
    },

    isActive: { type: Boolean, default: true },
    lastFired: Date
}, { timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);