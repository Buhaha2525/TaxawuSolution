// src/routes/machine.routes.js

const express = require("express");
const router = express.Router();
const MachineEvent = require("../models/machineEvent.model");
const Machine = require("../models/machine.model");
const { authMiddleware } = require("../middleware/auth.middleware");

const {
    isMqttConnected,
    getMachineRuntimeState,
    sendDispenseCommand
} = require("../services/mqtt.service");

// ============================================
// ROUTE PUBLIQUE : État MQTT
// ============================================
router.get("/mqtt-status", (req, res) => {
    const machineId = req.query.machineId || process.env.MACHINE_ID || "MACHINE_001";

    res.json({
        success: true,
        mqttConnected: isMqttConnected(),
        machineId,
        machineState: getMachineRuntimeState(machineId)
    });
});

// ============================================
// ROUTE PUBLIQUE : Test dispense rapide (sans token)
// ============================================
router.post("/test-dispense", async (req, res) => {
    try {
        const { machineId, amountFcfa } = req.body;

        console.log("🧪 TEST DISPENSE PUBLIC:", machineId, amountFcfa, "FCFA");

        const command = await sendDispenseCommand({
            machineId: machineId || "MACHINE_001",
            amountFcfa,
            source: "public_test"
        });

        res.json({
            success: true,
            message: `Commande DISPENSE ${amountFcfa} FCFA envoyée à ${machineId}`,
            command
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ROUTES PROTÉGÉES (token requis)
// ============================================

// Événements machine (filtrés par userId)
router.get("/events", authMiddleware, async (req, res) => {
    try {
        const events = await MachineEvent.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ success: true, count: events.length, events });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mes machines
router.get("/mes-machines", authMiddleware, async (req, res) => {
    try {
        const machines = await Machine.find({ ownerId: req.userId });
        res.json({ success: true, count: machines.length, machines });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// Test dispense protégé
// Test dispense protégé
router.post("/:machineId/dispense-test", authMiddleware, async (req, res) => {
    try {
        if (process.env.ALLOW_TEST_DISPENSE !== "true") {
            return res.status(403).json({ success: false, message: "DISPENSE test désactivé." });
        }

        const { machineId } = req.params;
        const { amountFcfa } = req.body;

        const machine = await Machine.findOne({ machineId, ownerId: req.userId });
        if (!machine) {
            return res.status(403).json({ success: false, message: "Cette machine ne vous appartient pas" });
        }

        const command = await sendDispenseCommand({ machineId, amountFcfa, source: "backend_test" });

        // ✅ Créer l'événement machine
        await MachineEvent.create({
            userId: req.userId,
            machineId,
            type: "dispense_test",
            amountFcfa,
            source: "backend_test"
        });

        // ✅ Créer la transaction pour le dashboard
        const Transaction = require("../models/transaction.model");
        await Transaction.create({
            userId: req.userId,
            machineId,
            amountFcfa: amountFcfa,
            montant: amountFcfa,
            paymentMethod: "BACKEND_TEST",
            source: "dispense_test",
            status: "SUCCESS",
            transactionId: `DISPENSE-${machineId}-${Date.now()}`,
            reference: `DISPENSE-${machineId}-${Date.now()}`
        });

        res.json({ success: true, message: "Commande envoyée", command });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            code: error.code || "DISPENSE_TEST_ERROR",
            error: error.message
        });
    }
});

module.exports = router;