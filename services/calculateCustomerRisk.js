exports.calculateCustomerRisk = async (customer) => {
    const p = customer.riskProfile;
    let score = 0;

    // 1 & 2: Origination & Sign On
    score += (p.originationMethod === 'Solicited') ? 1 : 3;
    score += (p.isSignOnComplete) ? 1 : 3;

    // 3 & 4: ID Document & Verification
    score += (p.hasGhanaCard) ? 1 : 4;
    score += (p.isIdVerified) ? 1 : 4;

    // 5 & 6: Residency & Purpose
    score += (p.residencyStatus === 'Resident') ? 1 : 4;
    const purposeScores = { 'Collections': 1, 'Click2School': 1, 'Disbursements': 2 };
    score += purposeScores[p.purpose] || 1;

    // 7 & 8: Relationship & Nationality
    score += 2; // Fixed: Less than 3 years
    score += (p.nationality === 'Ghana') ? 1 : 4;

    // 9: Profession/Occupation (The "High Risk" List)
    const highRiskIndustries = ['Casinos', 'Betting', 'Precious Metals', 'Real Estate', 'NGOs', 'Cash-intensive'];
    if (p.isPep || highRiskIndustries.includes(p.industry)) {
        score += 4;
    } else {
        score += 1;
    }

    // 10: Product
    score += (p.productType === 'API Integration') ? 4 : 1;

    // 11: Expected Activity (GHS)
    if (p.expectedMonthlyVolume <= 5000) score += 1;
    else if (p.expectedMonthlyVolume <= 10000) score += 2;
    else if (p.expectedMonthlyVolume <= 20000) score += 3;
    else score += 4;

    // 12: Address
    if (p.locationZone === 'Tantra Hill') score += 1;
    else if (p.locationZone === 'Greater Accra') score += 2;
    else score += 3;

    // 13 & 15: RGD & Third Party
    const rgdScores = { 'Verified': 1, 'Identified but not verified': 2, 'Not identified': 4 };
    score += rgdScores[p.rgdStatus] || 4;

    const oversightScores = { 'Verified': 1, 'Obtained but not verified': 2, 'Not obtained': 4, 'Not required': 2 };
    score += oversightScores[p.thirdPartyOversight] || 2;

    // Final Categorization
    let rate, level;
    if (score <= 40) { rate = 1; level = 'Low Risk'; }
    else if (score <= 50) { rate = 2; level = 'Medium-Risk'; }
    else if (score <= 60) { rate = 3; level = 'Medium-high'; }
    else { rate = 4; level = 'High'; }


    return { totalScore: score, riskRate: rate, riskLevel: level };
}