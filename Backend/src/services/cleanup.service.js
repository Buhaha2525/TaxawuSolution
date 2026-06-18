// src/services/cleanup.service.js

const MachineEvent = require("../models/machineEvent.model");
const Machine = require("../models/machine.model");

const CLEANUP_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 heures
const OFFLINE_TIMEOUT_MS = 30000; // 30 secondes sans heartbeat = hors ligne

/**
 * Supprimer les événements machine de plus de 3 heures
 */
async function cleanupOldEvents() {
    try {
        const threeHoursAgo = new Date(Date.now() - CLEANUP_INTERVAL_MS);
        const result = await MachineEvent.deleteMany({ createdAt: { $lt: threeHoursAgo } });
        if (result.deletedCount > 0) {
            console.log(`🧹 Nettoyage MachineEvents : ${result.deletedCount} événements supprimés`);
        }
    } catch (error) {
        console.error("❌ Erreur nettoyage MachineEvents:", error.message);
    }
}

/**
 * 🆕 Vérifier les machines hors ligne
 */
async function checkOfflineMachines() {
    try {
        const offlineThreshold = new Date(Date.now() - OFFLINE_TIMEOUT_MS);

        const result = await Machine.updateMany(
            {
                mqttOnline: true,
                lastSeenAt: { $lt: offlineThreshold }
            },
            {
                $set: {
                    mqttOnline: false,
                    canDispense: false,
                    machineCanAcceptPayment: false,
                    reason: "Machine hors ligne (plus de heartbeat)"
                }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`🔴 ${result.modifiedCount} machine(s) marquée(s) hors ligne`);
        }
    } catch (error) {
        console.error("❌ Erreur vérification machines hors ligne:", error.message);
    }
}

/**
 * Démarrer les nettoyages périodiques
 */
function startCleanupScheduler() {
    console.log("🕒 Nettoyage automatique activé");

    // Vérifier les machines hors ligne toutes les 30 secondes
    setInterval(checkOfflineMachines, 30000);

    // Nettoyer les événements toutes les 3 heures
    setInterval(cleanupOldEvents, CLEANUP_INTERVAL_MS);

    // Premier nettoyage après 1 minute
    setTimeout(cleanupOldEvents, 60000);
}

module.exports = { startCleanupScheduler, cleanupOldEvents, checkOfflineMachines };