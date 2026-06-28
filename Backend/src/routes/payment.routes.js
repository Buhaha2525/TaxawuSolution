// src/routes/payment.routes.js

const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

// Middleware optionnel
const optionalAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
        return authMiddleware(req, res, next);
    }
    next();
};

// Middleware qui accepte le token en query string (pour téléchargement CSV)
const queryTokenAuth = (req, res, next) => {
    const token = req.query.token || req.headers.authorization?.split(" ")[1];
    if (token) {
        req.headers.authorization = `Bearer ${token}`;
        return authMiddleware(req, res, next);
    }
    return res.status(401).json({ success: false, message: "Token manquant" });
};

// Routes
router.post("/create-payment", authMiddleware, paymentController.createPayment);
router.get("/", optionalAuth, paymentController.getTransactions);
router.get("/export/csv", queryTokenAuth, paymentController.exportCSV);
router.get("/:id", optionalAuth, paymentController.getTransactionById);
router.put("/:id/status", authMiddleware, paymentController.updateTransactionStatus);

module.exports = router;