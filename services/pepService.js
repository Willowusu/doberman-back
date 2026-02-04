const Pep = require('../models/pep');

exports.searchPepList = async (searchName) => {
    try {
        // 1. Clean and tokenize the search name
        const searchTokens = searchName.trim().split(/\s+/).filter(t => t.length > 0);

        // 2. Create a regex that ensures ALL tokens are present (Fuzzy/Order Agnostic)
        // This converts "John Mahama" into /(?=.*john)(?=.*mahama)/i
        const regexString = searchTokens.map(token => `(?=.*${token})`).join('');
        const fuzzyRegex = new RegExp(regexString, 'i');

        // 3. Query the Database
        const matches = await Pep.find({
            $or: [
                { fullName: { $regex: fuzzyRegex } },
                { aliases: { $regex: fuzzyRegex } }
            ]
        })
            .limit(50) // Prevent overwhelming the UI
            .lean();   // Returns plain JS objects (faster than Mongoose Documents)

        // 4. Transform for the Frontend
        return matches.map(record => ({
            recordId: record.recordId,
            recordType: record.recordType,
            dataSource: record.dataSource,
            fullName: record.fullName,
            aliases: record.aliases,
            // Map ISO codes to Names using our mapper if needed
            country: record.countries?.[0] || "UNKNOWN",
            category: record.category,
            dates: record.dates,
            addresses: record.addresses,
            sourceLinks: record.sourceLinks,
            url: record.url,
            lastUpdated: record.lastChange
        }));

    } catch (error) {
        console.error("MongoDB PEP Search Error:", error);
        throw error;
    }
};