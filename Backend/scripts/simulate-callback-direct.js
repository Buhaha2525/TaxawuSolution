#!/usr/bin/env node
require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const Machine = require("../src/models/machine.model");
const Transaction = require("../src/models/transaction.model");
const mqttService = require("../src/services/mqtt.service");

const MONGO = process.env.MONGODB_URI;

const payload = {
  "amount": {
    "value": 100,
    "unit": "XOF"
  },
  "partner": {
    "idType": "CODE",
    "id": "614841"
  },
  "customer": {
    "idType": "MSISDN",
    "id": "771234567"
  },
  "reference": "simulated-static-qr-payment-direct",
  "type": "MERCHANT_PAYMENT",
  "channel": "API",
  "transactionId": "MP_SIMULATED_DIRECT_123456",
  "paymentMethod": "QRCODE",
  "status": "SUCCESS"
};

// Helper functions from orange.routes.js
function normalizeAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount) : NaN;
}

function parseMetadata(metadata) {
    if (!metadata) return {};
    if (typeof metadata === "object") return metadata;
    if (typeof metadata === "string") {
        try { return JSON.parse(metadata); } catch (e) { return { raw: metadata }; }
    }
    return {};
}

function getPartnerCode(payload) {
    return payload?.partner?.id || payload?.partner?.code || payload?.merchantCode || payload?.code || null;
}

function getOrangeTransactionId(payload) {
    return payload?.transactionId || payload?.transaction_id || payload?.id || payload?.reference || null;
}

function getCustomerMsisdn(payload) {
    return payload?.customer?.id || payload?.customer?.msisdn || payload?.customerMsisdn || null;
}

function getCallbackReference(payload) {
    const metadata = parseMetadata(payload?.metadata);
    return metadata.reference || metadata.transactionReference || payload?.reference || payload?.clientReference || null;
}

function isSuccessStatus(status) {
    return ["SUCCESS", "SUCCES", "COMPLETED", "PAID"].includes(String(status || "").toUpperCase());
}

async function findMachineByMerchantCode(code) {
    if (!code) return null;
    return Machine.findOne({
        $or: [
            { orangeMerchantCode: String(code).trim() },
            { machineId: String(code).trim() }
        ]
    });
}

async function findExistingTransaction({ orangeTransactionId, reference, machineId }) {
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
    if (machineId) {
        queries.push({
            machineId,
            paymentMethod: "ORANGE_MONEY",
            status: { $in: ["SUCCESS", "SUCCES", "PAID", "DISPENSE_SENT", "PAYMENT_FAILED", "REFUND_REQUIRED"] }
        });
    }
    if (queries.length === 0) return null;
    return Transaction.findOne({ $or: queries }).sort({ createdAt: -1 });
}

async function run() {
    try {
        await mongoose.connect(MONGO);
        console.log("Connected to MongoDB");

        const orangeTransactionId = getOrangeTransactionId(payload);
        const partnerCode = getPartnerCode(payload);
        const customerMsisdn = getCustomerMsisdn(payload);
        const amount = normalizeAmount(payload?.amount?.value ?? payload?.amount ?? 0);
        const currency = payload?.amount?.unit || payload?.currency || "XOF";
        const status = String(payload?.status || "").toUpperCase();
        const callbackReference = getCallbackReference(payload);
        const metadata = parseMetadata(payload?.metadata);
        
        console.log("Extracted fields:", { orangeTransactionId, partnerCode, customerMsisdn, amount, currency, status, callbackReference });

        const machine = await findMachineByMerchantCode(partnerCode);
        console.log("Found machine:", machine ? machine.machineId : "NONE");

        const transactionQuery = await findExistingTransaction({
            orangeTransactionId,
            reference: callbackReference,
            machineId: machine?.machineId || null
        });
        console.log("Existing transaction query result:", transactionQuery ? transactionQuery.transactionId : "NONE");

        if (!machine) {
            console.log("Machine not found, creating unknown machine transaction...");
            const reference = callbackReference || orangeTransactionId || `ORANGE_UNKNOWN_${Date.now()}`;
            await Transaction.create({
                machineId: "UNKNOWN_ORANGE_MACHINE",
                transactionId: reference,
                reference,
                amountFcfa: amount,
                montant: amount,
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
            console.log("Created unknown machine transaction");
            return;
        }

        if (currency !== "XOF") {
            console.log("Currency is not XOF:", currency);
            return;
        }

        if (!isSuccessStatus(status)) {
            console.log("Status is not success:", status);
            return;
        }

        const reference = callbackReference || orangeTransactionId || `ORANGE_${machine.machineId}_${Date.now()}`;
        console.log("Using reference:", reference);

        const expectedTransaction = transactionQuery || await Transaction.create({
            userId: machine.ownerId || null,
            machineId: machine.machineId,
            transactionId: reference,
            reference,
            amountFcfa: amount,
            montant: amount,
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

        console.log("Created/Found transaction in code flow:", expectedTransaction.transactionId);

        expectedTransaction.status = "PAID";
        expectedTransaction.orangeTransactionId = orangeTransactionId || expectedTransaction.orangeTransactionId;
        expectedTransaction.orangeMerchantCode = partnerCode || expectedTransaction.orangeMerchantCode;
        expectedTransaction.orangeCustomerMsisdn = customerMsisdn || expectedTransaction.orangeCustomerMsisdn;
        expectedTransaction.orangeCallbackPayload = payload;
        expectedTransaction.rawEvent = payload;
        expectedTransaction.paidAt = expectedTransaction.paidAt || new Date();
        await expectedTransaction.save();
        console.log("Saved transaction successfully!");

    } catch (err) {
        console.error("Execution error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
