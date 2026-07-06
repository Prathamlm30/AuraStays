const sendOTP = async (email, otp) => {
    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': process.env.BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { 
                    name: "AuraStays Security", 
                    email: process.env.SENDER_EMAIL // Pulled securely from your environment variables
                },
                to: [{ email: email }], // The email the user typed into your sign-up form
                subject: "Verify Your AuraStays Account",
                htmlContent: `
                <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                    <h2>Welcome to AuraStays!</h2>
                    <p>Your 6-digit verification code is:</p>
                    <h1 style="color: #fe424d; letter-spacing: 5px;">${otp}</h1>
                    <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
                </div>
                `
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Brevo API Error:", errorData);
            throw new Error("Could not send verification email.");
        }

        console.log(`OTP sent successfully to ${email}`);
    } catch (error) {
        console.error("Error sending email:", error);
        throw new Error("Could not send verification email.");
    }
};

module.exports = sendOTP;