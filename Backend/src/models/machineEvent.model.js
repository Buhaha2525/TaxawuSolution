// src/models/machineEvent.model.js

const mongoose = require("mongoose");

const machineEventSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },
        topic: {
            type: String,
            index: true
        },
        type: {
            type: String,
            index: true
        },
        eventType: String,
        machineId: {
            type: String,
            index: true
        },
        transactionId: {
            type: String,
            index: true
        },
        eventId: String,
        amountFcfa: Number,
        pulseCount: Number,
        status: String,
        state: String,
        firmwareVersion: String,
        uptimeMs: Number,
        freeHeap: Number,
        wifiRssi: Number,
        rawPayload: mongoose.Schema.Types.Mixed,
        rawText: String,
        parseError: String
    },
    { timestamps: true }
);

// ============================================
// INDEX COMPOSITES (Performance)
// ============================================

// Dashboard : événements par utilisateur + date
machineEventSchema.index({ userId: 1, createdAt: -1 });

// Dashboard : événements par machine + date
machineEventSchema.index({ machineId: 1, createdAt: -1 });

// Filtrage par type d'événement
machineEventSchema.index({ type: 1, createdAt: -1 });

// Nettoyage automatique : suppression après 3 heures
machineEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 10800 });

module.exports = mongoose.model("MachineEvent", machineEventSchema);