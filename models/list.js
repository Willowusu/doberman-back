const mongoose = require('mongoose');
const { Schema } = mongoose;

const listSchema = new Schema({
    business: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    listType: {
        type: String,
        enum: ['BLACKLIST', 'WHITELIST', 'GREYLIST'], // Greylist = forced manual review
        required: true,
        default: 'BLACKLIST'
    },
    entityType: {
        type: String,
        enum: ['ip', 'email', 'userId', 'deviceId', 'cardHash', 'phone'],
        required: true,
    },
    value: {
        type: String,
        required: true,
        index: true // Crucial for performance
    },
    reason: {
        type: String,
        default: null,
        required: false, // e.g., "Confirmed chargeback" or "Trusted partner"
    },
    expiryDate: {
        type: Date,
        default: null,
        required: false, // Null means permanent
    }
}, { timestamps: true });

// Compound index for fast lookup within a specific business
listSchema.index({ business: 1, entityType: 1, value: 1 });

module.exports = mongoose.model('List', listSchema);