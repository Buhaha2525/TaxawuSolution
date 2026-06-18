// src/services/email.service.js

const nodemailer = require("nodemailer");

// Configuration universelle (Gmail, Outlook, SMTP custom)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

/**
 * Envoyer un email de réinitialisation
 * @param {string} email - Email du destinataire
 * @param {string} token - Token de réinitialisation
 * @returns {boolean} - Succès ou échec
 */
async function sendResetEmail(email, token) {
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-password?token=${token}`;
    const appName = process.env.APP_NAME || "Distributeur Auto";

    const mailOptions = {
        from: `"${appName}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `🔑 Réinitialisation de votre mot de passe - ${appName}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="margin:0;padding:0;background:#f5f5f5;">
                <div style="max-width:500px;margin:20px auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:25px;text-align:center;">
                        <h1 style="color:white;margin:0;font-size:22px;">🤖 ${appName}</h1>
                    </div>
                    <div style="padding:30px;">
                        <h2 style="color:#333;margin:0 0 15px;">Réinitialisation de mot de passe</h2>
                        <p style="color:#666;line-height:1.6;">Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                        <div style="text-align:center;margin:25px 0;">
                            <a href="${resetLink}" style="display:inline-block;padding:14px 35px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;text-decoration:none;border-radius:25px;font-weight:bold;font-size:16px;">
                                Réinitialiser mon mot de passe
                            </a>
                        </div>
                        <p style="color:#999;font-size:12px;">Ce lien expire dans 1 heure.</p>
                        <p style="color:#999;font-size:12px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
                        <hr style="border:1px solid #eee;margin:20px 0;">
                        <p style="color:#999;font-size:11px;text-align:center;">${appName} - Tous droits réservés</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("✅ Email envoyé à", email);
        return true;
    } catch (error) {
        console.error("❌ Erreur envoi email:", error.message);
        return false;
    }
}

// Vérifier la connexion au démarrage
transporter.verify()
    .then(() => console.log("📧 Service email prêt"))
    .catch(err => console.log("⚠️ Email non configuré:", err.message));

module.exports = { sendResetEmail };