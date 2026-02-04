require('dotenv').config();
const axios = require('axios');

exports.emailDetails = async (email) => {
    try {
        if (!email) {
            return null;
        }
        //https://api.zeruh.com/v1/verify?api_key=9e4f97788b80c7f6a9e06307ad5b1ef003147fc78c4ae498ae0afafa340d857f&email_address=hello@zeruh.com
        let response = await axios.get(`https://api.zeruh.com/v1/verify`, {
            params: {
                //TODO: Replace with your Zeruh API key
                api_key: process.env.EMAIL_VALIDATION_API_KEY,
                email_address: email
            }
        });
        const data = response.data;
        if (data.success !== true) {
            return null;
        }
        let details = data.result
        return details;


    } catch (error) {
        console.error('Error fetching email details:', error);
        return null;
    }
}