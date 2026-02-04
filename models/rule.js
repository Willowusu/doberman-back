const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true },
    description: String,
    domain: {
        type: String,
        enum: ['ALL', 'PSP', 'REMITTANCE', 'CREDIT'],
        default: 'ALL'
    },
    // We'll use 'logic' to match our decision engine code
    logic: { type: Object, required: true },
    action: { type: String, enum: ['APPROVE', 'REVIEW', 'DECLINE', 'BLOCK'], default: 'REVIEW' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    score: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Rule', ruleSchema);