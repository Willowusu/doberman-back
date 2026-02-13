const nodemailer = require("nodemailer");

require('dotenv').config();

// Create a transporter object using your SMTP details
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use 'gmail' or specify your custom SMTP host
    auth: {
        user: process.env.NODEMAILER_EMAIL, // Your email address
        pass: process.env.NODEMAILER_PASSWORD // Your generated app password
    }
});

const html = (loginUrl) => {
    return `
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* Modern Reset & Base */
        body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #0f172a; /* Dark sleek background */
            /* Dotted Background Pattern */
            background-image: radial-gradient(#334155 1px, transparent 1px);
            background-size: 24px 24px;
            color: #f8fafc;
        }

        .wrapper { width: 100%; padding: 40px 0; }

        .content {
            max-width: 500px;
            background-color: #ffffff;
            margin: 0 auto;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
            border-top: 6px solid #10b981; /* Neon Mint Pop */
        }

        .header {
            padding: 40px 40px 20px;
            text-align: left;
        }

        .header .logo {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #1e293b;
            text-decoration: none;
            text-transform: uppercase;
        }

        .body-content { padding: 0 40px 40px; text-align: left; }

        h1 {
            color: #0f172a;
            font-size: 28px;
            font-weight: 800;
            margin: 0 0 16px;
            letter-spacing: -0.025em;
        }

        p {
            color: #475569;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 32px;
        }

        .button {
            background-color: #6366f1; /* Electric Indigo */
            border-radius: 8px;
            color: #ffffff !important;
            display: inline-block;
            font-size: 16px;
            font-weight: 600;
            padding: 16px 32px;
            text-align: center;
            text-decoration: none;
            box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.4);
        }

        .footer {
            text-align: center;
            padding: 30px;
            font-size: 13px;
            color: #94a3b8;
        }

        .link-fallback {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #f1f5f9;
            font-size: 12px;
            word-break: break-all;
            color: #94a3b8;
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="content">
            <div class="header">
                <a href="#!" class="logo">Risk<span style="color: #6366f1;">Guard</span></a>
            </div>
            <div class="body-content">
                <h1>Authentication Required.</h1>
                <p>Verify your identity to access your RiskGuard dashboard. This magic link is active for the next <b>10 minutes</b>.</p>

                <a href="${loginUrl}" class="button">Verify & Login</a>
                
                <div class="link-fallback">
                    Trouble with the button? Copy this into your browser:<br>
                    <a href="${loginUrl}" style="color: #6366f1; text-decoration: none;">${loginUrl}</a>
                </div>
            </div>
        </div>
        <div class="footer">
            <p>&copy; 2026 RiskGuard Terminal. Secured via AES-256.<br>
            If you didn't request this, your account is still safe—just ignore us.</p>
        </div>
    </div>
</body>
</html>`
} 

// Function to send an email
const sendEmail = (to, subject, text, url) => {
    const mailOptions = {
        from: '"RiskGuard" <your-email@gmail.com>', // Sender address
        to: to, // List of recipients
        subject: subject, // Subject line
        text: text, // Plain text body
        html: html(url) // HTML body
    };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
};

module.exports = {
    sendEmail
};

// Example usage
// sendEmail('recipient-email@example.com', 'Test Subject', 'Hello world?', '<b>Hello world?</b>');