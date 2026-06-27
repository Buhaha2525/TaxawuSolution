const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const { validateRegister, validateLogin } = require("../middleware/validation.middleware");

// Routes publiques
router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);

// Mot de passe oublié
router.post("/forgot-password", authController.forgotPassword);
router.get("/verify-reset-token/:token", authController.verifyResetToken);
router.post("/reset-password", authController.resetPassword);

// Routes protégées
router.get("/profile", authMiddleware, authController.getProfile);
router.post("/change-password", authMiddleware, authController.changePassword);  // ✅ ICI

module.exports = router;