const response = require('../services/response');
const List = require('../models/list');
const { logAction } = require('../middlewares');


exports.createList = async (req, res) => {
    try {
        const { listType, entityType, value, reason } = req.body;

        const business = req.session.businessId;

        // 1. Check if this exact value already exists for this business
        const existingEntry = await List.findOne({ business, entityType, value });
        if (existingEntry) {
            return res.status(400).json(response(400, null, 'Entity already exists in a list for this business'));
        }

        const newList = new List({ business, listType, entityType, value, reason });
        await newList.save();

        // --- AUDIT LOG ENTRY ---
        // Crucial: Log exactly WHAT was listed, the TYPE (Black/White), and the REASON
        await logAction(req, 'ADD_TO_LIST', 'Access Control', {
            listType, // e.g., BLACKLIST
            entityType, // e.g., IP_ADDRESS
            entityValue: value,
            reason: reason
        });

        res.status(201).json(response(201, newList, 'List created successfully'));
    } catch (error) {
        console.error('Error creating list:', error);
        res.status(500).json(response(500, null, 'Internal Server Error'));
    }
}

exports.getLists = async (req, res) => {
    try {
        const businessId = req.session.businessId;

        if (!businessId) {
            return res.json(response(401, null, "Unauthorized: No business context found"));
        }

        // Query only for documents matching this specific business
        const events = await List.find({ business: businessId })
            .sort({ createdAt: -1 })
            .limit(50);

        // OPTIONAL: Log that an analyst viewed the block/allow lists
        await logAction(req, 'VIEW_LISTS', 'Access Control', {
            count: events.length
        });

        res.json(response(200, events, "Lists retrieved successfully"));
    } catch (error) {
        res.json(response(500, null, "Error fetching rules"));
    }
};

// --- ADDED: Delete Logic with Logging ---
exports.deleteListEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.session.businessId;

        const deletedEntry = await List.findOneAndDelete({ _id: id, business: businessId });

        if (!deletedEntry) {
            return res.status(404).json(response(404, null, "Entry not found"));
        }

        // --- AUDIT LOG ENTRY ---
        // Removing someone from a blacklist is a major event
        await logAction(req, 'REMOVE_FROM_LIST', 'Access Control', {
            listType: deletedEntry.listType,
            entityValue: deletedEntry.value,
            originalReason: deletedEntry.reason
        });

        res.json(response(200, null, "Entry removed from list"));
    } catch (error) {
        res.status(500).json(response(500, null, "Internal Server Error"));
    }
};