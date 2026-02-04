const Alert = require('../models/alert');
const response = require('../services/response');
const AlertLog = require('../models/alertLog');
const { logAction } = require('../middlewares');



// 1. Get the alert definitions (the watches) for a customer
exports.getCustomerAlerts = async (req, res) => {
    try {
        const { id } = req.params; // Customer _id
        const business = req.session.businessId;

        const alerts = await Alert.find({ business, customer: id })
            .sort({ createdAt: -1 });

        res.json(response(200, alerts, 'Alert definitions fetched'));
    } catch (error) {
        res.status(500).json(response(500, null, 'Internal error'));
    }
};

// 2. Delete an alert
exports.deleteAlert = async (req, res) => {
    try {
        const business = req.session.businessId;
        const { id } = req.params; // Alert _id

        const deletedAlert = await Alert.findOneAndDelete({ business, _id: id });

        if (!deletedAlert) return res.status(404).json(response(404, null, 'Alert not found'));

        // --- AUDIT LOG ENTRY ---
        await logAction(req, 'DELETE_ALERT', 'Risk Monitoring', {
            alertId: id,
            alertName: deletedAlert.name,
            targetCustomer: deletedAlert.customer
        });

        res.json(response(200, deletedAlert, 'Alert removed successfully'));
    } catch (error) {
        res.status(500).json(response(500, null, 'Internal Server Error'));
    }
};

exports.createAlert = async (req, res) => {
    try {
        const { name, description, customer, logic, settings } = req.body;
        const business = req.session.businessId;

        const newAlert = new Alert({
            business,
            customer, // The _id of the Merchant/Customer
            name,
            description,
            logic,    // The JsonLogic object
            settings: {
                channel: settings.channel,
                recipient: settings.recipient
            },
            isActive: true
        });

        await newAlert.save();

        // --- AUDIT LOG ENTRY ---
        await logAction(req, 'CREATE_ALERT', 'Risk Monitoring', {
            alertId: newAlert._id,
            alertName: name,
            alertType: type || 'SIMPLE',
            targetCustomer: customer
        });
        res.status(201).json(response(201, newAlert, 'Alert monitoring active'));
    } catch (error) {
        console.error('Create Alert Error:', error);
        res.status(500).json(response(500, null, 'Failed to create alert'));
    }
};


exports.getCustomerAlertLogs = async (req, res) => {
    try {
        const { id } = req.params; // Customer _id
        const business = req.session.businessId;

        // Find every time an alert was actually fired for this customer
        const logs = await AlertLog.find({ business, customer: id })
            .populate('event', 'action_type payload.transaction_amount') // Optional: show event details
            .sort({ createdAt: -1 })
            .limit(20);

        res.json(response(200, logs, 'Alert activity logs fetched'));
    } catch (error) {
        res.status(500).json(response(500, null, 'Internal error fetching logs'));
    }
};



exports.getGlobalAlertFeed = async (req, res) => {
    try {
        const business = req.session.businessId;
        const { limit = 50, channel, type } = req.query;

        // Build filter
        const query = { business };
        if (channel) query.channel = channel;
        // Note: You might need to populate the 'alert' to filter by 'type' (SIMPLE vs AGGREGATE)

        const feed = await AlertLog.find(query)
            .populate('customer', 'name riskLevel') // So we know WHO triggered it
            .populate('alert', 'type name')        // So we know WHAT kind of alert it was
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json(response(200, feed, 'Global alert feed synchronized'));
    } catch (error) {
        console.error('Feed Error:', error);
        res.status(500).json(response(500, null, 'Failed to fetch live feed'));
    }
};