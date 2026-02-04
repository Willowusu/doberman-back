// models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'SystemUser', required: true },
    action: { type: String, required: true }, // e.g., 'UPDATE_THRESHOLD', 'LOGIN', 'ROTATE_API_KEY'
    resource: { type: String }, // e.g., 'Risk Settings'
    details: { type: Object }, // Store the "before" and "after" values
    ipAddress: { type: String },
    userAgent: { type: String },
    status: { type: String, enum: ['SUCCESS', 'FAILURE'], default: 'SUCCESS' }
}, { timestamps: true });

// Index for fast searching by business and time
auditLogSchema.index({ business: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);