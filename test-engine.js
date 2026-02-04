const jsonLogic = require('json-logic-js');

// 1. REGISTER THE CUSTOM OPERATOR (The code from your Service)
jsonLogic.add_operation("in_list", (value, listType, listHits) => {
    if (!listHits || !Array.isArray(listHits)) return false;
    return listHits.some(item => item.value === value && item.listType === listType);
});

// 2. MOCK DATA (Your Sample Event + Enriched Data)
const mockEvent = {
    ipAddress: "154.161.33.107", // This is in our Blacklist
    deviceId: "1234567890",
    rawData: {
        user: { userEmail: "customer@example.com", userPhone: "233244123456" },
        transaction: { txAmount: 25000, txMethod: "mobile_money" }
    },
    enrichedData: {
        ipDetails: { is_proxy: false },
        emailDetails: { is_disposable: false }
    }
};

// 3. MOCK DATABASE (Your Blacklist Hits & Seeded Rules)
const mockListHits = [
    { value: "154.161.33.107", listType: "BLACKLIST", entityType: "ip" }
];

const mockRules = [
    {
        name: "Global Blacklist Check",
        score: 100,
        logic: {
            "or": [
                { "in_list": [{ "var": "rawData.user.userEmail" }, "BLACKLIST", { "var": "internal.listHits" }] },
                { "in_list": [{ "var": "ipAddress" }, "BLACKLIST", { "var": "internal.listHits" }] }
            ]
        }
    },
    {
        name: "High Value Non-Momo",
        score: 50,
        logic: {
            "and": [
                { ">": [{ "var": "rawData.transaction.txAmount" }, 10000] },
                { "!=": [{ "var": "rawData.transaction.txMethod" }, "mobile_money"] }
            ]
        }
    }
];

// 4. SIMULATE THE ENGINE
async function runTest() {
    console.log("--- Starting Decision Engine Test ---");

    let totalScore = 0;
    let triggered = [];

    // Prepare data pool exactly like your runEventDecision function
    const dataPool = {
        ...mockEvent,
        internal: { listHits: mockListHits }
    };

    mockRules.forEach(rule => {
        const isMatch = jsonLogic.apply(rule.logic, dataPool);
        if (isMatch) {
            totalScore += rule.score;
            triggered.push({ name: rule.name, score: rule.score });
        }
    });

    // Final Logic
    const status = totalScore >= 80 ? "DECLINE" : (totalScore >= 30 ? "REVIEW" : "APPROVE");

    console.log("RESULT:");
    console.log("- Status:", status);
    console.log("- Total Score:", totalScore);
    console.log("- Rules Triggered:", triggered.length > 0 ? triggered : "None");
}

runTest();