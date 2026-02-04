const response = require('../services/response');
const { logAction } = require('../middlewares');


exports.checkAuth = (req, res) => {
    if (req.session.userId) {
        return res.json(response(200, { authenticated: true }, "Authorized"));
    }
    res.json(response(401, { authenticated: false }, "Unauthorized"));
};

exports.logout = async (req, res) => {
    // LOG: Data Access
    // It is important to know who viewed the master event list for audit compliance.
    await logAction(req, 'LOGOUT_SUCCESS', 'Authentication', {
        
    });
    req.session.destroy((err) => {
        if (err) {
            return res.json(response(500, null, "Could not log out"));
        }
        res.clearCookie('connect.sid'); // Or whatever your session cookie name is

        res.json(response(200, null, "Logged out successfully"));
    });
};