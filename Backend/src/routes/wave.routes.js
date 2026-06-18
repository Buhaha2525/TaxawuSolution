const express = require("express");
const router = express.Router();
const QRCode = require("qrcode");

const { payerWave } = require("../services/wave.service");
const Transaction = require("../models/transaction.model");
const Machine = require("../models/machine.model");
const mqttService = require("../services/mqtt.service");
const { authMiddleware } = require("../middleware/auth.middleware");

// ======================================================
// CONSTANTES
// ======================================================

const TERMINAL_STATUSES = ["DISPENSE_SENT", "SUCCESS", "SUCCES"];

// ======================================================
// Vérifier si la machine peut recevoir un paiement Wave
// ======================================================

async function assertMachineCanStartWavePayment(machineId) {
    const machine = await Machine.findOne({ machineId });

    if (!machine) {
        const error = new Error("Machine introuvable ou jamais connectée");
        error.statusCode = 404;
        error.code = "MACHINE_NOT_FOUND";
        throw error;
    }

    const isOnline = machine.mqttOnline === true;
    const canAcceptPayment = machine.machineCanAcceptPayment === true;
    const canDispense = machine.canDispense === true;
    const counterIsHigh = !machine.counterLevel || machine.counterLevel === "HIGH";

    if (!isOnline || !canAcceptPayment || !canDispense || !counterIsHigh) {
        const error = new Error("Machine indisponible : paiement Wave bloqué");
        error.statusCode = 409;
        error.code = "MACHINE_UNAVAILABLE_FOR_PAYMENT";
        error.details = {
            machineId: machine.machineId,
            mqttOnline: machine.mqttOnline,
            machineCanAcceptPayment: machine.machineCanAcceptPayment,
            canDispense: machine.canDispense,
            counterLevel: machine.counterLevel,
            reason: machine.reason || null,
            currentState: machine.currentState || null,
            lastSeenAt: machine.lastSeenAt || null,
            lastStatusAt: machine.lastStatusAt || null
        };
        throw error;
    }

    return machine;
}

// ======================================================
// Helpers Webhook Wave
// ======================================================

function getEventType(event) {
    return event?.type || event?.event_type || null;
}

function getEventData(event) {
    return event?.data || event || {};
}

function getWaveEventId(event, data) {
    return (
        event?.id ||
        event?.event_id ||
        data?.event_id ||
        null
    );
}

function getClientReference(event, data) {
    return (
        data?.client_reference ||
        data?.reference ||
        event?.client_reference ||
        event?.reference ||
        null
    );
}

function getCheckoutStatus(event, data) {
    return (
        data?.status ||
        data?.payment_status ||
        data?.checkout_status ||
        event?.status ||
        event?.payment_status ||
        event?.checkout_status ||
        null
    );
}

function getWaveTransactionId(data) {
    return (
        data?.transaction_id ||
        data?.payment_id ||
        data?.id ||
        null
    );
}

function normalizeAmount(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return NaN;
    }

    return Math.round(amount);
}

function getCustomFields(event, data) {
    return (
        data?.custom_fields ||
        data?.customFields ||
        event?.custom_fields ||
        event?.customFields ||
        {}
    );
}

function extractWaveMachineId(event, data) {
    const customFields = getCustomFields(event, data);

    const possibleValues = [
        customFields?.id,
        customFields?.ID,
        customFields?.machineId,
        customFields?.machine_id,
        customFields?.miniUsineId,
        customFields?.mini_usine_id,
        customFields?.account_number,
        customFields?.numero_machine,
        customFields?.numeroMiniUsine,
        customFields?.numero_mini_usine
    ];

    const found = possibleValues.find((value) => {
        return value !== undefined && value !== null && String(value).trim() !== "";
    });

    return found ? String(found).trim() : null;
}

function buildOrQuery(fields) {
    const conditions = [];

    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            conditions.push({ [key]: value });
        }
    }

    if (conditions.length === 0) {
        return null;
    }

    return { $or: conditions };
}

function isTransactionAlreadyProcessed(transaction) {
    return TERMINAL_STATUSES.includes(transaction.status);
}

function getMachineReadiness(machine) {
    const isReady =
        machine &&
        machine.mqttOnline === true &&
        machine.machineCanAcceptPayment === true &&
        machine.canDispense === true &&
        (!machine.counterLevel || machine.counterLevel === "HIGH");

    return {
        ready: isReady,
        details: {
            machineId: machine?.machineId || null,
            mqttOnline: machine?.mqttOnline,
            machineCanAcceptPayment: machine?.machineCanAcceptPayment,
            canDispense: machine?.canDispense,
            counterLevel: machine?.counterLevel,
            reason: machine?.reason || null,
            currentState: machine?.currentState || null,
            lastSeenAt: machine?.lastSeenAt || null,
            lastStatusAt: machine?.lastStatusAt || null
        }
    };
}

async function findMachineByWaveId(waveMachineId) {
    if (!waveMachineId) {
        return null;
    }

    return Machine.findOne({
        $or: [
            { machineId: waveMachineId },
            { waveMiniUsineId: waveMachineId },
            { waveAccountNumber: waveMachineId },
            { waveCustomId: waveMachineId }
        ]
    });
}

async function sendMqttAndMarkTransaction(transaction, machine, amountFcfa, source) {
    const readiness = getMachineReadiness(machine);

    if (!readiness.ready) {
        transaction.status = "REFUND_REQUIRED";
        transaction.failureReason = "Machine indisponible après paiement Wave";
        transaction.machineStateAtPayment = readiness.details;
        await transaction.save();

        console.error("❌ Paiement reçu mais machine indisponible :", readiness.details);
        return transaction;
    }

    try {
        await mqttService.sendDispenseCommand({
            machineId: machine.machineId,
            amountFcfa,
            transactionId:
                transaction.transactionId ||
                transaction.reference ||
                transaction._id.toString(),
            source
        });

        transaction.status = "DISPENSE_SENT";
        transaction.mqttCommandSentAt = new Date();
        await transaction.save();

        console.log("🚰 Commande MQTT envoyée à l'ESP32 :", {
            machineId: machine.machineId,
            amountFcfa,
            transactionId:
                transaction.transactionId ||
                transaction.reference ||
                transaction._id.toString(),
            source
        });

        return transaction;

    } catch (err) {
        transaction.status = "REFUND_REQUIRED";
        transaction.rawMqttError = {
            message: err.message,
            code: err.code || null,
            details: err.details || null
        };
        await transaction.save();

        console.log("⚠️ Paiement reçu mais distribution impossible :", err.message);
        return transaction;
    }
}

// ======================================================
// ÉTAPE 1 : Créer une session Wave Checkout dynamique
// Ici le montant est obligatoire
// ======================================================

router.post("/payer", authMiddleware, async (req, res) => {
    try {
        const { montant, machineId } = req.body;

        const amount = Number(montant);

        console.log("📥 Demande paiement Wave Checkout :", {
            montant,
            machineId,
            userId: req.userId
        });

        if (!Number.isInteger(amount) || amount < 50) {
            return res.status(400).json({
                succes: false,
                erreur: "Montant minimum 50 FCFA"
            });
        }

        if (amount % 50 !== 0) {
            return res.status(400).json({
                succes: false,
                erreur: "Le montant doit être un multiple de 50 FCFA"
            });
        }

        if (!machineId) {
            return res.status(400).json({
                succes: false,
                erreur: "machineId requis"
            });
        }

        const machineState = await assertMachineCanStartWavePayment(machineId);

        console.log("✅ Machine autorisée pour paiement Wave Checkout :", {
            machineId: machineState.machineId,
            mqttOnline: machineState.mqttOnline,
            machineCanAcceptPayment: machineState.machineCanAcceptPayment,
            canDispense: machineState.canDispense,
            counterLevel: machineState.counterLevel
        });

        const reference = `WAVE_${machineId}_${Date.now()}`;
        
        const machine = await Machine.findOne({ machineId });
        if (!machine || String(machine.ownerId) !== String(req.userId)) {
            return res.status(403).json({ succes: false, erreur: "Cette machine ne vous appartient pas" });
        }

        const transaction = await Transaction.create({
            userId: req.userId,
            machineId,
            transactionId: reference,
            amountFcfa: amount,
            montant: amount,
            paymentMethod: "WAVE",
            provider: "WAVE",
            source: "wave_checkout",
            status: "PENDING_PAYMENT",
            reference
        });

        const resultat = await payerWave(amount, reference);

        console.log("📥 Résultat payerWave brut :", JSON.stringify(resultat, null, 2));

        const waveCheckoutSessionId =
            resultat.waveCheckoutSessionId ||
            resultat.id ||
            resultat.raw?.id ||
            null;

        const waveLaunchUrl =
            resultat.waveLaunchUrl ||
            resultat.wave_launch_url ||
            resultat.raw?.wave_launch_url ||
            null;

        if (!resultat.succes || !waveLaunchUrl) {
            transaction.status = "PAYMENT_FAILED";
            transaction.rawWaveCheckout = resultat;
            await transaction.save();

            return res.status(502).json({
                succes: false,
                erreur: "Session Wave non créée correctement : waveLaunchUrl manquant",
                details: resultat
            });
        }

        const qrCodeDataUrl = await QRCode.toDataURL(waveLaunchUrl);

        transaction.waveCheckoutSessionId = waveCheckoutSessionId;
        transaction.waveLaunchUrl = waveLaunchUrl;
        transaction.qrCodeDataUrl = qrCodeDataUrl;
        transaction.rawWaveCheckout = resultat.raw || resultat;
        await transaction.save();

        return res.json({
            succes: true,
            message: "Session Wave Checkout créée",
            transaction: {
                reference,
                transactionId: reference,
                machineId,
                montant: amount,
                statut: transaction.status,
                waveCheckoutSessionId: transaction.waveCheckoutSessionId,
                waveLaunchUrl: transaction.waveLaunchUrl,
                qrCodeDataUrl: transaction.qrCodeDataUrl
            }
        });

    } catch (error) {
        console.error("❌ Erreur /api/wave/payer :", error.message);

        return res.status(error.statusCode || 500).json({
            succes: false,
            code: error.code || "WAVE_PAYMENT_ERROR",
            erreur: error.message,
            details: error.details || null
        });
    }
});

// ======================================================
// HEALTHCHECK WEBHOOK
// ======================================================

router.get("/webhook", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Wave webhook endpoint is alive"
    });
});

// ======================================================
// Gestion QR Wave statique
// Event attendu : merchant.payment_received
// Le champ machine doit arriver dans custom_fields.id
// ======================================================

async function handleMerchantPaymentReceived(event) {
    const data = getEventData(event);
    const eventId = getWaveEventId(event, data);
    const eventType = getEventType(event);

    const waveTransactionId = getWaveTransactionId(data);
    const amount = normalizeAmount(data.amount);
    const currency = data.currency || "XOF";
    const senderMobile = data.sender_mobile || data.senderMobile || null;
    const merchantName = data.merchant_name || data.merchantName || null;
    const customFields = getCustomFields(event, data);
    const waveMachineId = extractWaveMachineId(event, data);

    console.log("📥 Paiement marchand Wave reçu :", {
        eventId,
        eventType,
        waveTransactionId,
        amount,
        currency,
        senderMobile,
        merchantName,
        customFields,
        waveMachineId
    });

    if (!waveTransactionId) {
        console.log("❌ ID transaction Wave manquant");
        return null;
    }

    if (!waveMachineId) {
        console.log("❌ ID machine Wave manquant dans custom_fields :", customFields);

        const unknownReference = `WAVE_UNKNOWN_${waveTransactionId}_${Date.now()}`;

        await Transaction.create({
            machineId: "UNKNOWN_WAVE_MACHINE",
            transactionId: unknownReference,
            reference: unknownReference,
            eventId,
            waveEventId: eventId,
            waveTransactionId,
            amountFcfa: Number.isInteger(amount) ? amount : 0,
            montant: Number.isInteger(amount) ? amount : 0,
            paymentMethod: "WAVE",
            provider: "WAVE",
            source: "wave_static_qr",
            status: "REFUND_REQUIRED",
            senderMobile,
            rawWaveWebhook: event,
            failureReason: "ID machine absent dans custom_fields"
        });

        return null;
    }

    if (currency !== "XOF") {
        console.log("❌ Devise non supportée :", currency);

        const invalidCurrencyReference = `WAVE_${waveMachineId}_${waveTransactionId}_${Date.now()}`;

        await Transaction.create({
            machineId: waveMachineId,
            transactionId: invalidCurrencyReference,
            reference: invalidCurrencyReference,
            eventId,
            waveEventId: eventId,
            waveTransactionId,
            amountFcfa: Number.isInteger(amount) ? amount : 0,
            montant: Number.isInteger(amount) ? amount : 0,
            paymentMethod: "WAVE",
            provider: "WAVE",
            source: "wave_static_qr",
            status: "PAYMENT_FAILED",
            senderMobile,
            rawWaveWebhook: event,
            failureReason: `Devise non supportée : ${currency}`
        });

        return null;
    }

    if (!Number.isInteger(amount) || amount < 50 || amount % 50 !== 0) {
        console.log("❌ Montant Wave invalide :", amount);

        const invalidAmountReference = `WAVE_${waveMachineId}_${waveTransactionId}_${Date.now()}`;

        await Transaction.create({
            machineId: waveMachineId,
            transactionId: invalidAmountReference,
            reference: invalidAmountReference,
            eventId,
            waveEventId: eventId,
            waveTransactionId,
            amountFcfa: Number.isInteger(amount) ? amount : 0,
            montant: Number.isInteger(amount) ? amount : 0,
            paymentMethod: "WAVE",
            provider: "WAVE",
            source: "wave_static_qr",
            status: "PAYMENT_FAILED",
            senderMobile,
            rawWaveWebhook: event,
            failureReason: `Montant invalide : ${amount}`
        });

        return null;
    }

    const duplicateQuery = buildOrQuery({
        eventId,
        waveEventId: eventId,
        waveTransactionId
    });

    if (duplicateQuery) {
        const existingTransaction = await Transaction.findOne(duplicateQuery);

        if (existingTransaction) {
            console.log("ℹ️ Paiement Wave déjà enregistré :", {
                eventId,
                waveTransactionId,
                status: existingTransaction.status
            });

            return existingTransaction;
        }
    }

    const machine = await findMachineByWaveId(waveMachineId);

    if (!machine) {
        console.log("❌ Machine introuvable pour ID Wave :", waveMachineId);

        const missingMachineReference = `WAVE_${waveMachineId}_${waveTransactionId}_${Date.now()}`;

        const transaction = await Transaction.create({
            machineId: waveMachineId,
            transactionId: missingMachineReference,
            reference: missingMachineReference,
            eventId,
            waveEventId: eventId,
            waveTransactionId,
            amountFcfa: amount,
            montant: amount,
            paymentMethod: "WAVE",
            provider: "WAVE",
            source: "wave_static_qr",
            status: "REFUND_REQUIRED",
            senderMobile,
            merchantName,
            customFields,
            rawWaveWebhook: event,
            failureReason: "Machine introuvable pour ID Wave"
        });

        return transaction;
    }

    const reference = `WAVE_STATIC_${machine.machineId}_${waveTransactionId}`;
    const ownerUserId =
        machine.ownerUserId ||
        machine.userId ||
        machine.owner ||
        undefined;

    const transaction = await Transaction.create({
        userId: ownerUserId,
        machineId: machine.machineId,
        transactionId: reference,
        reference,
        eventId,
        waveEventId: eventId,
        waveTransactionId,
        amountFcfa: amount,
        montant: amount,
        paymentMethod: "WAVE",
        provider: "WAVE",
        source: "wave_static_qr",
        status: "PAID",
        senderMobile,
        merchantName,
        customFields,
        rawWaveWebhook: event,
        paidAt: new Date()
    });

    console.log("✅ Paiement Wave statique confirmé :", {
        machineId: machine.machineId,
        waveMachineId,
        amount,
        reference
    });

    await sendMqttAndMarkTransaction(
        transaction,
        machine,
        amount,
        "wave_static_qr"
    );

    return transaction;
}

// ======================================================
// Gestion Wave Checkout dynamique
// Event attendu : checkout.session.completed
// Ici la transaction est retrouvée avec client_reference
// ======================================================

async function handleCheckoutWebhook(event) {
    const data = getEventData(event);
    const eventId = getWaveEventId(event, data);
    const eventType = getEventType(event);
    const clientReference = getClientReference(event, data);
    const status = getCheckoutStatus(event, data);

    console.log("📥 Traitement webhook Wave Checkout :", {
        eventType,
        clientReference,
        status,
        checkout_status: data.checkout_status,
        payment_status: data.payment_status
    });

    if (!clientReference) {
        console.log("⚠️ Webhook Checkout sans client_reference");
        return null;
    }

    const transaction = await Transaction.findOne({
        $or: [
            { reference: clientReference },
            { transactionId: clientReference }
        ]
    });

    if (!transaction) {
        console.log("⚠️ Transaction Checkout introuvable :", clientReference);
        return null;
    }

    if (isTransactionAlreadyProcessed(transaction)) {
        console.log("ℹ️ Transaction Checkout déjà traitée :", {
            reference: clientReference,
            status: transaction.status
        });
        return transaction;
    }

    const isPaymentCompleted =
        status === "completed" ||
        status === "complete" ||
        status === "success" ||
        status === "succeeded" ||
        data.checkout_status === "complete" ||
        data.checkout_status === "completed" ||
        data.payment_status === "succeeded" ||
        data.payment_status === "success" ||
        eventType === "checkout.session.completed";

    const isPaymentFailed =
        status === "failed" ||
        status === "failure" ||
        data.payment_status === "failed" ||
        data.checkout_status === "failed" ||
        eventType === "checkout.session.payment_failed";

    if (isPaymentFailed) {
        transaction.status = "PAYMENT_FAILED";
        transaction.waveEventId = eventId;
        transaction.rawWaveWebhook = event;
        transaction.failureReason = "Paiement Wave Checkout échoué";
        await transaction.save();

        console.log("❌ Paiement Wave Checkout échoué :", clientReference);
        return transaction;
    }

    if (!isPaymentCompleted) {
        console.log("⚠️ Statut Wave Checkout non traité :", {
            eventType,
            status,
            checkout_status: data.checkout_status,
            payment_status: data.payment_status
        });
        return transaction;
    }

    const paidAmount = normalizeAmount(
        data.amount ||
        data.total_amount ||
        transaction.amountFcfa ||
        transaction.montant
    );

    const expectedAmount = normalizeAmount(
        transaction.amountFcfa ||
        transaction.montant
    );

    if (paidAmount !== expectedAmount) {
        transaction.status = "PAYMENT_FAILED";
        transaction.waveEventId = eventId;
        transaction.rawWaveWebhook = event;
        transaction.failureReason = `Montant invalide : payé=${paidAmount}, attendu=${expectedAmount}`;
        await transaction.save();

        console.log("❌ Montant invalide :", {
            paidAmount,
            expectedAmount
        });

        return transaction;
    }

    if (data.currency && data.currency !== "XOF") {
        transaction.status = "PAYMENT_FAILED";
        transaction.waveEventId = eventId;
        transaction.rawWaveWebhook = event;
        transaction.failureReason = `Devise invalide : ${data.currency}`;
        await transaction.save();

        console.log("❌ Devise invalide :", data.currency);
        return transaction;
    }

    transaction.status = "PAID";
    transaction.waveEventId = eventId;
    transaction.eventId = eventId;
    transaction.waveTransactionId = getWaveTransactionId(data);
    transaction.rawWaveWebhook = event;
    transaction.paidAt = new Date();
    await transaction.save();

    console.log("✅ Paiement Wave Checkout confirmé :", {
        reference: clientReference,
        amount: expectedAmount,
        machineId: transaction.machineId
    });

    const machine = await Machine.findOne({
        machineId: transaction.machineId || "MACHINE_002"
    });

    if (!machine) {
        transaction.status = "REFUND_REQUIRED";
        transaction.failureReason = "Machine introuvable après paiement Checkout";
        await transaction.save();

        console.log("❌ Machine introuvable après paiement Checkout :", transaction.machineId);
        return transaction;
    }

    await sendMqttAndMarkTransaction(
        transaction,
        machine,
        expectedAmount,
        "wave_checkout"
    );

    return transaction;
}

// ======================================================
// ÉTAPE 2 : Webhook Wave principal
// Gère maintenant :
// - merchant.payment_received pour QR statique
// - checkout.session.completed pour Checkout dynamique
// ======================================================

router.post("/webhook", async (req, res) => {
    const event = req.body || {};

    console.log("📥 Webhook Wave reçu :", JSON.stringify(event, null, 2));

    res.status(200).json({
        success: true,
        message: "Webhook reçu"
    });

    setImmediate(async () => {
        try {
            const data = getEventData(event);
            const eventType = getEventType(event);

            if (
                eventType === "healthcheck" ||
                eventType === "test.test_event" ||
                event.id === "evt_healthcheck"
            ) {
                console.log("✅ Healthcheck/Test Wave reçu, aucun paiement à traiter");
                return;
            }

            if (eventType === "merchant.payment_received") {
                await handleMerchantPaymentReceived(event);
                return;
            }

            if (
                eventType === "checkout.session.completed" ||
                eventType === "checkout.session.payment_failed" ||
                getClientReference(event, data)
            ) {
                await handleCheckoutWebhook(event);
                return;
            }

            console.log("ℹ️ Event Wave ignoré :", {
                eventType,
                eventId: event.id || null
            });

        } catch (error) {
            console.error("❌ Erreur traitement webhook Wave après réponse :", error);
        }
    });
});

// ======================================================
// TEST : Simuler paiement réussi sans Wave
// ======================================================

router.post("/test-paiement", authMiddleware, async (req, res) => {
    try {
        const { reference } = req.body;

        const transaction = await Transaction.findOne({ reference });

        if (!transaction) {
            return res.status(404).json({
                succes: false,
                erreur: "Transaction introuvable"
            });
        }

        if (isTransactionAlreadyProcessed(transaction)) {
            return res.json({
                succes: true,
                message: "Transaction déjà traitée",
                transaction: {
                    reference: transaction.reference,
                    montant: transaction.amountFcfa,
                    statut: transaction.status
                }
            });
        }

        transaction.status = "PAID";
        transaction.paidAt = new Date();
        await transaction.save();

        const machine = await Machine.findOne({
            machineId: transaction.machineId || "MACHINE_002"
        });

        if (!machine) {
            transaction.status = "REFUND_REQUIRED";
            transaction.failureReason = "Machine introuvable en mode test";
            await transaction.save();

            return res.status(404).json({
                succes: false,
                erreur: "Machine introuvable en mode test",
                transaction: {
                    reference: transaction.reference,
                    statut: transaction.status
                }
            });
        }

        await sendMqttAndMarkTransaction(
            transaction,
            machine,
            transaction.amountFcfa || transaction.montant,
            "wave_test"
        );

        return res.json({
            succes: true,
            message: `✅ ${transaction.amountFcfa || transaction.montant} FCFA payé - traitement effectué`,
            transaction: {
                reference: transaction.reference,
                transactionId: transaction.transactionId,
                machineId: transaction.machineId,
                montant: transaction.amountFcfa || transaction.montant,
                statut: transaction.status
            }
        });

    } catch (error) {
        return res.status(500).json({
            succes: false,
            erreur: error.message
        });
    }
});
router.get("/machine/:machineId/runtime", authMiddleware, async (req, res) => {
    try {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.set("Pragma", "no-cache");
        res.set("Expires", "0");

        const { machineId } = req.params;

        const machine = await Machine.findOne({ machineId }).lean();

        if (!machine) {
            return res.status(404).json({
                success: false,
                error: "Machine introuvable"
            });
        }

        const machineReady =
            machine.mqttOnline === true &&
            machine.machineCanAcceptPayment === true &&
            machine.canDispense === true &&
            (!machine.counterLevel || machine.counterLevel === "HIGH");

        return res.json({
            success: true,
            machine: {
                machineId: machine.machineId,
                mqttOnline: machine.mqttOnline === true,
                machineCanAcceptPayment: machine.machineCanAcceptPayment === true,
                canDispense: machine.canDispense === true,
                counterLevel: machine.counterLevel || null,
                currentState: machine.currentState || null,
                reason: machine.reason || null,
                lastSeenAt: machine.lastSeenAt || null,
                lastStatusAt: machine.lastStatusAt || null,
                updatedAt: machine.updatedAt || null,
                machineReady
            }
        });

    } catch (error) {
        console.error("❌ Erreur runtime machine :", error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;