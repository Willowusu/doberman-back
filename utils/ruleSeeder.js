const Rule = require('../models/rule');

/**
 * Seeds a comprehensive set of 16 default JUNI AML and Fraud rules for a business.
 * @param {string} businessId - The MongoDB ObjectId of the business.
 */
exports.seedDefaultRules = async (businessId) => {
    try {
        // 1. Check if rules already exist
        const existingCount = await Rule.countDocuments({ business: businessId });
        if (existingCount > 0) {
            console.log(`[RuleSeeder]: Business ${businessId} already has rules. Skipping...`);
            return [];
        }

        const defaultRules = [
            // --- 1. TECHNICAL FRAUD & BLACKLISTS ---
            {
                business: businessId,
                name: "Global Blacklist Check",
                description: "Declines if IP, Email, Device, or Phone is on the central blacklist.",
                severity: "CRITICAL",
                action: "DECLINE",
                score: 100,
                isActive: true,
                logic: {
                    "or": [
                        { "in_list": [{ "var": "user.userEmail" }, "BLACKLIST", { "var": "internal.listHits" }] },
                        { "in_list": [{ "var": "ipAddress" }, "BLACKLIST", { "var": "internal.listHits" }] },
                        { "in_list": [{ "var": "deviceId" }, "BLACKLIST", { "var": "internal.listHits" }] },
                        { "in_list": [{ "var": "user.userPhone" }, "BLACKLIST", { "var": "internal.listHits" }] }
                    ]
                }
            },
            {
                business: businessId,
                name: "Suspicious Proxy/VPN",
                description: "Flags transactions using high-risk IP types (VPNs/Datacenters).",
                severity: "MEDIUM",
                action: "REVIEW",
                score: 25,
                isActive: true,
                logic: { "==": [{ "var": "enrichedData.ipDetails.isProxy" }, true] }
            },

            // --- 2. JUNI AML VOLUME & SURGE RULES ---
            {
                business: businessId,
                name: "AML-111: Sudden Surge in Activity",
                description: "MTO/Business daily volume > 1.5x of the 3-month daily average.",
                severity: "HIGH",
                action: "REVIEW",
                score: 60,
                isActive: true,
                logic: { ">": [{ "var": "metrics.currentDayVolume" }, { "*": [{ "var": "metrics.threeMonthDailyAvg" }, 1.5] }] }
            },
            {
                business: businessId,
                name: "AML-112: Structuring / Reporting Limit 1",
                description: "Sender/Entity attempting transactions just below thresholds (9k-10k).",
                severity: "HIGH",
                action: "BLOCK",
                score: 50,
                isActive: true,
                logic: {
                    "and": [
                        { ">=": [{ "var": "payload.amount" }, 9000] },
                        { "<=": [{ "var": "payload.amount" }, 10000] },
                        {
                            ">=": [
                                { "if": [{ "var": "internal.isRemittance" }, { "var": "metrics.senderFifteenDaySum" }, { "var": "metrics.fifteenDaySum" }] },
                                10000
                            ]
                        }
                    ]
                }
            },
            {
                business: businessId,
                name: "AML-113: Quick Drainage (FIFO)",
                description: "Cumulative credit followed by 80% debit drainage within 5 days.",
                severity: "HIGH",
                action: "REVIEW",
                score: 60,
                isActive: true,
                logic: {
                    "and": [
                        { ">": [{ "var": "metrics.dailyCredit" }, { "*": [{ "var": "metrics.dailyAverage" }, 1.5] }] },
                        { ">=": [{ "var": "metrics.fiveDayDebitSum" }, { "*": [{ "var": "metrics.dailyCredit" }, 0.8] }] }
                    ]
                }
            },

            // --- 3. PATTERN & BEHAVIORAL RULES ---
            {
                business: businessId,
                name: "AML-114: Repeat Similar Deposits",
                description: "More than 3 deposits of similar amounts (>500 GHS) within 5 days.",
                severity: "MEDIUM",
                action: "REVIEW",
                score: 40,
                isActive: true,
                logic: {
                    "and": [
                        { ">=": [{ "var": "metrics.similarAmountCount5d" }, 3] },
                        { ">=": [{ "var": "payload.amount" }, 500] }
                    ]
                }
            },
            {
                business: businessId,
                name: "AML-115: Multiple Large Credits",
                description: "Multiple credits (>2) in 5 days totaling > 1x daily average.",
                severity: "MEDIUM",
                action: "REVIEW",
                score: 40,
                isActive: true,
                logic: {
                    "and": [
                        { ">=": [{ "var": "metrics.creditCount5d" }, 2] },
                        { ">=": [{ "var": "metrics.cumulativeCredit5d" }, { "var": "metrics.dailyAverage" }] }
                    ]
                }
            },
            {
                business: businessId,
                name: "AML-116: Threshold Breach",
                description: "Cumulative 30-day amount above 1.5x monthly average.",
                severity: "HIGH",
                action: "REVIEW",
                score: 60,
                isActive: true,
                logic: { ">": [{ "var": "metrics.cumulative30d" }, { "*": [{ "var": "metrics.monthlyAverage" }, 1.5] }] }
            },
            {
                business: businessId,
                name: "AML-117: One to Many Transfer",
                description: "Funds sent to 6+ unique accounts within 5 days.",
                severity: "HIGH",
                action: "REVIEW",
                score: 60,
                isActive: true,
                logic: {
                    "and": [
                        { ">=": [{ "var": "metrics.uniqueOutboundCount5d" }, 6] },
                        {
                            ">=": [
                                { "var": "metrics.outboundSum5d" },
                                { "if": [{ "==": [{ "var": "customer.complianceData.busType" }, "Corporate"] }, 10000, 5000] }
                            ]
                        }
                    ]
                }
            },

            // --- 4. ACCOUNT LIFECYCLE RULES ---
            {
                business: businessId,
                name: "AML-118: New Account Credit Only",
                description: "Heavy credits on accounts less than 30 days old.",
                severity: "HIGH",
                action: "REVIEW",
                score: 60,
                isActive: true,
                logic: {
                    "and": [
                        { "<=": [{ "diff_days": [{ "var": "customer.createdAt" }, "now"] }, 30] },
                        { ">": [{ "var": "metrics.creditSum7d" }, { "*": [{ "var": "metrics.weeklyAverage" }, 0.01] }] }
                    ]
                }
            },
            {
                business: businessId,
                name: "AML-119: Irregular Deposits",
                description: "30-day cumulative deposits exceed 6-month monthly average.",
                severity: "HIGH",
                action: "REVIEW",
                score: 60,
                isActive: true,
                logic: {
                    "and": [
                        { ">": [{ "diff_months": [{ "var": "customer.createdAt" }, "now"] }, 6] },
                        { ">": [{ "var": "metrics.depositSum30d" }, { "var": "metrics.sixMonthAvg" }] }
                    ]
                }
            },
            {
                business: businessId,
                name: "AML-1110: Dormant Account Activity",
                description: "High-value activity immediately after dormancy reactivation.",
                severity: "CRITICAL",
                action: "REVIEW",
                score: 75,
                isActive: true,
                logic: {
                    "and": [
                        { "in": [{ "var": "metrics.previousStatus" }, ["Dormant", "Inactive"]] },
                        { "==": [{ "var": "customer.status" }, "Active"] },
                        { ">=": [{ "var": "payload.amount" }, 1000] }
                    ]
                }
            },

            // --- 5. IDENTITY & GEOGRAPHIC RULES ---
            {
                business: businessId,
                name: "AML-1111: Repeat Beneficiary",
                description: "More than 5 transfers to the same beneficiary in 30 days.",
                severity: "MEDIUM",
                action: "REVIEW",
                score: 40,
                isActive: true,
                logic: { ">=": [{ "var": "metrics.sameBeneficiaryCount30d" }, 5] }
            },
            {
                business: businessId,
                name: "AML-1112: Direct UBO/Director Match",
                description: "EXACT match between transaction party and MTO directors.",
                severity: "CRITICAL",
                action: "REVIEW",
                score: 85,
                isActive: true,
                logic: { "==": [{ "var": "internal.identityInfo.matchType" }, "EXACT"] }
            },
            {
                business: businessId,
                name: "AML-1112b: Family/Associate Link Detected",
                description: "Surname/Relative match between transaction party and MTO owners.",
                severity: "HIGH",
                action: "REVIEW",
                score: 45,
                isActive: true,
                logic: { "==": [{ "var": "internal.identityInfo.matchType" }, "RELATIVE"] }
            },
            {
                business: businessId,
                name: "AML-1113: Geographic Dispersion",
                description: "Branch deposit volume 30% higher than historical daily average.",
                severity: "MEDIUM",
                action: "REVIEW",
                score: 50,
                isActive: true,
                logic: { ">": [{ "var": "metrics.locationDailyAvg" }, { "*": [{ "var": "metrics.dailyAverage" }, 1.3] }] }
            },
            {
                business: businessId,
                name: "AML-1114: Sanctions List Match",
                description: "Sender or Recipient name matched against Global Watchlists.",
                severity: "CRITICAL",
                action: "BLOCK",
                score: 100,
                isActive: true,
                logic: { "==": [{ "var": "internal.sanctionsHit" }, true] }
            },
            {
                business: businessId,
                name: "AML-112: Structuring / Reporting Limit 2",
                description: "Sender/Entity attempting transactions just below thresholds (40k-50k).",
                severity: "HIGH",
                action: "BLOCK",
                score: 50,
                isActive: true,
                logic: {
                    "and": [
                        { ">=": [{ "var": "payload.amount" }, 40000] },
                        { "<=": [{ "var": "payload.amount" }, 50000] },
                        {
                            ">=": [
                                { "if": [{ "var": "internal.isRemittance" }, { "var": "metrics.senderFifteenDaySum" }, { "var": "metrics.fifteenDaySum" }] },
                                50000
                            ]
                        }
                    ]
                }
            },
            {
                business: businessId,
                name: "AML-1115: Convergence Smurfing (Many-to-One)",
                description: "3+ different senders sending to one beneficiary within 72 hours.",
                severity: "HIGH",
                action: "REVIEW",
                score: 65,
                isActive: true,
                logic: {
                    "and": [
                        { ">=": [{ "var": "metrics.uniqueSendersToBeneficiary72h" }, 3] },
                        { "==": [{ "var": "internal.isRemittance" }, true] }
                    ]
                }
            },

            // --- Rule 6 from your text: Rapid Cash-Out Behaviour (Enhanced) ---
            // Note: We already have AML-113 (FIFO), but this specifically targets the % of cash-out
            {
                business: businessId,
                name: "AML-1116: High-Velocity Pass-Through",
                description: "80% of inbound funds cashed out/transferred within 24 hours.",
                severity: "HIGH",
                action: "REVIEW",
                score: 60,
                isActive: true,
                logic: {
                    "and": [
                        { ">=": [{ "var": "metrics.dailyDebitRatio" }, 0.8] },
                        { ">": [{ "var": "metrics.currentDayVolume" }, 1000] } // Ignore tiny amounts
                    ]
                }
            },

            // --- Rule 8 from your text: Velocity Rule Spike ---
            {
                business: businessId,
                name: "AML-1117: Transaction Frequency Spike",
                description: "Transaction frequency increases 300% compared to 7-day baseline.",
                severity: "MEDIUM",
                action: "REVIEW",
                score: 50,
                isActive: true,
                logic: {
                    ">": [
                        { "var": "metrics.sevenDayFrequency" },
                        { "*": [{ "var": "metrics.sevenDayAvgFrequency" }, 3] }
                    ]
                }
            },
            {
                business: businessId,
                name: "AML-1201: FATF High-Risk Jurisdiction",
                description: "Automatic Critical flag for funds originating from North Korea, Iran, or Myanmar.",
                severity: "CRITICAL",
                action: "BLOCK",
                score: 100,
                isActive: true,
                logic: {
                    "in": [
                        { "var": "actors.senderCountry" },
                        ["KP", "IR", "MM"] // ISO-2 codes: North Korea, Iran, Myanmar
                    ]
                }
            },

            // --- Rule 2: FATF Increased Monitoring (Grey List) ---
            {
                business: businessId,
                name: "AML-1202: FATF Increased Monitoring",
                description: "Elevated risk for jurisdictions under increased monitoring (e.g., Nigeria, Kenya, Haiti).",
                severity: "HIGH",
                action: "REVIEW",
                score: 40,
                isActive: true,
                logic: {
                    "in": [
                        { "var": "actors.senderCountry" },
                        ["DZ", "AO", "BO", "BG", "CM", "CI", "CD", "HT", "KE", "LA", "LB", "MC", "NA", "NP", "SS", "SY", "VE", "VN", "VG", "YE", "NG", "ZA"]
                    ]
                }
            },

            // --- Rule 3: Geographic Anomaly (Corridor Mismatch) ---
            {
                business: businessId,
                name: "AML-1203: Corridor Mismatch Risk",
                description: "Sender's IP location does not match their declared Sender Country.",
                severity: "HIGH",
                action: "REVIEW",
                score: 45,
                isActive: true,
                logic: {
                    "and": [
                        { "==": [{ "var": "internal.isRemittance" }, true] },
                        { "!=": [{ "var": "enrichedData.ipDetails.countryCode" }, { "var": "actors.senderCountry" }] }
                    ]
                }
            },
            {
                business: businessId,
                name: "AML-112: Structuring / Reporting Limit 3",
                description: "Sender/Entity attempting transactions just below thresholds (1k-5k).",
                severity: "HIGH",
                action: "BLOCK",
                score: 50,
                isActive: true,
                logic: {
                    "and": [
                        { ">=": [{ "var": "payload.amount" }, 1000] },
                        { "<=": [{ "var": "payload.amount" }, 10000] },
                        { "==": [{ "var": "metrics.countryRiskTier" }, 1] },
                        {
                            ">=": [
                                { "if": [{ "var": "internal.isRemittance" }, { "var": "metrics.senderFifteenDaySum" }, { "var": "metrics.fifteenDaySum" }] },
                                10000
                            ]
                        }
                    ]
                }
            },
            {
                business: businessId,
                name: "AML-1301: Beneficiary Convergence (Mule Marker)",
                description: "Beneficiary receiving funds from 3+ unrelated senders within 72 hours.",
                severity: "CRITICAL",
                action: "REVIEW",
                score: 80,
                isActive: true,
                logic: {
                    "and": [
                        { "==": [{ "var": "internal.isRemittance" }, true] },
                        { ">=": [{ "var": "metrics.uniqueSendersToBeneficiary72h" }, 3] }
                    ]
                }
            },

            // --- Rule 2: Pass-Through Mule (Rapid Inbound -> Immediate Cash-Out) ---
            {
                business: businessId,
                name: "AML-1302: Rapid Pass-Through (Mule Marker)",
                description: "85% of inbound funds cashed out or transferred within 4 hours.",
                severity: "HIGH",
                action: "REVIEW",
                score: 70,
                isActive: true,
                logic: {
                    "and": [
                        { ">=": [{ "var": "metrics.passThroughRatio4h" }, 0.85] },
                        { ">": [{ "var": "metrics.currentDayVolume" }, 500] } // Ignore micro-transfers
                    ]
                }
            },

            // --- Rule 4: Multi-Corridor Mule (Cross-Border Aggregation) ---
            {
                business: businessId,
                name: "AML-1303: Multi-Corridor Aggregation",
                description: "Beneficiary receiving funds from 2+ different countries within 7 days.",
                severity: "HIGH",
                action: "REVIEW",
                score: 65,
                isActive: true,
                logic: {
                    "and": [
                        { ">=": [{ "var": "metrics.uniqueCorridors7d" }, 2] },
                        { "==": [{ "var": "internal.isRemittance" }, true] }
                    ]
                }
            },

            // --- Rule 6: Dormant Mule Activation ---
            {
                business: businessId,
                name: "AML-1304: Dormant Account Mule Activation",
                description: "Previously dormant account (>30 days) suddenly receives multiple remittances.",
                severity: "CRITICAL",
                action: "REVIEW",
                score: 90,
                isActive: true,
                logic: {
                    "and": [
                        { "in": [{ "var": "metrics.previousStatus" }, ["Dormant", "Inactive"]] },
                        { ">=": [{ "var": "metrics.senderDailyTransactionCount" }, 2] }
                    ]
                }
            },
            {
                business: businessId,
                name: "AML-1401: TF - Conflict Zone & Donation Narrative",
                description: "Transaction involving conflict zones (Tier 1) with 'aid/support' narratives.",
                severity: "CRITICAL",
                action: "REVIEW",
                score: 95,
                isActive: true,
                logic: {
                    "and": [
                        { "==": [{ "var": "metrics.conflictRiskTier" }, 1] },
                        {
                            "or": [
                                { "contains_any": [{ "var": "payload.description" }, ["donation", "support", "aid", "help", "charity", "zakat"]] },
                                { "<=": [{ "var": "payload.amount" }, 500] } // Small amounts are TF indicators
                            ]
                        }
                    ]
                }
            },

            // --- Rule PF-3: Dual-Use Goods (Proliferation Financing) ---
            {
                business: businessId,
                name: "AML-1501: PF - Dual-Use Goods Indicators",
                description: "Narratives suggesting industrial, chemical, or military-adjacent procurement.",
                severity: "CRITICAL",
                action: "BLOCK",
                score: 100,
                isActive: true,
                logic: {
                    "contains_any": [
                        { "var": "payload.description" },
                        ["chemical", "machinery", "electronics", "circuit", "industrial", "laboratory", "reactor", "isotope"]
                    ]
                }
            },

            // --- Rule PF-1: Proliferation Sensitive Jurisdictions ---
            {
                business: businessId,
                name: "AML-1502: PF - Sensitive Jurisdiction Outreach",
                description: "Direct or indirect link to jurisdictions associated with WMD programs.",
                severity: "CRITICAL",
                action: "BLOCK",
                score: 100,
                isActive: true,
                logic: {
                    "in": [
                        { "var": "actors.senderCountry" },
                        ["KP", "IR", "SY", "RU"] // High-risk PF jurisdictions
                    ]
                }
            }
        ];

        const insertedRules = await Rule.insertMany(defaultRules);
        console.log(`[RuleSeeder]: Successfully seeded ${insertedRules.length} rules for business ${businessId}`);
        return insertedRules;

    } catch (error) {
        console.error(`[RuleSeeder]: Error seeding rules:`, error);
        throw error;
    }
};