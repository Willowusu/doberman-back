const axios = require('axios');

exports.checkSanctions = async (name) => {
    try {
        // Using the RPC endpoint for fuzzy matching (trigram similarity)
        const response = await axios.get(`https://api.sanctions.network/rpc/search_sanctions`, {
            params: { name: name }
        });


        // If the array has items, we found a match (potential PEP/Sanctioned entity)
        return { data: response.data, found: response.data.length > 0 }
    } catch (error) {
        console.error("Sanctions API Error:", error.message);
        return false; // Default to false to avoid blocking registration on API down, or true if you want to be "strict"
    }
};