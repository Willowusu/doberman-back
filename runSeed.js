const mongoose = require('mongoose');
const { seedDefaultRules } = require('./utils/ruleSeeder');

mongoose.connect('mongodb://localhost:27017/doberman').then(async () => {
    console.log("Connected to DB...");

    // Ensure this is a valid ObjectId
    const businessId = new mongoose.Types.ObjectId('69683b5e7c54697e4c1041db');

    try {
        const results = await seedDefaultRules(businessId);
        console.log(`Successfully seeded ${results.length} rules!`);
    } catch (err) {
        console.error("Seeding failed:", err);
    } finally {
        process.exit();
    }
});