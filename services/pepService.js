//This will be for when we move to production and want to use a real PEP database. For now, we will use the static JSON file in the frontend. 
// const Pep = require('../models/pep');

// exports.searchPepList = async (searchName) => {
//     try {
//         // 1. Clean and tokenize the search name
//         const searchTokens = searchName.trim().split(/\s+/).filter(t => t.length > 0);

//         // 2. Create a regex that ensures ALL tokens are present (Fuzzy/Order Agnostic)
//         // This converts "John Mahama" into /(?=.*john)(?=.*mahama)/i
//         const regexString = searchTokens.map(token => `(?=.*${token})`).join('');
//         const fuzzyRegex = new RegExp(regexString, 'i');

//         // 3. Query the Database
//         const matches = await Pep.find({
//             $or: [
//                 { fullName: { $regex: fuzzyRegex } },
//                 { aliases: { $regex: fuzzyRegex } }
//             ]
//         })
//             .limit(50) // Prevent overwhelming the UI
//             .lean();   // Returns plain JS objects (faster than Mongoose Documents)

//         // 4. Transform for the Frontend
//         return matches.map(record => ({
//             recordId: record.recordId,
//             recordType: record.recordType,
//             dataSource: record.dataSource,
//             fullName: record.fullName,
//             aliases: record.aliases,
//             // Map ISO codes to Names using our mapper if needed
//             country: record.countries?.[0] || "UNKNOWN",
//             category: record.category,
//             dates: record.dates,
//             addresses: record.addresses,
//             sourceLinks: record.sourceLinks,
//             url: record.url,
//             lastUpdated: record.lastChange
//         }));

//     } catch (error) {
//         console.error("MongoDB PEP Search Error:", error);
//         throw error;
//     }
// };


// this will be for uat 
const fs = require("fs");
const readline = require("readline");
const path = require("path");

exports.searchPepList = (searchName) => {
    return new Promise((resolve, reject) => {
        const matches = [];
        const filePath = path.join(__dirname, "../peplist/senzing.json");

        // 1. Prepare Fuzzy Regex (Same logic as your MongoDB function)
        const searchTokens = searchName.trim().split(/\s+/).filter(t => t.length > 0);
        if (searchTokens.length === 0) return resolve([]);

        const regexString = searchTokens.map(token => `(?=.*${token})`).join('');
        const fuzzyRegex = new RegExp(regexString, 'i');

        if (!fs.existsSync(filePath)) {
            return reject(new Error("PEP data file not found at " + filePath));
        }

        const rl = readline.createInterface({
            input: fs.createReadStream(filePath),
            crlfDelay: Infinity
        });

        rl.on("line", (line) => {
            if (!line.trim() || matches.length >= 50) return; // Respect the 50-match limit

            let record;
            try {
                record = JSON.parse(line);
            } catch (e) {
                return;
            }

            // 2. Extract Names and Aliases for searching
            // Senzing JSON usually puts the primary name in PRIMARY_NAME 
            // and others in the NAMES array
            const primaryName = record.PRIMARY_NAME || "";
            const otherNames = (record.NAMES || []).map(n => n.NAME_FULL || "").join(" ");
            const combinedNames = `${primaryName} ${otherNames}`;

            // 3. Perform the Regex Test
            if (fuzzyRegex.test(combinedNames)) {
                // 4. Transform to match your previous MongoDB output format
                matches.push({
                    recordId: record.RECORD_ID || record.DATA_ID,
                    recordType: record.RECORD_TYPE || "PERSON",
                    dataSource: record.DATA_SOURCE,
                    fullName: record.PRIMARY_NAME || (record.NAMES && record.NAMES[0]?.NAME_FULL),
                    aliases: (record.NAMES || []).map(n => n.NAME_FULL),
                    country: record.COUNTRY || (record.COUNTRIES && record.COUNTRIES[0]) || "UNKNOWN",
                    category: record.CATEGORY || "PEP",
                    dates: record.DATES || [],
                    addresses: record.ADDRESSES || [],
                    sourceLinks: record.SOURCE_LINKS || [],
                    url: record.URL || null,
                    lastUpdated: record.LAST_UPDATE_DATE || record.LAST_CHANGE
                });
            }
        });

        rl.on("close", () => {
            resolve(matches);
        });

        rl.on("error", (err) => {
            reject(err);
        });
    });
};