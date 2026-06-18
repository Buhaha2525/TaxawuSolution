const express = require("express");
const QRCode = require("qrcode");

const router = express.Router();

const Machine = require("../models/machine.model");
const Transaction = require("../models/transaction.model");
const mqttService = require("../services/mqtt.service");
const orangeService = require("../services/orange.service");
const { authMiddleware } = require("../middleware/auth.middleware");

const TERMINAL_STATUSES = ["SUCCESS", "SUCCES", "PAID", "DISPENSE_SENT", "PAYMENT_FAILED", "REFUND_REQUIRED"];

function normalizeAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount) : NaN;
}

function parseMetadata(metadata) {
    if (!metadata) {
        return {};
    }

    if (typeof metadata === "object") {
        return metadata;
    }

    if (typeof metadata === "string") {
        try {
            return JSON.parse(metadata);
        } catch (error) {
            return { raw: metadata };
        }
    }

    return {};
}

function getPartnerCode(payload) {
    return (
        payload?.partner?.id ||
        payload?.partner?.code ||
        payload?.merchantCode ||
        payload?.code ||
        null
    );
}

function getOrangeTransactionId(payload) {
    return (
        payload?.transactionId ||
        payload?.transaction_id ||
        payload?.id ||
        payload?.reference ||
        null
    );
}

function getCustomerMsisdn(payload) {
    return (
        payload?.customer?.id ||
        payload?.customer?.msisdn ||
        payload?.customerMsisdn ||
        null
    );
}

function getCallbackReference(payload) {
    const metadata = parseMetadata(payload?.metadata);

    return (
        metadata.reference ||
        metadata.transactionReference ||
        payload?.reference ||
        payload?.clientReference ||
        null
    );
}

function isSuccessStatus(status) {
    return ["SUCCESS", "SUCCES", "COMPLETED", "PAID"].includes(String(status || "").toUpperCase());
}

function isValidMerchantCode(code) {
    return /^\d{6}$/.test(String(code || "").trim());
}

async function findMachineByMerchantCode(code) {
    if (!code) {
        return null;
    }

    return Machine.findOne({
        $or: [
            { orangeMerchantCode: String(code).trim() },
            { machineId: String(code).trim() }
        ]
    });
}

async function findExistingTransaction({ orangeTransactionId, reference }) {
    const queries = [];

    if (orangeTransactionId) {
        queries.push({ orangeTransactionId });
        queries.push({ transactionId: orangeTransactionId });
        queries.push({ reference: orangeTransactionId });
    }

    if (reference) {
        queries.push({ reference });
        queries.push({ transactionId: reference });
    }

    if (queries.length === 0) {
        return null;
    }

    return Transaction.findOne({ $or: queries }).sort({ createdAt: -1 });
}

async function sendDispenseAndUpdate(transaction, machine, amount, source) {
    try {
        await mqttService.sendDispenseCommand({
            machineId: machine.machineId,
            amountFcfa: amount,
            source
        });

        transaction.status = "DISPENSE_SENT";
        transaction.paidAt = transaction.paidAt || new Date();
        transaction.updatedAtByOrange = new Date();
        await transaction.save();

        return {
            success: true,
            transaction
        };
    } catch (error) {
        transaction.status = "REFUND_REQUIRED";
        transaction.failureReason = error.message;
        transaction.orangeCallbackPayload = transaction.orangeCallbackPayload || null;
        await transaction.save();

        return {
            success: false,
            transaction,
            error
        };
    }
}

router.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Orange Money integration is alive"
    });
});

router.get("/public-key", authMiddleware, async (req, res) => {
    try {
        const result = await orangeService.getPublicKey();

        if (!result.success) {
            return res.status(result.statusCode || 502).json(result);
        }

        return res.json({
            success: true,
            publicKey: result.data,
            raw: result.raw
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/merchant-callback", authMiddleware, async (req, res) => {
    try {
        const { machineId, callbackUrl, apiKey, name } = req.body;

        if (!machineId) {
            return res.status(400).json({ success: false, message: "machineId requis" });
        }

        const machine = await Machine.findOne({ machineId, ownerId: req.userId });
        if (!machine) {
            return res.status(404).json({ success: false, message: "Machine introuvable" });
        }

        if (!machine.orangeMerchantCode) {
            return res.status(400).json({
                success: false,
                message: "orangeMerchantCode manquant sur cette machine"
            });
        }

        if (!isValidMerchantCode(machine.orangeMerchantCode)) {
            return res.status(400).json({
                success: false,
                message: "orangeMerchantCode invalide : 6 chiffres attendus"
            });
        }

        const finalCallbackUrl = callbackUrl || process.env.ORANGE_CALLBACK_URL || machine.orangeCallbackUrl;
        if (!finalCallbackUrl) {
            return res.status(400).json({
                success: false,
                message: "callbackUrl requis"
            });
        }

        const result = await orangeService.setMerchantCallback({
            apiKey,
            callbackUrl: finalCallbackUrl,
            code: machine.orangeMerchantCode,
            name: name || machine.orangeMerchantName || machine.name || machine.machineId
        });

        if (!result.success) {
            return res.status(result.statusCode || 502).json(result);
        }

        machine.orangeCallbackUrl = finalCallbackUrl;
        if (name) {
            machine.orangeMerchantName = name;
        }
        await machine.save();

        return res.json({
            success: true,
            message: "Merchant callback Orange configuré",
            machine: {
                machineId: machine.machineId,
                orangeMerchantCode: machine.orangeMerchantCode,
                orangeMerchantName: machine.orangeMerchantName,
                orangeCallbackUrl: machine.orangeCallbackUrl
            },
            orange: result.data,
            raw: result.raw
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            raw: error.raw || null
        });
    }
});

router.get("/merchant-callback", authMiddleware, async (req, res) => {
    try {
        const { machineId, code, page, size } = req.query;

        let merchantCode = code || null;
        let machine = null;

        if (machineId) {
            machine = await Machine.findOne({ machineId, ownerId: req.userId });
            if (!machine) {
                return res.status(404).json({ success: false, message: "Machine introuvable" });
            }
            merchantCode = merchantCode || machine.orangeMerchantCode;
        }

        const result = await orangeService.getMerchantCallback({
            code: merchantCode,
            page,
            size
        });

        if (!result.success) {
            return res.status(result.statusCode || 502).json(result);
        }

        return res.json({
            success: true,
            machine: machine
                ? {
                    machineId: machine.machineId,
                    orangeMerchantCode: machine.orangeMerchantCode,
                    orangeCallbackUrl: machine.orangeCallbackUrl
                }
                : null,
            orange: result.data,
            raw: result.raw
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/qrcode", authMiddleware, async (req, res) => {
    try {
        const {
            machineId,
            amount,
            validity,
            metadata,
            callbackUrl,
            callbackSuccessUrl,
            callbackCancelUrl,
            name,
            apiKey,
            code
        } = req.body;

        if (!machineId) {
            return res.status(400).json({ success: false, message: "machineId requis" });
        }

        const machine = await Machine.findOne({ machineId, ownerId: req.userId });
        if (!machine) {
            return res.status(404).json({ success: false, message: "Machine introuvable" });
        }

        const merchantCode = code || machine.orangeMerchantCode;
        if (!merchantCode) {
            return res.status(400).json({
                success: false,
                message: "Code marchand Orange manquant pour cette machine"
            });
        }

        if (!isValidMerchantCode(merchantCode)) {
            return res.status(400).json({
                success: false,
                message: "Code marchand Orange invalide : 6 chiffres attendus"
            });
        }

        const amountValue = normalizeAmount(amount);
        if (!Number.isInteger(amountValue) || amountValue < 50) {
            return res.status(400).json({
                success: false,
                message: "Montant Orange Money invalide (minimum 50 FCFA)"
            });
        }

        if (amountValue % 50 !== 0) {
            return res.status(400).json({
                success: false,
                message: "Le montant doit être un multiple de 50 FCFA"
            });
        }

        const reference = `ORANGE_${machine.machineId}_${Date.now()}`;
        const callbackMetadata = {
            ...(parseMetadata(metadata) || {}),
            machineId: machine.machineId,
            orangeMerchantCode: merchantCode,
            ownerId: String(req.userId),
            reference
        };

        const transaction = await Transaction.create({
            userId: req.userId,
            machineId: machine.machineId,
            transactionId: reference,
            reference,
            amountFcfa: amountValue,
            montant: amountValue,
            paymentMethod: "ORANGE_MONEY",
            provider: "ORANGE_MONEY",
            source: "orange_merchant_qr",
            status: "PENDING_PAYMENT",
            orangeMerchantCode: merchantCode,
            orangeCallbackPayload: null
        });

        const orangeResult = await orangeService.createMerchantQrCode({
            code: merchantCode,
            name: name || machine.orangeMerchantName || machine.name || machine.machineId,
            amount: amountValue,
            callbackUrl: callbackUrl || machine.orangeCallbackUrl || process.env.ORANGE_CALLBACK_URL,
            callbackSuccessUrl,
            callbackCancelUrl,
            validity,
            metadata: callbackMetadata,
            apiKey
        });

        if (!orangeResult.success) {
            transaction.status = "PAYMENT_FAILED";
            transaction.failureReason = orangeResult.message || "Erreur création QR Orange Money";
            transaction.orangeQrResponse = orangeResult.raw || null;
            await transaction.save();

            return res.status(502).json({
                success: false,
                message: orangeResult.message || "Erreur création QR Orange Money",
                raw: orangeResult.raw || null
            });
        }

        const qrPayloadCandidate =
            orangeResult.data?.qrCode ||
            orangeResult.data?.qrcode ||
            orangeResult.data?.qr_code ||
            orangeResult.data?.url ||
            orangeResult.data?.paymentUrl ||
            orangeResult.data?.deepLink ||
            orangeResult.data?.deeplink ||
            orangeResult.data?.data ||
            null;

        const qrCodeDataUrl = qrPayloadCandidate
            ? await QRCode.toDataURL(String(qrPayloadCandidate))
            : null;

        transaction.orangeQrResponse = orangeResult.data;
        transaction.orangeMerchantCode = merchantCode;
        await transaction.save();

        return res.status(201).json({
            success: true,
            message: "QR code Orange Money généré",
            transaction: {
                reference,
                transactionId: reference,
                machineId: machine.machineId,
                amountFcfa: amountValue,
                status: transaction.status,
                orangeMerchantCode: merchantCode,
                qrCodeDataUrl,
                qrPayload: qrPayloadCandidate,
                orangeResponse: orangeResult.data
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            raw: error.raw || null
        });
    }
});

router.get("/webhook/test", (req, res) => {
    console.log("✅ Webhook Orange route est ACCESSIBLE");
    res.json({
        success: true,
        message: "Webhook Orange Money route is accessible",
        info: "POST to /api/orange/webhook/merchant-payment to simulate a payment callback"
    });
});

router.post("/webhook/merchant-payment", async (req, res) => {
    const payload = req.body || {};

    console.log("🔔 === WEBHOOK ORANGE MONEY REÇU ===");
    console.log("📍 Timestamp:", new Date().toISOString());
    console.log("📦 Payload complet:", JSON.stringify(payload, null, 2));
    console.log("🔔 ====================================");

    res.status(200).json({
        success: true,
        message: "Callback Orange Money reçu"
    });

    setImmediate(async () => {
        try {
            const orangeTransactionId = getOrangeTransactionId(payload);
            const partnerCode = getPartnerCode(payload);
            const customerMsisdn = getCustomerMsisdn(payload);
            const amount = normalizeAmount(payload?.amount?.value ?? payload?.amount ?? 0);
            const currency = payload?.amount?.unit || payload?.currency || "XOF";
            const status = String(payload?.status || "").toUpperCase();
            const callbackReference = getCallbackReference(payload);
            const metadata = parseMetadata(payload?.metadata);
            const machine = await findMachineByMerchantCode(partnerCode);

            const transactionQuery = await findExistingTransaction({
                orangeTransactionId,
                reference: callbackReference
            });

            if (transactionQuery && TERMINAL_STATUSES.includes(String(transactionQuery.status || "").toUpperCase())) {
                console.log("ℹ️ Callback Orange déjà traité :", {
                    orangeTransactionId,
                    reference: callbackReference,
                    status: transactionQuery.status
                });
                return;
            }

            if (!machine) {
                const reference = callbackReference || orangeTransactionId || `ORANGE_UNKNOWN_${Date.now()}`;
                await Transaction.create({
                    machineId: "UNKNOWN_ORANGE_MACHINE",
                    transactionId: reference,
                    reference,
                    amountFcfa: Number.isFinite(amount) ? amount : 0,
                    montant: Number.isFinite(amount) ? amount : 0,
                    paymentMethod: "ORANGE_MONEY",
                    provider: "ORANGE_MONEY",
                    source: "orange_merchant_qr",
                    status: isSuccessStatus(status) ? "REFUND_REQUIRED" : "PAYMENT_FAILED",
                    orangeTransactionId,
                    orangeMerchantCode: partnerCode,
                    orangeCustomerMsisdn: customerMsisdn,
                    orangeCallbackPayload: payload,
                    rawEvent: payload,
                    failureReason: "Machine introuvable pour ce code marchand"
                });

                console.log("❌ Code marchand Orange inconnu :", partnerCode);
                return;
            }

            if (currency !== "XOF") {
                const reference = callbackReference || orangeTransactionId || `ORANGE_${machine.machineId}_${Date.now()}`;
                const transaction = transactionQuery || await Transaction.create({
                    userId: machine.ownerId || null,
                    machineId: machine.machineId,
                    transactionId: reference,
                    reference,
                    amountFcfa: Number.isFinite(amount) ? amount : 0,
                    montant: Number.isFinite(amount) ? amount : 0,
                    paymentMethod: "ORANGE_MONEY",
                    provider: "ORANGE_MONEY",
                    source: "orange_merchant_qr",
                    status: "PAYMENT_FAILED",
                    orangeTransactionId,
                    orangeMerchantCode: partnerCode,
                    orangeCustomerMsisdn: customerMsisdn,
                    orangeCallbackPayload: payload,
                    rawEvent: payload,
                    failureReason: `Devise non supportée : ${currency}`
                });

                transaction.status = "PAYMENT_FAILED";
                transaction.orangeCallbackPayload = payload;
                transaction.failureReason = `Devise non supportée : ${currency}`;
                await transaction.save();
                return;
            }

            if (!isSuccessStatus(status)) {
                const reference = callbackReference || orangeTransactionId || `ORANGE_${machine.machineId}_${Date.now()}`;
                const transaction = transactionQuery || await Transaction.create({
                    userId: machine.ownerId || null,
                    machineId: machine.machineId,
                    transactionId: reference,
                    reference,
                    amountFcfa: Number.isFinite(amount) ? amount : 0,
                    montant: Number.isFinite(amount) ? amount : 0,
                    paymentMethod: "ORANGE_MONEY",
                    provider: "ORANGE_MONEY",
                    source: "orange_merchant_qr",
                    status: "PAYMENT_FAILED",
                    orangeTransactionId,
                    orangeMerchantCode: partnerCode,
                    orangeCustomerMsisdn: customerMsisdn,
                    orangeCallbackPayload: payload,
                    rawEvent: payload,
                    failureReason: `Paiement Orange non confirmé : ${status || "UNKNOWN"}`
                });

                transaction.status = "PAYMENT_FAILED";
                transaction.orangeCallbackPayload = payload;
                transaction.failureReason = `Paiement Orange non confirmé : ${status || "UNKNOWN"}`;
                await transaction.save();
                return;
            }

            const reference = callbackReference || orangeTransactionId || `ORANGE_${machine.machineId}_${Date.now()}`;
            const expectedTransaction = transactionQuery || await Transaction.create({
                userId: machine.ownerId || null,
                machineId: machine.machineId,
                transactionId: reference,
                reference,
                amountFcfa: Number.isFinite(amount) ? amount : 0,
                montant: Number.isFinite(amount) ? amount : 0,
                paymentMethod: "ORANGE_MONEY",
                provider: "ORANGE_MONEY",
                source: "orange_merchant_qr",
                status: "PAID",
                orangeTransactionId,
                orangeMerchantCode: partnerCode,
                orangeCustomerMsisdn: customerMsisdn,
                orangeCallbackPayload: payload,
                rawEvent: payload,
                paidAt: new Date()
            });

            expectedTransaction.status = "PAID";
            expectedTransaction.orangeTransactionId = orangeTransactionId || expectedTransaction.orangeTransactionId;
            expectedTransaction.orangeMerchantCode = partnerCode || expectedTransaction.orangeMerchantCode;
            expectedTransaction.orangeCustomerMsisdn = customerMsisdn || expectedTransaction.orangeCustomerMsisdn;
            expectedTransaction.orangeCallbackPayload = payload;
            expectedTransaction.rawEvent = payload;
            expectedTransaction.paidAt = expectedTransaction.paidAt || new Date();
            await expectedTransaction.save();

            console.log("✅ Paiement Orange confirmé :", {
                machineId: machine.machineId,
                partnerCode,
                amount,
                orangeTransactionId,
                metadata
            });

            await sendDispenseAndUpdate(expectedTransaction, machine, amount, "orange_merchant_qr");
        } catch (error) {
            console.error("❌ Erreur traitement callback Orange Money :", error);
        }
    });
});

router.get("/transactions/:transactionId/status", authMiddleware, async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            $or: [
                { transactionId: req.params.transactionId },
                { reference: req.params.transactionId },
                { orangeTransactionId: req.params.transactionId }
            ]
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction introuvable"
            });
        }

        return res.json({
            success: true,
            status: transaction.status,
            transaction: {
                transactionId: transaction.transactionId,
                reference: transaction.reference,
                orangeTransactionId: transaction.orangeTransactionId || null,
                paymentMethod: transaction.paymentMethod,
                status: transaction.status,
                amountFcfa: transaction.amountFcfa,
                machineId: transaction.machineId
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;





