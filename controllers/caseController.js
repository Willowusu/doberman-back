const Case = require('../models/case');
const response = require('../services/response');

exports.getCases = async (req, res) => {
    try {
        const { status = 'OPEN', severity } = req.query;
        const query = { business: req.businessId, status };

        if (severity) query.severity = severity;

        const cases = await Case.find(query)
            .populate('customer', 'name email phone riskLevel')
            .sort({ createdAt: -1 });

        res.json(response(200, cases, "Cases retrieved successfully"));
    } catch (error) {
        res.json(response(500, null, error.message));
    }
};

exports.getCaseById = async (req, res) => {
    try {
        const amlCase = await Case.findOne({
            _id: req.params.id,
            business: req.businessId
        }).populate('customer event');

        if (!amlCase) return res.json(response(404, null, "Case not found"));

        res.json(response(200, amlCase, "Case retrieved successfully"));
    } catch (error) {
        res.json(response(500, null, error.message));
    }
};

exports.resolveCase = async (req, res) => {
    try {
        const { status, resolutionNotes } = req.body;

        const updatedCase = await Case.findOneAndUpdate(
            { _id: req.params.id, business: req.businessId },
            {
                status,
                resolutionNotes,
                resolvedAt: new Date(),
                assignedTo: req.user._id // The staff member logged in
            },
            { new: true }
        );

        res.json(response(200, updatedCase, "Case resolved successfully"));
    } catch (error) {
        res.json(response(500, null, error.message));
    }
};