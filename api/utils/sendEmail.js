const nodemailer = require('nodemailer');

const sendEmail = async (email, subject, text) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail', // handles the host/port for the project automatically
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS, // The App Password
            },
        });

        await transporter.sendMail({
            from: `"Girumdom Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: subject,
            text: text,
        });

        console.log("Email sent successfully");
    } catch (error) {
        console.error("Email not sent:", error);
    }
};

module.exports = sendEmail;