const mongoose = require('mongoose');
const { Schema } = mongoose;

const customerSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    externalId: { type: String, required: true }, // The unique ID from the PSP system (e.g., Yun10060)

    // Primary Identity
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },

    // Legal & Compliance (Converted to camelCase)
    complianceData: {
        busType: String,         // e.g., Sole Proprietorship
        busTin: String,          // Tax ID
        busRegNumber: String,    // Registration Number
        address: String,
        staffSize: String,
        joinedDate: Date
    },

    // Settlement Logic (Standardized camelCase)
    settlementInfo: {
        accountOrgName: String,
        accountName: String,
        accountNumber: String,
        accountOrgCode: String,
        accountType: String      // e.g., bank, momo
    },

    // Entity Structure
    directors: [{
        name: String,
        dob: Date,
        idType: String,
        idNumber: String,
        cardIssueDate: Date,
        cardExpiryDate: Date,
        photoIdUrl: String
    }],

    // Risk Matrix Fields (Standardized camelCase)
    riskProfile: {
        originationMethod: { type: String, enum: ['Solicited', 'Unsolicited'], default: 'Solicited' },
        isSignOnComplete: { type: Boolean, default: true },
        hasGhanaCard: { type: Boolean, default: true },
        isIdVerified: { type: Boolean, default: false },
        residencyStatus: { type: String, enum: ['Resident', 'Non-Resident'], default: 'Resident' },
        purpose: { type: String, enum: ['Collections', 'Click2School', 'Disbursements', 'Remittance', 'Cross-border Settlement'], default: 'Collections' },
        nationality: { type: String, default: 'Ghana' },
        industry: { type: String, default: 'Salaried worker' },
        isPep: { type: Boolean, default: false },
        isSanctioned: { type: Boolean, default: false },
        productType: { type: String, enum: ['USSD', 'Payment Link', 'Payment Form', 'API Integration', 'Bulk Disbursement'], default: 'Payment Link' },
        expectedMonthlyVolume: { type: Number, default: 0 },
        locationZone: { type: String, enum: ['Tantra Hill', 'Greater Accra', 'Outside Greater Accra'], default: 'Greater Accra' },
        rgdStatus: { type: String, enum: ['Verified', 'Identified but not verified', 'Not identified'], default: 'Not identified' },
        thirdPartyOversight: { type: String, enum: ['Verified', 'Obtained but not verified', 'Not obtained', 'Not required'], default: 'Not required' }
    },

    // Risk Platform Metrics (Doberman Internal)
    totalTransactions: { type: Number, default: 0 },
    totalFlags: { type: Number, default: 0 },
    totalInboundVolume: { type: Number, default: 0 },
    totalOutboundVolume: { type: Number, default: 0 },
    onboardingRiskScore: { type: Number, default: 0 },
    dynamicRiskScore: { type: Number, default: 0 },
    riskLevel: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'MEDIUM-HIGH', 'HIGH'],
        default: 'LOW'
    },
    status: { type: String, enum: ['ACTIVE', 'PENDING_REVIEW', 'BANNED', 'TRUSTED'], default: 'ACTIVE' },
    lastSeen: Date
}, { timestamps: true });

customerSchema.index({ business: 1, externalId: 1 }, { unique: true });

module.exports = mongoose.model('Customer', customerSchema);