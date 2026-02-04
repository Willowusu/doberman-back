const mongoose = require('mongoose');
const { Schema } = mongoose;

const clientSchema = new Schema({
    externalUserId: {
        type: String,
        required: true
    },
    calculatedTrustScore: {
        type: String,
        required: true,
    },
    firstSeen: {
        type: Date,
        required: true,
    },
    lastSeen: {
        type: Date,
        required: true,
    }

}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);