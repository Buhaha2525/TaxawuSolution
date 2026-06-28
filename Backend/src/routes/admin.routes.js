// src/routes/admin.routes.js

const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

// Toutes les routes sont protégées
router.use(authMiddleware);

router.get("/stats", adminController.getGlobalStats);
router.get("/users", adminController.getUsers);
router.get("/machines", adminController.getAllMachines);
router.get("/transactions", adminController.getAllTransactions);

module.exports = router;