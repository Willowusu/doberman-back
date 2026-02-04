require('dotenv').config();
const axios = require('axios');

exports.ipDetails = async (ip) => {
    try {

        if(!ip){
            return null;
        }

        // https://iplocate.io/api/lookup/8.8.8.8?apikey=YOUR_API_KEY"

        let response = await axios.get(`https://iplocate.io/api/lookup/${ip}`, {
            params: {
                //TODO: Replace with your IPLocate API key

                apikey: process.env.IP_VALIDATION_API_KEY
            }
        });
        

        const details = response.data;
        return details;

    } catch (error) {
        console.error('Error fetching IP details:', error);
        return null
    }
}


