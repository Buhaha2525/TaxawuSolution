// src/middleware/validation.middleware.js

const { body, validationResult } = require("express-validator");

const validateRegister = [
    body("name")
        .notEmpty()
        .withMessage("Le nom est requis")
        .isLength({ min: 2 })
        .withMessage("Le nom doit contenir au moins 2 caractères"),

    body("email")
        .isEmail()
        .withMessage("Email invalide")
        .normalizeEmail(),

    body("phone")
        .notEmpty()
        .withMessage("Le téléphone est requis")
        .custom((value) => {
            // Nettoyer le numéro (enlever espaces, +, -)
            const cleaned = value.replace(/[\s\+\-\.\(\)]/g, '');
            // Vérifier qu'il ne reste que des chiffres, entre 9 et 13
            return /^[0-9]{9,13}$/.test(cleaned);
        })
        .withMessage("Numéro de téléphone invalide (ex: 771234567 ou +221771234567)"),

    body("password")
        .isLength({ min: 6 })
        .withMessage("Le mot de passe doit contenir au moins 6 caractères"),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(e => e.msg);
            console.log("❌ Validation échouée:", errorMessages);
            return res.status(400).json({
                success: false,
                message: errorMessages[0],
                errors: errors.array()
            });
        }
        next();
    }
];

const validateLogin = [
    body("email")
        .isEmail()
        .withMessage("Email invalide")
        .normalizeEmail(),

    body("password")
        .notEmpty()
        .withMessage("Le mot de passe est requis"),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(e => e.msg);
            return res.status(400).json({
                success: false,
                message: errorMessages[0],
                errors: errors.array()
            });
        }
        next();
    }
];

const validatePayment = [
    body("montant")
        .isFloat({ min: 50, max: 5700 })
        .withMessage("Montant invalide (min: 50, max: 5700 FCFA)"),

    body("numero")
        .custom((value) => {
            const cleaned = value.replace(/[\s\+\-\.\(\)]/g, '');
            return /^[0-9]{9,13}$/.test(cleaned);
        })
        .withMessage("Numéro de téléphone invalide"),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(e => e.msg);
            return res.status(400).json({
                success: false,
                message: errorMessages[0],
                errors: errors.array()
            });
        }
        next();
    }
];

module.exports = { validateRegister, validateLogin, validatePayment };