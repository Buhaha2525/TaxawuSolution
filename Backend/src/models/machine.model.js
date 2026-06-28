// src/models/machine.model.js

const mongoose = require("mongoose");

const machineSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
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
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"],
            default: "ACTIVE",
            index: true
        },
        mqttOnline: {
            type: Boolean,
            default: false,
            index: true
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
        firmwareVersion: String,
        lastSeenAt: Date,
        lastHeartbeatAt: Date,
        lastStatusAt: Date,
        lastUptimeMs: Number,
        lastFreeHeap: Number,
        lastWifiRssi: Number,
        reason: String,
        lastErrorCode: String,
        lastErrorMessage: String,
        totalTransactions: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 },
        totalDispenses: { type: Number, default: 0 },

        // Wave
        waveMerchantId: String,
        waveMerchantName: String,

        // Orange Money
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

        metadata: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    { timestamps: true }
);

// ============================================
// INDEX COMPOSITES (Performance)
// ============================================

// Mes machines
machineSchema.index({ ownerId: 1, machineId: 1 });

// Machines en ligne par propriétaire
machineSchema.index({ ownerId: 1, mqttOnline: 1 });

// Dashboard admin : toutes les machines
machineSchema.index({ createdAt: -1 });

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

machineSchema.statics.findByOwner = function (ownerId) {
    return this.find({ ownerId }).sort({ createdAt: -1 });
};

machineSchema.statics.findOnlineByOwner = function (ownerId) {
    return this.find({ ownerId, mqttOnline: true });
};

module.exports = mongoose.model("Machine", machineSchema);