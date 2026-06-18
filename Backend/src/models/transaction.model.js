const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({

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
        unique: false,
        // allow multiple documents with null eventId by using a sparse index
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

    // Ancien champ conservé pour compatibilité avec ton ancien code paiement
    montant: {
        type: Number,
        default: null
    },

    // Utilisé surtout pour Wave / Orange Money
    numero: {
        type: String,
        default: null
    },

    paymentMethod: {
        type: String,
        default: "UNKNOWN",
        // Exemples : PHYSICAL_COIN, WAVE, ORANGE_MONEY, BACKEND_TEST
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
        default: undefined
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
        default: "PENDING"
        // Exemples : PENDING, DETECTED, SUCCESS, FAILED
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
        index: true,
        unique: true,
        sparse: true
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

}, {
    timestamps: true
});

// Compatibilité : si l'ancien code envoie montant au lieu de amountFcfa
transactionSchema.pre("validate", function (next) {
    if (!this.amountFcfa && this.montant) {
        this.amountFcfa = this.montant;
    }

    if (!this.montant && this.amountFcfa) {
        this.montant = this.amountFcfa;
    }

    next();
});
transactionSchema.index(
    { waveTransactionId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            waveTransactionId: { $type: "string" }
        }
    }
);

transactionSchema.index(
    { orangeTransactionId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            orangeTransactionId: { $type: "string" }
        }
    }
);

module.exports = mongoose.model(
    "Transaction",
    transactionSchema
);