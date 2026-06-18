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

// Routes
router.post("/create-payment", authMiddleware, paymentController.createPayment);
router.get("/", optionalAuth, paymentController.getTransactions);        // ← optionalAuth
router.get("/:id", optionalAuth, paymentController.getTransactionById);   // ← optionalAuth
router.put("/:id/status", authMiddleware, paymentController.updateTransactionStatus);

module.exports = router;