const response = require('../services/response');
const SystemUser = require('../models/SystemUser');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { logAction } = require('../middlewares');


exports.createSystemUser = async (req, res) => {
    try {
        const { name, email, phone, business, role } = req.body;

        const newSystemUser = new SystemUser({
            name,
            email,
            phone,
            business,
            role
        });

        await newSystemUser.save()

        // LOG: Team Member Created
        await logAction(req, 'CREATE_USER', 'Team Management', {
            targetUser: email,
            assignedRole: role
        });

        res.json(response(201, newSystemUser, 'System User created successfully'));
    } catch (error) {
        console.error('Error creating system user:', error);
        res.json(response(500, null, 'Internal Server Error'));
    }
}


exports.sendMagicLink = async (req, res) => {
    try {
        const { email } = req.body;
        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 15 * 60 * 1000; // 15 mins

        // 1. Save token, email, and expiry to your DB
        let user = await SystemUser.findOneAndUpdate({ email }, { magicToken: token, tokenExpires: expires });

        if (!user) {
            return res.json(response(404, null, 'User not found'));
        }

        // LOG: Magic Link Sent
        // We log the business ID from the user object since session isn't set yet
        await logAction({
            user: { _id: user._id },
            session: { businessId: user.business },
            ip: req.ip, headers: req.headers
        }, 'LOGIN_REQUESTED', 'Authentication', { method: 'Magic Link' });

        // 2. Send Email
        const magicLink = `http://localhost:5173/verify?token=${token}`;
        console.log(`Magic link for ${email}: ${magicLink}`);
        // await mailer.sendMail({
        //     to: email,
        //     subject: "Your Login Link",
        //     html: `<a href="${magicLink}">Click here to log in</a>`
        // });

        
        res.json(response(200, null, 'Magic link sent successfully'));
    }
    catch (error) {
        console.error('Error sending magic link:', error);
        res.json(response(500, null, 'Internal Server Error'));
    }
};

exports.verifyMagicLink = async (req, res) => {
    try {
        const { token } = req.body;
        const user = await SystemUser.findOne({
            magicToken: token,
            tokenExpires: { $gt: Date.now() }
        });


        if (!user) {
            return res.json(response(400, null, 'Invalid or expired token'));
        }

        // 1. Clear token immediately (One-time use)
        user.magicToken = null;
        user.tokenExpires = null;
        await user.save();

        // 2. Prepare Session
        req.session.tempUserId = user._id;


        // 3. Determine if they are 'Logging in' or 'Setting up'
        const hasMFA = !!user.mfaSecret;

        if (hasMFA) {
            req.session.mfaStatus = 'PENDING_VERIFICATION';
        } else {
            req.session.mfaStatus = 'PENDING_SETUP';
        }

        // LOG: Magic Link Verification
        await logAction({
            user: { _id: user._id },
            session: { businessId: user.business },
            ip: req.ip, headers: req.headers
        }, 'MAGIC_LINK_VERIFIED', 'Authentication', { mfaRequired: hasMFA });

        // 4. Return clear flags to frontend
        res.json(response(200, {
            hasMFA: hasMFA
        }, '2fa_required'));
    }
    catch (error) {
        console.error('Error verifying magic link:', error);
        res.json(response(500, null, 'Internal Server Error'));
    }
}

exports.generateMfa = async (req, res) => {
    const tempUserId = req.session.tempUserId;
    try {
        // 1. Ensure the user has passed the magic link step
        if (!tempUserId) {
            return res.json(response(401, null, "Unauthorized. Please use your magic link first."));
        }

        let user = await SystemUser.findById(tempUserId).populate('business');


        // 2. Generate a unique secret for this user
        // 'name' is what the user sees in their Google Authenticator app
        const secret = speakeasy.generateSecret({
            name: `RiskGuard (${user.business.name || 'User'})`
        });

        // 3. Store the secret in the SESSION temporarily
        // We don't save to DB until they prove they can scan it
        req.session.tempSecret = secret.base32;

        // 4. Generate the QR Code Data URL
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        // 5. Send the QR code to the EJS frontend
        res.json(response(200, { qrCodeUrl, manualCode: secret.base32 }, '2FA generated successfully'));

    } catch (error) {
        console.error('2FA Generation Error:', error);
        res.json(response(500, null, "Error generating 2FA"));
    }
};

exports.confirmMfaSetup = async (req, res) => {
    try {
        const { code } = req.body;
        const tempSecret = req.session.tempSecret; // Recover the secret we just generated
        const userId = req.session.tempUserId;

        if (!tempSecret || !userId) {
            return res.json(response(401, null, "Session expired. Restart login."));
        }

        // Verify the code against the temporary secret
        const verified = speakeasy.totp.verify({
            secret: tempSecret,
            encoding: 'base32',
            token: code
        });


        if (verified) {
            // 1. Save the secret to the DB permanently now
            let user = await SystemUser.findByIdAndUpdate(userId, {
                mfaSecret: tempSecret,
                mfaEnabled: true // Set your flag to true
            });

            // LOG: MFA SETUP COMPLETE
            await logAction({
                user: { _id: userId },
                session: { businessId: user.business },
                ip: req.ip, headers: req.headers
            }, 'MFA_SETUP_SUCCESS', 'Security', { type: 'TOTP' });

            // 2. Promote session to "Fully Logged In"
            req.session.userId = userId;
            req.session.businessId = user.business;
            req.session.mfaStatus = null; // Clear the pending status
            delete req.session.tempSecret;
            delete req.session.tempUserId;

            return res.json(response(200, null, "2FA Enabled successfully"));
        } else {
            return res.json(response(400, null, "Invalid code. Please try again."));
        }
    } catch (error) {
        res.json(response(500, null, "Internal Server Error"));
    }
};

exports.verifyMfa = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.session.tempUserId;

        if (!userId) {
            console.log("here 1")
            return res.json(response(401, null, "Session expired. Please log in again."));
        }

        // 1. Fetch the user and their SAVED secret
        const user = await SystemUser.findById(userId);
        if (!user || !user.mfaSecret) {
            console.log("here 2")
            return res.json(response(400, null, "2FA not set up for this user."));
        }

        // 2. Verify the code using speakeasy
        const verified = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token: code
        });


        if (verified) {
            // LOG: LOGIN COMPLETE
            await logAction({
                user: { _id: user._id },
                session: { businessId: user.business },
                ip: req.ip, headers: req.headers
            }, 'LOGIN_SUCCESS', 'Authentication', { method: '2FA' });
            // 3. Promote to full session
            req.session.userId = user._id;
            req.session.businessId = user.business;

            // Clean up temporary session variables
            delete req.session.tempUserId;
            delete req.session.mfaPending;

            return res.json(response(200, null, "Login successful"));
        } else {
            // LOG: FAILED MFA
            await logAction({
                user: { _id: user._id },
                session: { businessId: user.business },
                ip: req.ip, headers: req.headers
            }, 'LOGIN_FAILURE', 'Authentication', { reason: 'Invalid 2FA code' }, 'FAILURE');
            return res.json(response(400, null, "Invalid 2FA code"));
        }
    } catch (error) {
        res.json(response(500, null, "Internal Server Error"));
    }
};