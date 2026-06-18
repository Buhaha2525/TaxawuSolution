// src/controllers/auth.controller.js

const User = require("../models/user.model");
const Machine = require("../models/machine.model");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { jwtSecret, jwtExpiresIn } = require("../config/auth.config");
const ResetToken = require("../models/resetToken.model");
const { sendResetEmail } = require("../services/email.service");

// ============================================
// INSCRIPTION
// ============================================
exports.register = async (req, res) => {
    try {
        const { email, password, name, phone, companyName } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Cet email est déjà utilisé"
            });
        }

        const user = await User.create({
            email,
            password,
            name,
            phone,
            companyName: companyName || "",
            role: "OWNER"
        });

        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            jwtSecret,
            { expiresIn: jwtExpiresIn }
        );

        res.status(201).json({
            success: true,
            message: "Inscription réussie",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                companyName: user.companyName
            }
        });

    } catch (error) {
        console.error("Erreur register:", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de l'inscription"
        });
    }
};

// ============================================
// CONNEXION
// ============================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Email ou mot de passe incorrect"
            });
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Email ou mot de passe incorrect"
            });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            jwtSecret,
            { expiresIn: jwtExpiresIn }
        );

        res.json({
            success: true,
            message: "Connexion réussie",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                companyName: user.companyName
            }
        });

    } catch (error) {
        console.error("Erreur login:", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la connexion"
        });
    }
};

// ============================================
// PROFIL
// ============================================
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur non trouvé"
            });
        }

        const machines = await Machine.find({ ownerId: req.userId });

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                companyName: user.companyName,
                role: user.role,
                lastLogin: user.lastLogin
            },
            machines: machines,
            machineCount: machines.length
        });

    } catch (error) {
        console.error("Erreur getProfile:", error);
        res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération du profil"
        });
    }
};

// ============================================
// MOT DE PASSE OUBLIÉ - Demander réinitialisation
// ============================================
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email requis"
            });
        }

        const user = await User.findOne({ email });

        // Pour la sécurité, toujours répondre la même chose
        if (!user) {
            return res.json({
                success: true,
                message: "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation."
            });
        }

        // Générer un token aléatoire
        const token = crypto.randomBytes(32).toString("hex");

        // Sauvegarder le token (expire dans 1 heure)
        await ResetToken.create({
            userId: user._id,
            token,
            expiresAt: new Date(Date.now() + 3600000)
        });

        // Envoyer l'email
        const emailSent = await sendResetEmail(email, token);

        // En développement, renvoyer le token si l'email n'est pas configuré
        if (!emailSent && process.env.NODE_ENV !== "production") {
            return res.json({
                success: true,
                message: "Mode développement : email non configuré.",
                debugToken: token,
                debugLink: `/reset-password?token=${token}`
            });
        }

        res.json({
            success: true,
            message: "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation."
        });

    } catch (error) {
        console.error("Erreur forgotPassword:", error);
        res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });
    }
};

// ============================================
// MOT DE PASSE OUBLIÉ - Vérifier le token
// ============================================
exports.verifyResetToken = async (req, res) => {
    try {
        const { token } = req.params;

        const resetToken = await ResetToken.findOne({
            token,
            used: false,
            expiresAt: { $gt: new Date() }
        });

        if (!resetToken) {
            return res.json({
                success: false,
                message: "Token invalide ou expiré"
            });
        }

        res.json({
            success: true,
            message: "Token valide"
        });

    } catch (error) {
        console.error("Erreur verifyResetToken:", error);
        res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });
    }
};

// ============================================
// MOT DE PASSE OUBLIÉ - Réinitialiser le mot de passe
// ============================================
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Token et nouveau mot de passe requis"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Le mot de passe doit contenir au moins 6 caractères"
            });
        }

        // Trouver le token valide
        const resetToken = await ResetToken.findOne({
            token,
            used: false,
            expiresAt: { $gt: new Date() }
        });

        if (!resetToken) {
            return res.status(400).json({
                success: false,
                message: "Token invalide ou expiré"
            });
        }

        // Trouver l'utilisateur
        const user = await User.findById(resetToken.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable"
            });
        }

        // Mettre à jour le mot de passe (le middleware pre-save va le hasher)
        user.password = newPassword;
        await user.save();

        // Marquer le token comme utilisé
        resetToken.used = true;
        await resetToken.save();

        res.json({
            success: true,
            message: "Mot de passe réinitialisé avec succès"
        });

    } catch (error) {
        console.error("Erreur resetPassword:", error);
        res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });
    }
};