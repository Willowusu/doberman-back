const mongoose = require('mongoose');
const { Schema } = mongoose;

const triggerSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    name: { type: String, required: true }, // e.g., "High Volume Alert"

    // The Condition (Using the same logic engine as rules)
    logic: { type: Object, required: true },

    // Notification Channels
    channels: {
        email: { enabled: Boolean, address: String },
        slack: { enabled: Boolean, webhookUrl: String }
    },

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Trigger', triggerSchema);