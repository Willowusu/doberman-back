// require('dotenv').config();
// const fs = require('fs');
// const readline = require('readline');
// const mongoose = require('mongoose');
// const Pep = require('./models/pep'); // Path to your model

// const FILE_PATH = './peplist/senzing.json';
// const BATCH_SIZE = 1000;

// async function importPepData() {
//     try {
//         await mongoose.connect(process.env.DATABASE_URL);
//         console.log("Connected to MongoDB...");

//         const rl = readline.createInterface({
//             input: fs.createReadStream(FILE_PATH),
//             crlfDelay: Infinity
//         });

//         let batch = [];
//         let count = 0;

//         for await (const line of rl) {
//             if (!line.trim()) continue;

//             const record = JSON.parse(line);

//             // Transform the Senzing structure to our Schema
//             const transformed = {
//                 recordId: record.RECORD_ID,
//                 recordType: record.RECORD_TYPE,
//                 dataSource: record.DATA_SOURCE,
//                 fullName: record.NAMES?.find(n => n.NAME_TYPE === "PRIMARY")?.NAME_FULL ||
//                     record.NAMES?.[0]?.NAME_FULL || record.NAMES?.[0]?.NAME_ORG,
//                 aliases: record.NAMES?.filter(n => n.NAME_TYPE === "ALIAS").map(n => n.NAME_FULL || n.NAME_ORG),
//                 countries: record.COUNTRIES?.map(c => c.NATIONALITY?.toUpperCase()),
//                 category: record.RISKS?.[0]?.TOPIC?.replace('role.', '').toUpperCase() || "PEP",
//                 dates: record.DATES || [],
//                 addresses: record.ADDRESSES || [],
//                 sourceLinks: record.SOURCE_LINKS?.map(l => l.SOURCE_URL),
//                 url: record.URL,
//                 lastChange: record.LAST_CHANGE ? new Date(record.LAST_CHANGE) : null
//             };

//             batch.push({
//                 updateOne: {
//                     filter: { recordId: transformed.recordId },
//                     update: { $set: transformed },
//                     upsert: true // Insert if new, update if exists
//                 }
//             });

//             if (batch.length >= BATCH_SIZE) {
//                 await Pep.bulkWrite(batch);
//                 count += batch.length;
//                 console.log(`Imported ${count} records...`);
//                 batch = [];
//             }
//         }

//         // Catch any remaining records
//         if (batch.length > 0) {
//             await Pep.bulkWrite(batch);
//             count += batch.length;
//         }

//         console.log(`Success! Total records processed: ${count}`);
//         process.exit(0);

//     } catch (err) {
//         console.error("Import failed:", err);
//         process.exit(1);
//     }
// }

// importPepData();

require('dotenv').config();
const mongoose = require('mongoose');
const Pep = require('./models/pep'); // Ensure this path is correct

async function clearPepCollection() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.DATABASE_URL);

        console.log("Starting deletion of all PEP records...");

        // deleteMany({}) targets every document in the collection
        const result = await Pep.deleteMany({});

        console.log(`Successfully deleted ${result.deletedCount} records.`);
        console.log("Your Atlas storage space should update shortly.");

        process.exit(0);
    } catch (err) {
        console.error("Error clearing collection:", err);
        process.exit(1);
    }
}

clearPepCollection();