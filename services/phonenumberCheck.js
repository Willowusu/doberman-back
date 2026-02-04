require('dotenv').config();
const axios = require('axios');

exports.phonenumberDetails = async (phoneNumber) => {
    try {
        if (!phoneNumber) {
            return null;
        }
        // http://apilayer.net/api/validate? access_key = 4b43f877d5b6878b728897f2980e6c91&number=233557079838&country_code=&format = 1

        let response = await axios.get(`http://apilayer.net/api/validate`, {
            params: {
                number: phoneNumber,
                //TODO: Replace with your apilayer API key
                access_key: process.env.PHONE_VALIDATION_API_KEY,
                format: 1
            }
        })

        const data = response.data;

        let details = data
        return details;


    } catch (error) {
        console.error('Error validating phone number:', error);
        return { valid: false, message: 'Error validating phone number' };
    }
}