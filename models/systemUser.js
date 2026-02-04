const mongoose = require('mongoose');
const { Schema } = mongoose;

const systemUserSchema = new Schema({
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
    business: {
        type: Schema.Types.ObjectId,
        ref: 'Business',
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'analyst', 'viewer'],
        default: 'viewer'
    },
    mfaEnabled: {
        type: Boolean,
        default: true
    },
    lastLoginIp: {
        type: String,
        default: null,
        required: false
    },
    magicToken: {
        type: String,
        default: null
    },
    tokenExpires: {
        type: Date,
        default: null
    },
    mfaSecret: {
        type: String,
        default: null
    }


}, { timestamps: true });

module.exports = mongoose.model('SystemUser', systemUserSchema);