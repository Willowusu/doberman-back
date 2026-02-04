const AuditLog = require('./models/auditLog');
const Business = require('./models/business'); // Your Business model


const ensureBusinessContext = (req, res, next) => {
    if (!req.session.businessId) {
        return res.status(401).json({ message: "Identity context missing" });
    }
    next();
};

const logAction = async (req, action, resource, details = {}, status = 'SUCCESS') => {

    try {
        
        await AuditLog.create({
            business: req.session.businessId,
            user: req.user._id || "api",
            action,
            resource,
            details,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent'],
            status
        });
    } catch (err) {
        console.error("Failed to write audit log:", err);
    }
};

const protect = async (req, res, next) => {
    if (req.session && req.session.userId) {
        // Attach user to req so logAction can see it
        req.user = { _id: req.session.userId };
        return next();
    }
    res.status(401).json({ message: "Unauthorized" });
};


const validateApiKey = async (req, res, next) => {
    const apiKey = req.header('x-api-key');

    if (!apiKey) {
        return res.status(401).json({ error: 'API Key is missing.' });
    }

    try {
        // Find the business associated with this key
        const business = await Business.findOne({ apiKey: apiKey });

        if (!business) {
            return res.status(403).json({ error: 'Invalid API Key.' });
        }

        // Attach business info to the request object
        req.businessId = business._id;
        req.domain = business.domain;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error during authentication.' });
    }
};


module.exports = {
    protect,
    ensureBusinessContext,
    logAction,
    validateApiKey
};

