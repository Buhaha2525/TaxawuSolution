const mongoose = require("mongoose");

const resetTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    token: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    used: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Supprimer automatiquement les tokens expirés après 1 heure
resetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("ResetToken", resetTokenSchema);