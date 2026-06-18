// src/services/mqtt.service.js

const mqtt = require("mqtt");
const MachineEvent = require("../models/machineEvent.model");
const Transaction = require("../models/transaction.model");
const Machine = require("../models/machine.model");
const User = require("../models/user.model");

const {
    MACHINE_ID,
    MQTT_URL,
    MQTT_OPTIONS,
    getMachineTopics
} = require("../config/mqtt.config");

let mqttConnected = false;
const MACHINE_STATUS_MAX_AGE_MS = 15000;
const machineRuntimeState = new Map();

// ============================================
// HELPERS
// ============================================

async function getMachineOwner(machineId) {
    try {
        const machine = await Machine.findOne({ machineId: machineId });
        return machine?.ownerId || null;
    } catch (err) {
        console.log("⚠️ Erreur recherche propriétaire machine:", err.message);
        return null;
    }
}

async function getDefaultAdmin() {
    try {
        const admin = await User.findOne({ role: "ADMIN" });
        return admin?._id || null;
    } catch (err) {
        return null;
    }
}

// ============================================
// ÉTAT RUNTIME DES MACHINES
// ============================================

function updateMachineRuntimeStateFromStatus(data, machineId) {
    if (data.type !== "machine_status") {
        return;
    }

    const finalMachineId = machineId || data.machineId || MACHINE_ID;

    // Mettre à jour en base
    Machine.findOneAndUpdate(
        { machineId: finalMachineId },
        {
            machineId: finalMachineId,
            name: data.name || finalMachineId,
            mqttOnline: true,
            canDispense: data.canDispense === true,
            machineCanAcceptPayment: data.machineCanAcceptPayment === true,
            counterLevel: data.counterLevel || "UNKNOWN",
            reason: data.reason || null,
            firmwareVersion: data.firmwareVersion || null,
            lastUptimeMs: data.uptimeMs || null,
            lastStatusAt: new Date(),
            lastSeenAt: new Date()
        },
        { upsert: true, new: true }
    ).catch(err => console.log("⚠️ Erreur update machine:", err.message));

    // Garder en mémoire
    machineRuntimeState.set(finalMachineId, {
        machineId: finalMachineId,
        machineCanAcceptPayment: data.machineCanAcceptPayment === true,
        canDispense: data.canDispense === true,
        counterLevel: data.counterLevel || null,
        reason: data.reason || null,
        firmwareVersion: data.firmwareVersion || null,
        uptimeMs: data.uptimeMs || null,
        lastStatusAt: new Date(),
        lastStatusAtMs: Date.now()
    });

    console.log("🧠 État runtime mis à jour | Machine:", finalMachineId);
}

function getMachineRuntimeState(machineId = MACHINE_ID) {
    return machineRuntimeState.get(machineId) || null;
}

// ============================================
// VÉRIFICATION DISPONIBILITÉ MACHINE
// ============================================

async function assertMachineCanReceiveDispense(machineId = MACHINE_ID) {
    let state = getMachineRuntimeState(machineId);

    if (!state) {
        const machine = await Machine.findOne({ machineId });

        if (machine) {
            // ✅ Si le statut est vide ou undefined, le mettre à ACTIVE
            if (!machine.status || machine.status === "undefined") {
                machine.status = "ACTIVE";
                await machine.save();
                console.log("✅ Statut corrigé pour", machineId, "→ ACTIVE");
            }

            if (machine.status === "ACTIVE") {
                state = {
                    machineId,
                    machineCanAcceptPayment: true,
                    canDispense: true,
                    counterLevel: "HIGH",
                    lastStatusAt: new Date(),
                    lastStatusAtMs: Date.now()
                };
                machineRuntimeState.set(machineId, state);
                console.log("✅ État runtime créé depuis la base pour", machineId);
            } else {
                const error = new Error(`Machine "${machineId}" n'est pas active (statut: ${machine.status})`);
                error.statusCode = 409;
                error.code = "MACHINE_STATUS_UNKNOWN";
                throw error;
            }
        } else {
            const error = new Error(`Machine "${machineId}" introuvable en base`);
            error.statusCode = 409;
            error.code = "MACHINE_STATUS_UNKNOWN";
            throw error;
        }
    }

    const ageMs = Date.now() - state.lastStatusAtMs;
    if (ageMs > MACHINE_STATUS_MAX_AGE_MS) {
        const error = new Error("État machine trop ancien.");
        error.statusCode = 409;
        error.code = "MACHINE_STATUS_STALE";
        throw error;
    }

    if (state.machineCanAcceptPayment !== true || state.canDispense !== true || state.counterLevel !== "HIGH") {
        const error = new Error("Machine indisponible.");
        error.statusCode = 409;
        error.code = "MACHINE_UNAVAILABLE_BACKEND_GUARD";
        throw error;
    }

    return state;
}

// ============================================
// CONNEXION MQTT
// ============================================

const client = mqtt.connect(MQTT_URL, MQTT_OPTIONS);

client.on("connect", () => {
    mqttConnected = true;
    console.log("🚀 MQTT connecté :", MQTT_URL);

    // MULTI-MACHINE : s'abonner à TOUTES les machines
    const subscribeTopics = [
        "machines/+/events",
        "machines/+/telemetry",
        "machines/+/status",
        "machines/+/acks"
    ];

    client.subscribe(subscribeTopics, (err) => {
        if (err) {
            console.log("❌ MQTT subscribe error :", err.message);
            return;
        }
        console.log("📡 Abonné aux topics (multi-machine) :", subscribeTopics);
    });
});

client.on("reconnect", () => console.log("🔄 MQTT reconnexion..."));
client.on("close", () => { mqttConnected = false; console.log("⚠️ MQTT fermé"); });
client.on("error", (err) => { mqttConnected = false; console.log("❌ MQTT erreur :", err.message); });

// ============================================
// TRAITEMENT DES MESSAGES MQTT
// ============================================

async function createPhysicalCoinTransactionFromEvent(data) {
    const isPhysicalCoinEvent = data.type === "coin_payment_detected" || data.eventType === "physical_coin_payment";
    if (!isPhysicalCoinEvent) return;

    const amount = Number(data.amountFcfa);
    const pulseCount = Number(data.pulseCount || 0);
    const machineId = data.machineId || MACHINE_ID;

    if (!amount || amount <= 0) {
        console.log("⚠️ Paiement physique ignoré : montant invalide");
        return;
    }

    const ownerId = await getMachineOwner(machineId);
    if (!ownerId) {
        console.log("⚠️ Aucun propriétaire pour la machine :", machineId);
        return;
    }

    const eventId = data.eventId || data.transactionId || `${machineId}-COIN-${Date.now()}-${amount}-${pulseCount}`;

    const transactionData = {
        userId: ownerId,
        machineId,
        transactionId: eventId,
        eventId,
        amountFcfa: amount,
        montant: amount,
        numero: null,
        paymentMethod: "PHYSICAL_COIN",
        provider: "COIN_ACCEPTOR",
        source: data.source || "physical_coin",
        pulseCount,
        status: "SUCCESS",
        reference: eventId,
        rawEvent: data
    };

    const result = await Transaction.updateOne(
        { eventId },
        { $setOnInsert: transactionData },
        { upsert: true }
    );

    if (result.upsertedCount > 0) {
        console.log("✅ Transaction physique sauvegardée pour machine:", machineId);
    }
}

client.on("message", async (topic, message) => {
    const rawMessage = message.toString();
    const topicParts = topic.split('/');
    const extractedMachineId = topicParts[1];

    console.log("📥 MQTT reçu | Topic:", topic, "| Machine:", extractedMachineId);

    try {
        const data = JSON.parse(rawMessage);
        const machineId = data.machineId || extractedMachineId || MACHINE_ID;

        updateMachineRuntimeStateFromStatus(data, machineId);

        const ownerId = await getMachineOwner(machineId);

        await MachineEvent.create({
            userId: ownerId,
            topic,
            type: data.type || null,
            eventType: data.eventType || null,
            machineId: machineId,
            transactionId: data.transactionId || null,
            eventId: data.eventId || null,
            amountFcfa: data.amountFcfa || null,
            pulseCount: data.pulseCount || null,
            status: data.status || null,
            state: data.state || null,
            firmwareVersion: data.firmwareVersion || null,
            uptimeMs: data.uptimeMs || null,
            freeHeap: data.freeHeap || null,
            wifiRssi: data.wifiRssi || data.wifi_rssi || null,
            rawPayload: data
        });

        console.log("✅ Event machine sauvegardé pour owner:", ownerId);
        await createPhysicalCoinTransactionFromEvent(data);

    } catch (error) {
        console.log("❌ Erreur traitement MQTT :", error.message);

        await MachineEvent.create({
            userId: null,
            topic,
            type: "RAW_MESSAGE_ERROR",
            machineId: MACHINE_ID,
            rawText: rawMessage,
            parseError: error.message
        });
    }
});

// ============================================
// ENVOI DE COMMANDES
// ============================================

function publishCommandToMachine(machineId, payload) {
    return new Promise((resolve, reject) => {
        if (!mqttConnected) return reject(new Error("MQTT non connecté"));

        const topics = getMachineTopics(machineId);
        client.publish(topics.commands, JSON.stringify(payload), { qos: 0, retain: false }, (err) => {
            if (err) return reject(err);
            console.log("📤 Commande envoyée :", topics.commands);
            resolve({ topic: topics.commands, payload });
        });
    });
}

async function sendDispenseCommand({ machineId = MACHINE_ID, amountFcfa, source = "backend_test" }) {
    const amount = Number(amountFcfa);
    const MIN_AMOUNT_FCFA = 50;
    const MAX_AMOUNT_FCFA = 5700;
    const AMOUNT_STEP_FCFA = 50;

    if (!Number.isInteger(amount) || amount < MIN_AMOUNT_FCFA || amount > MAX_AMOUNT_FCFA || amount % AMOUNT_STEP_FCFA !== 0) {
        throw new Error("Montant non autorisé (50-5700 FCFA, multiple de 50)");
    }

    await assertMachineCanReceiveDispense(machineId);

    const transactionId = `BACKEND-${machineId}-${Date.now()}`;
    const payload = { action: "DISPENSE", machineId, transactionId, amountFcfa: amount, source };

    await publishCommandToMachine(machineId, payload);
    return payload;
}

function isMqttConnected() {
    return mqttConnected;
}

module.exports = {
    client,
    isMqttConnected,
    getMachineRuntimeState,
    assertMachineCanReceiveDispense,
    publishCommandToMachine,
    sendDispenseCommand
};