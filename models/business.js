const mongoose = require('mongoose');
const { Schema } = mongoose;

const businessSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    address: {
        type: String,
        required: true,
    },
    apiKey: {
        type: String,
        required: true,
        unique: true
    },
    webhookUrl: {
        type: String,
        default: null,
        required: false
    },
    thresholds: {
        decline: { 
            type: Number, 
            default: 80
        }, // Scores >= 80 are auto-declined
        review: { 
            type: Number, 
            default: 30 
        },  // Scores between 30-79 go to manual review
        // Anything below 30 is auto-approved
    },
    isAutoDeclineEnabled: { 
        type: Boolean, 
        default: true 
    },
    planLevel: {
        type: String,
        enum: ['free', 'basic', 'premium'],
        default: 'free'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    domain: {
        type: String,
        enum: ['PSP', 'REMITTANCE', 'CREDIT'],
        default: null
    }

}, { timestamps: true });

module.exports = mongoose.model('Business', businessSchema);