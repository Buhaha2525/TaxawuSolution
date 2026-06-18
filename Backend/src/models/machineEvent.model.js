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

        type: String,
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
    {
        timestamps: true
    }
);
// Suppression automatique après 3 heures
//machineEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 10800 }); // 3h = 10800 secondes
module.exports = mongoose.model("MachineEvent", machineEventSchema);