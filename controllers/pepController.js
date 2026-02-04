const pepService = require('../services/pepService');
const response = require('../services/response');


exports.searchPep = async (req, res) => {
    try {
        const { name } = req.query;

        if (!name || name.length < 3) {
            return res.status(400).json(response(400, null, "Search name must be at least 3 characters."));
        }

        const results = await pepService.searchPepList(name);

        return res.status(200).json(response(200, {
            count: results.length,
            results: results
        }, "PEP search completed successfully"));

    } catch (error) {
        console.error("PEP Search Error:", error);
        return res.status(500).json(response(500, null, "Internal Server Error during PEP search."));
    }
};