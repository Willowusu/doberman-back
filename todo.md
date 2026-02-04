1. Create an audit log model - log_id, admin_user_id: Who did it?, action_type: RULE_MODIFIED, MANUAL_OVERRIDE, LIST_ENTRY_ADDED., target_id: The ID of the rule, event, or list entry that was changed., before_value / after_value: (JSON) To show exactly what changed, timestamp
2. Create apermission and role model - Roles Table: role_name, description. Permissions Table: permission_slug (e.g., events.read, rules.delete, lists.write, decisions.override).
3. Create a case model - When an event isn't 100% fraud but looks "suspicious," it goes to a human. Fields: case_id, event_id, status (Open, Under Investigation, Closed), assigned_agent_id.
4. Instead of storing all ipaddresses use a bloom filter to perform logic
5. This is how i expect the raw data to be given for easy rule setup and i also need to have all amounts as the least value of the currency(original amount must be multiplied by 100):
```
{
  "user": {
    "userId": "cust_998877",
    "userEmail": "borrower@example.com",
    "userPhone": "+233240000000",
    "userNameFull": "Kofi Mensah",
    "userDob": "1990-05-15",
    "userCreatedAt": "2023-10-01T10:00:00Z",
    "userType": "individual" 
    "userIp": "154.161.33.107"
  },
  "transaction": {
    "txId": "tx_550e8400",
    "txAmount": 150000,
    "txCurrency": "GHS",
    "txType": "loan_disbursement",
    "txMethod": "mobile_money",
    "txStatus": "pending"
  },
  "payment": {
    "paymentCardBin": "411111",
    "paymentCardHash": "e3b0c44298fc1c149afbf4c8996fb92427ae...",
    "paymentBankName": "Standard Chartered",
    "paymentBankAccountHash": "f89db029...",
    "paymentMomoProvider": "mtn"
  },
  "transfer": {
    "transferSenderCountry": "GH",
    "transferReceiverCountry": "NG",
    "transferReceiverId": "rec_001122",
    "transferReceiverName": "Chidi Okoro"
  },
  "customFields": {
    "loanTenureMonths": 6,
    "statedMonthlyIncome": 500000,
    "purposeOfFunds": "business_expansion"
  }
}
```
6. A section where we can tell the risk of the customer during the onboarding stage - live risk assessment
7. A section for Key risk indicators where this can run a full risk assessment of the system
8. Add Tax Identification Number and Business Incorporation Number