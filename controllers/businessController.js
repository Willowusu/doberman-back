const response = require('../services/response');
const Business = require('../models/business');
const generateApiKey = require('../services/generateApiKey');
const seederService = require('../utils/ruleSeeder');
const { logAction } = require('../middlewares');


exports.createBusiness = async (req, res) => {
    try {
        const { name, email, phone, address, webhookUrl } = req.body;

        //generate a unique API key
        let apiKey = generateApiKey.apiKey();


        const newBusiness = new Business({
            name,
            domain, //psp, remittance, credit
            email,
            phone,
            address,
            webhookUrl,
            apiKey
        });

        let business = await newBusiness.save();

        // 2. Seed the Default Rules
        await seederService.seedDefaultRules(business._id);

        // LOG: Business Creation (Usually logged to a system-wide audit or the first user)
        // Since the user might not be in session yet during signup, we log with the new business ID
        await logAction({
            session: { businessId: business._id },
            user: { _id: business._id }, // or the creator user ID
            ip: req.ip,
            headers: req.headers
        }, 'CREATE_BUSINESS', 'System', { name: business.name });

        res.status(201).json(response(201, newBusiness, 'Business created successfully'));
    } catch (error) {
        console.error('Error creating business:', error);
        res.status(500).json(response(500, null, 'Internal Server Error'));
    }
}

// 1. Fetch Business Settings
exports.getSettings = async (req, res) => {
    try {
        const businessId = req.session.businessId;
        const business = await Business.findById(businessId).select('-password -salt'); // Security first

        if (!business) {
            return res.status(404).json(response(404, null, 'Business profile not found'));
        }

        res.json(response(200, business, 'Settings retrieved'));
    } catch (error) {
        res.status(500).json(response(500, null, 'Internal Server Error'));
    }
};

// 2. Update Business Settings
exports.updateSettings = async (req, res) => {
    try {
        const businessId = req.session.businessId;
        const updates = req.body;

        // Prevent updating sensitive internal fields via this route
        const restrictedFields = ['_id', 'apiKey', 'subscriptionPlan', 'createdAt'];
        restrictedFields.forEach(field => delete updates[field]);

        const updatedBusiness = await Business.findByIdAndUpdate(
            businessId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');
        // LOG: Settings Update
        // We log which keys were modified to make it readable
        await logAction(req, 'UPDATE_SETTINGS', 'Business Profile', {
            changedFields: Object.keys(updates),
            isAutoDeclineChanged: updates.isAutoDeclineEnabled !== undefined,
            newThresholds: updates.thresholds
        });
        res.json(response(200, updatedBusiness, 'Configuration updated successfully'));
    } catch (error) {
        console.error('Update Error:', error);
        res.status(400).json(response(400, null, 'Invalid update data'));
    }
};

// 3. Rotate API Key (Sensitive Action)
exports.rotateApiKey = async (req, res) => {
    try {
        const businessId = req.session.businessId;
        const newKey = `pk_live_${require('crypto').randomBytes(16).toString('hex')}`;

        await Business.findByIdAndUpdate(businessId, { apiKey: newKey });

        // LOG: API Key Rotation (Extremely Sensitive)
        await logAction(req, 'ROTATE_API_KEY', 'Security/API', {
            notice: "A new API key was generated and the old one was invalidated."
        });

        res.json(response(200, { apiKey: newKey }, 'API Key rotated successfully. Update your integration immediately.'));
    } catch (error) {
        res.status(500).json(response(500, null, 'Key rotation failed'));
    }
};
