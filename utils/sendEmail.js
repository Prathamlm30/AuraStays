const nodemailer = require("nodemailer");

const sendSecurityEmail = async (options) => {
    // 1. Create the Transporter (The Engine)
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, // true for 465, false for other ports like 587
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    // 2. Define the Email Blueprint
    const mailOptions = {
        from: '"AuraStays Security" <security@aurastays.com>', // The sender name
        to: options.email,                                     // The user's email
        subject: options.subject,                              // Email Subject line
        html: options.message,                                 // The actual HTML message
    };

    // 3. Execute the Delivery
    await transporter.sendMail(mailOptions);
};

module.exports = sendSecurityEmail;