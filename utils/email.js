const sendEmail = async (email, subject, htmlContent) => {
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
                    email: process.env.SENDER_EMAIL 
                },
                to: [{ email: email }],
                subject: subject, // Now dynamic!
                htmlContent: htmlContent // Now dynamic!
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Brevo API Error:", errorData);
            throw new Error("Could not send email.");
        }
    } catch (error) {
        console.error("Error sending email:", error);
        throw new Error("Could not send email.");
    }
};

module.exports = sendEmail;