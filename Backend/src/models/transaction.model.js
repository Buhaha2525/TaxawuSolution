// src/models/transaction.model.js

const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },
        machineId: {
            type: String,
            default: null,
            index: true
        },
        transactionId: {
            type: String,
            default: null,
            unique: true,
            sparse: true,
            index: true
        },
        eventId: {
            type: String,
            default: null,
            sparse: true,
            index: true
        },
        qrCodeDataUrl: {
            type: String,
            default: null
        },
        amountFcfa: {
            type: Number,
            required: true
        },
        montant: {
            type: Number,
            default: null
        },
        numero: {
            type: String,
            default: null
        },
        paymentMethod: {
            type: String,
            default: "UNKNOWN",
            index: true
        },
        provider: {
            type: String,
            default: null
        },
        source: {
            type: String,
            default: null
        },
        pulseCount: {
            type: Number,
            default: null
        },
        waveEventId: {
            type: String,
            default: undefined
        },
        waveTransactionId: {
            type: String,
            default: undefined,
            sparse: true,
            index: true
        },
        senderMobile: {
            type: String,
            default: null
        },
        merchantName: {
            type: String,
            default: null
        },
        customFields: {
            type: Object,
            default: null
        },
        rawWaveWebhook: {
            type: Object,
            default: null
        },
        failureReason: {
            type: String,
            default: null
        },
        machineStateAtPayment: {
            type: Object,
            default: null
        },
        status: {
            type: String,
            default: "PENDING",
            index: true
        },
        reference: {
            type: String,
            default: () => Date.now().toString(),
            index: true
        },
        rawEvent: {
            type: Object,
            default: null
        },
        orangeMerchantCode: {
            type: String,
            default: null,
            index: true
        },
        orangeTransactionId: {
            type: String,
            default: null,
            unique: true,
            sparse: true,
            index: true
        },
        orangeCustomerMsisdn: {
            type: String,
            default: null
        },
        orangeQrResponse: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        orangeCallbackPayload: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        }
    },
    { timestamps: true }
);

// ============================================
// INDEX COMPOSITES (Performance)
// ============================================

// Dashboard principal : transactions par utilisateur + date
transactionSchema.index({ userId: 1, createdAt: -1 });

// Dashboard distributeur : transactions par machine + date
transactionSchema.index({ machineId: 1, createdAt: -1 });

// Filtrage par statut
transactionSchema.index({ status: 1, createdAt: -1 });

// Filtrage par méthode de paiement
transactionSchema.index({ paymentMethod: 1, createdAt: -1 });

// Admin : toutes les transactions récentes
transactionSchema.index({ createdAt: -1 });

// Recherche par référence
transactionSchema.index({ reference: 1 });

// ============================================
// MIDDLEWARE
// ============================================
transactionSchema.pre("validate", function (next) {
    if (!this.amountFcfa && this.montant) {
        this.amountFcfa = this.montant;
    }
    if (!this.montant && this.amountFcfa) {
        this.montant = this.amountFcfa;
    }
    next();
});

module.exports = mongoose.model("Transaction", transactionSchema);