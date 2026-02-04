const response = (statusCode, data = null, message = '') => {
    return {
        statusCode,
        data,
        message
    };
}

module.exports = response;