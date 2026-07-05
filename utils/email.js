const nodemailer = require("nodemailer");

const sendOTP = async (email, otp) => {
    try {
        // Configure the transporter with your Gmail credentials
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Design the email
        const mailOptions = {
            from: `"AuraStays Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Verify Your AuraStays Account",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                    <h2>Welcome to AuraStays!</h2>
                    <p>Your 6-digit verification code is:</p>
                    <h1 style="color: #fe424d; letter-spacing: 5px;">${otp}</h1>
                    <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
                </div>
            `
        };

        // Send the email
        await transporter.sendMail(mailOptions);
        console.log(`OTP sent successfully to ${email}`);
        
    } catch (error) {
        console.error("Error sending email:", error);
        throw new Error("Could not send verification email.");
    }
};

module.exports = sendOTP;