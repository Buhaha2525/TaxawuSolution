// src/models/machine.model.js

const mongoose = require("mongoose");

const machineSchema = new mongoose.Schema(
    {
        // ============================================
        // PROPRIÉTAIRE
        // ============================================
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        waveMiniUsineId: {
    type: String,
    default: undefined,
    index: true
},

waveAccountNumber: {
    type: String,
    default: undefined,
    index: true
},

waveCustomId: {
    type: String,
    default: undefined,
    index: true
},

        orangeMerchantCode: {
            type: String,
            default: undefined,
            trim: true,
            index: true,
            unique: true,
            sparse: true
        },

        orangeMerchantName: {
            type: String,
            default: null,
            trim: true
        },

        orangeCallbackUrl: {
            type: String,
            default: null,
            trim: true
        },

        // ============================================
        // IDENTIFICATION
        // ============================================
        machineId: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true
        },
        name: {
            type: String,
            default: "MACHINE_001"
        },
        location: {
            type: String,
            default: null
        },

        // ============================================
        // ÉTAT MQTT
        // ============================================
        mqttOnline: {
            type: Boolean,
            default: false
        },
        canDispense: {
            type: Boolean,
            default: true
        },
        machineCanAcceptPayment: {
            type: Boolean,
            default: true
        },
        counterLevel: {
            type: String,
            enum: ["HIGH", "LOW", "UNKNOWN"],
            default: "UNKNOWN"
        },
        currentState: {
            type: String,
            default: "UNKNOWN"
        },
        // ============================================
// STATUT
// ============================================
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"],
            default: "ACTIVE"
        },
        // ============================================
        // TECHNIQUE
        // ============================================
        firmwareVersion: {
            type: String,
            default: null
        },
        lastSeenAt: Date,
        lastHeartbeatAt: Date,
        lastStatusAt: Date,
        lastUptimeMs: Number,
        lastFreeHeap: Number,
        lastWifiRssi: Number,
        reason: String,
        lastErrorCode: String,
        lastErrorMessage: String,

        // ============================================
        // STATISTIQUES
        // ============================================
        totalTransactions: {
            type: Number,
            default: 0
        },
        totalRevenue: {
            type: Number,
            default: 0
        },
        totalDispenses: {
            type: Number,
            default: 0
        },

        // ============================================
        // MÉTADONNÉES
        // ============================================
        metadata: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

// ============================================
// INDEX
// ============================================
machineSchema.index({ ownerId: 1, machineId: 1 });
machineSchema.index({ mqttOnline: 1 });
machineSchema.index({ ownerId: 1, mqttOnline: 1 });

// ============================================
// MÉTHODES
// ============================================
machineSchema.methods.updateHeartbeat = async function (data) {
    this.lastHeartbeatAt = new Date();
    this.lastSeenAt = new Date();
    this.mqttOnline = true;

    if (data.uptimeMs) this.lastUptimeMs = data.uptimeMs;
    if (data.freeHeap) this.lastFreeHeap = data.freeHeap;
    if (data.wifiRssi) this.lastWifiRssi = data.wifiRssi;
    if (data.state) this.currentState = data.state;
    if (data.firmwareVersion) this.firmwareVersion = data.firmwareVersion;

    await this.save();
};

machineSchema.methods.updateStatus = async function (data) {
    this.lastStatusAt = new Date();
    this.lastSeenAt = new Date();
    this.mqttOnline = true;
    this.canDispense = data.canDispense === true;
    this.machineCanAcceptPayment = data.machineCanAcceptPayment === true;
    this.counterLevel = data.counterLevel || "UNKNOWN";
    this.reason = data.reason || null;

    await this.save();
};

// ============================================
// STATICS
// ============================================
machineSchema.statics.findByOwner = function (ownerId) {
    return this.find({ ownerId });
};

machineSchema.statics.findOnlineByOwner = function (ownerId) {
    return this.find({ ownerId, mqttOnline: true });
};

const Machine = mongoose.model("Machine", machineSchema);

module.exports = Machine;