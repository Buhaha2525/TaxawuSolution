// src/routes/dashboard.routes.js

const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

// Toutes les routes du dashboard sont protégées
router.use(authMiddleware);

// Statistiques
router.get("/stats", dashboardController.getDashboardStats);

// Simulation
router.post("/simulate-transaction", dashboardController.simulateTransaction);

// Gestion des machines
router.post("/add-machine", dashboardController.addMachine);
router.get("/machine/:machineId", dashboardController.getMachineDetails);
router.put("/machine/:machineId", dashboardController.updateMachine);
router.delete("/machine/:machineId", dashboardController.deleteMachine);
router.post("/machine/:machineId/archive", dashboardController.archiveMachine);
router.post("/machine/:machineId/reactivate", dashboardController.reactivateMachine);

module.exports = router;