// src/controllers/dashboard.controller.js

const Machine = require("../models/machine.model");
const Transaction = require("../models/transaction.model");

// ============================================
// HELPERS
// ============================================

function getAuthUserId(req) {
    return (
        req.userId ||
        req.user?._id ||
        req.user?.id ||
        req.user?.ownerId ||
        req.auth?.userId ||
        req.auth?.id
    );
}

function getOwnerName(req) {
    return (
        req.user?.name ||
        req.user?.email ||
        req.userName ||
        "Utilisateur"
    );
}

function machineOwnerQuery(userId) {
    return {
        $or: [
            { ownerId: userId },
            { ownerUserId: userId },
            { userId: userId },
            { owner: userId }
        ]
    };
}

function transactionOwnerQuery(userId, machineIds = []) {
    const query = {
        $or: [
            { ownerId: userId },
            { ownerUserId: userId },
            { userId: userId },
            { owner: userId }
        ]
    };
    if (machineIds.length > 0) {
        query.$or.push({ machineId: { $in: machineIds } });
    }
    return query;
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function getAmount(tx) {
    return toNumber(tx.amountFcfa || tx.montant || tx.amount || tx.price || 0);
}

function isPaidStatus(status) {
    return ["PAID", "SENT", "DISPENSE_SENT", "SUCCESS", "SUCCES", "COMPLETED"].includes(status);
}

function isSuccessStatus(status) {
    return ["SUCCESS", "SUCCES", "COMPLETED"].includes(status);
}

function isFailedStatus(status) {
    return ["FAILED", "PAYMENT_FAILED", "REFUND_REQUIRED"].includes(status);
}

function isPendingStatus(status) {
    return ["PENDING", "PENDING_PAYMENT", "PAID", "SENT", "DISPENSE_SENT", "DETECTED"].includes(status);
}

function getMachineReady(machine) {
    return (
        machine.mqttOnline === true &&
        machine.machineCanAcceptPayment === true &&
        machine.canDispense === true &&
        (!machine.counterLevel || machine.counterLevel === "HIGH")
    );
}

function isCoinPayment(tx) {
    return tx.paymentMethod === "PHYSICAL_COIN" || tx.source === "physical_coin";
}

function isWavePayment(tx) {
    return tx.paymentMethod === "WAVE" || (tx.source && tx.source.includes("wave"));
}

function isOmPayment(tx) {
    return tx.paymentMethod === "ORANGE_MONEY";
}

// ============================================
// STATISTIQUES QUOTIDIENNES
// ============================================

function buildDailyStats(transactions) {
    const days = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().slice(0, 10);
        days.push({
            date: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
            key,
            coin: 0,
            wave: 0,
            om: 0,
            total: 0
        });
    }

    const dayMap = new Map(days.map(d => [d.key, d]));

    transactions.filter(tx => isPaidStatus(tx.status)).forEach(tx => {
        const date = tx.createdAt || tx.paidAt || tx.updatedAt;
        if (!date) return;
        const key = new Date(date).toISOString().slice(0, 10);
        if (dayMap.has(key)) {
            const day = dayMap.get(key);
            const amount = getAmount(tx);
            day.total += amount;
            if (isCoinPayment(tx)) day.coin += amount;
            else if (isWavePayment(tx)) day.wave += amount;
            else if (isOmPayment(tx)) day.om += amount;
        }
    });

    return days;
}

function buildDailyRevenue(transactions) {
    return buildDailyStats(transactions).map(d => ({
        date: d.date,
        amount: d.total
    }));
}

// ============================================
// NORMALISATION MACHINE
// ============================================

function normalizeMachine(machine, machineTransactions = []) {
    const paidTransactions = machineTransactions.filter(tx => isPaidStatus(tx.status));

    // Totaux
    const totalRevenue = paidTransactions.reduce((sum, tx) => sum + getAmount(tx), 0);
    const totalTransactions = machineTransactions.length;
    const successTransactions = machineTransactions.filter(tx => isSuccessStatus(tx.status)).length;
    const failedTransactions = machineTransactions.filter(tx => isFailedStatus(tx.status)).length;
    const pendingTransactions = machineTransactions.filter(tx => isPendingStatus(tx.status)).length;

    // Revenus par méthode
    const coinRevenue = paidTransactions.filter(tx => isCoinPayment(tx)).reduce((sum, tx) => sum + getAmount(tx), 0);
    const waveRevenue = paidTransactions.filter(tx => isWavePayment(tx)).reduce((sum, tx) => sum + getAmount(tx), 0);
    const omRevenue = paidTransactions.filter(tx => isOmPayment(tx)).reduce((sum, tx) => sum + getAmount(tx), 0);
    const mobileRevenue = waveRevenue + omRevenue;

    // Compteurs par méthode
    const coinCount = paidTransactions.filter(tx => isCoinPayment(tx)).length;
    const waveCount = paidTransactions.filter(tx => isWavePayment(tx)).length;
    const omCount = paidTransactions.filter(tx => isOmPayment(tx)).length;

    // Données graphique
    const dailyStats = buildDailyStats(machineTransactions);

    const machineReady = getMachineReady(machine);

    return {
        _id: machine._id,
        machineId: machine.machineId,
        name: machine.name || machine.machineId,
        location: machine.location || "Non défini",
        orangeMerchantCode: machine.orangeMerchantCode || null,
        orangeMerchantName: machine.orangeMerchantName || null,
        orangeCallbackUrl: machine.orangeCallbackUrl || null,
        status: machine.status || "ACTIVE",
        mqttOnline: machine.mqttOnline === true,
        machineCanAcceptPayment: machine.machineCanAcceptPayment === true,
        canDispense: machine.canDispense === true,
        counterLevel: machine.counterLevel || null,
        currentState: machine.currentState || null,
        reason: machine.reason || null,
        lastStatusAt: machine.lastStatusAt || machine.updatedAt,
        updatedAt: machine.updatedAt,
        machineReady,

        totalRevenue,
        totalTransactions,
        successTransactions,
        failedTransactions,
        pendingTransactions,

        coinRevenue,
        waveRevenue,
        omRevenue,
        mobileRevenue,
        coinCount,
        waveCount,
        omCount,

        dailyStats,
        transactions: machineTransactions.slice(0, 5)
    };
}

// ============================================
// DASHBOARD STATS
// ============================================

exports.getDashboardStats = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        if (!userId) return res.status(401).json({ success: false, message: "Non authentifié" });

        const machinesRaw = await Machine.find(machineOwnerQuery(userId)).sort({ createdAt: -1 }).lean();
        const machineIds = machinesRaw.map(m => m.machineId);

        const transactionsRaw = await Transaction.find(transactionOwnerQuery(userId, machineIds))
            .sort({ createdAt: -1 }).limit(500).lean();

        const transactionsByMachine = {};
        transactionsRaw.forEach(tx => {
            if (!tx.machineId) return;
            if (!transactionsByMachine[tx.machineId]) transactionsByMachine[tx.machineId] = [];
            transactionsByMachine[tx.machineId].push(tx);
        });

        const machines = machinesRaw.map(machine => {
            const txs = transactionsByMachine[machine.machineId] || [];
            return normalizeMachine(machine, txs);
        });

        const totalRevenue = transactionsRaw.filter(tx => isPaidStatus(tx.status)).reduce((s, tx) => s + getAmount(tx), 0);
        const totalCoinRevenue = transactionsRaw.filter(tx => isPaidStatus(tx.status) && isCoinPayment(tx)).reduce((s, tx) => s + getAmount(tx), 0);
        const totalMobileRevenue = transactionsRaw.filter(tx => isPaidStatus(tx.status) && (isWavePayment(tx) || isOmPayment(tx))).reduce((s, tx) => s + getAmount(tx), 0);

        const totalTransactions = transactionsRaw.length;
        const successTransactions = transactionsRaw.filter(tx => isSuccessStatus(tx.status)).length;
        const failedTransactions = transactionsRaw.filter(tx => isFailedStatus(tx.status)).length;
        const pendingTransactions = transactionsRaw.filter(tx => isPendingStatus(tx.status)).length;
        const onlineMachines = machines.filter(m => m.mqttOnline).length;
        const availableMachines = machines.filter(m => m.machineReady).length;

        const machineStats = machines.map(m => ({
            machineId: m.machineId,
            name: m.name,
            revenue: m.totalRevenue,
            transactions: m.totalTransactions
        }));

        const dailyRevenue = buildDailyRevenue(transactionsRaw);

        res.json({
            success: true,
            data: {
                ownerName: getOwnerName(req),
                stats: {
                    totalRevenue,
                    totalCoinRevenue,
                    totalMobileRevenue,
                    totalTransactions,
                    successTransactions,
                    failedTransactions,
                    pendingTransactions,
                    totalMachines: machines.length,
                    onlineMachines,
                    availableMachines
                },
                machines,
                transactions: transactionsRaw.slice(0, 30),
                dailyRevenue,
                machineStats
            }
        });

    } catch (error) {
        console.error("❌ Erreur getDashboardStats:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// CRUD MACHINES
// ============================================

exports.addMachine = async (req, res) => {
    try {
        const ownerId = getAuthUserId(req);
        const { machineId, name, location, orangeMerchantCode, orangeMerchantName, orangeCallbackUrl } = req.body;
        if (!ownerId) return res.status(401).json({ success: false, message: "Non authentifié" });
        if (!machineId || !name || !location) return res.status(400).json({ success: false, message: "Champs requis" });

        const normalizedId = String(machineId).trim().toUpperCase();
        const existing = await Machine.findOne({ machineId: normalizedId });
        if (existing) {
            if (String(existing.ownerId) === String(ownerId)) return res.status(409).json({ success: false, message: "Déjà dans votre compte" });
            return res.status(409).json({ success: false, message: "Appartient à un autre compte" });
        }

        const machine = await Machine.create({
            machineId: normalizedId,
            name,
            location,
            ownerId,
            status: "ACTIVE",
            mqttOnline: false,
            machineCanAcceptPayment: false,
            canDispense: false,
            currentState: "CREATED",
            ...(orangeMerchantCode ? { orangeMerchantCode: String(orangeMerchantCode).trim() } : {}),
            ...(orangeMerchantName ? { orangeMerchantName: String(orangeMerchantName).trim() } : {}),
            ...(orangeCallbackUrl ? { orangeCallbackUrl: String(orangeCallbackUrl).trim() } : {})
        });
        res.status(201).json({ success: true, message: "Machine ajoutée", machine });

    } catch (error) {
        console.error("❌ addMachine:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMachineDetails = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        const machine = await Machine.findOne({ machineId: req.params.machineId, ...machineOwnerQuery(userId) }).lean();
        if (!machine) return res.status(404).json({ success: false, message: "Introuvable" });
        const transactions = await Transaction.find({ machineId: machine.machineId }).sort({ createdAt: -1 }).limit(50).lean();
        res.json({ success: true, machine: normalizeMachine(machine, transactions), transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateMachine = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        const { name, location, status, orangeMerchantCode, orangeMerchantName, orangeCallbackUrl } = req.body;
        const machine = await Machine.findOneAndUpdate(
            { machineId: req.params.machineId, ...machineOwnerQuery(userId) },
            {
                ...(name !== undefined ? { name } : {}),
                ...(location !== undefined ? { location } : {}),
                ...(status !== undefined ? { status } : {}),
                ...(orangeMerchantCode !== undefined ? { orangeMerchantCode: orangeMerchantCode ? String(orangeMerchantCode).trim() : null } : {}),
                ...(orangeMerchantName !== undefined ? { orangeMerchantName: orangeMerchantName ? String(orangeMerchantName).trim() : null } : {}),
                ...(orangeCallbackUrl !== undefined ? { orangeCallbackUrl: orangeCallbackUrl ? String(orangeCallbackUrl).trim() : null } : {})
            },
            { new: true }
        );
        if (!machine) return res.status(404).json({ success: false, message: "Introuvable" });
        res.json({ success: true, message: "Modifiée", machine });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteMachine = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        const txCount = await Transaction.countDocuments({ machineId: req.params.machineId });
        if (txCount > 0) return res.status(400).json({ success: false, message: `${txCount} transactions associées` });
        const machine = await Machine.findOneAndDelete({ machineId: req.params.machineId, ...machineOwnerQuery(userId) });
        if (!machine) return res.status(404).json({ success: false, message: "Introuvable" });
        res.json({ success: true, message: "Supprimée" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.archiveMachine = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        const machine = await Machine.findOneAndUpdate({ machineId: req.params.machineId, ...machineOwnerQuery(userId) }, { status: "INACTIVE" }, { new: true });
        if (!machine) return res.status(404).json({ success: false, message: "Introuvable" });
        res.json({ success: true, message: "Archivée" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.reactivateMachine = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        const machine = await Machine.findOneAndUpdate({ machineId: req.params.machineId, ...machineOwnerQuery(userId) }, { status: "ACTIVE" }, { new: true });
        if (!machine) return res.status(404).json({ success: false, message: "Introuvable" });
        res.json({ success: true, message: "Réactivée" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.simulateTransaction = async (req, res) => {
    try {
        const userId = getAuthUserId(req);
        const { machineId, liters } = req.body;
        if (!machineId || !liters || Number(liters) <= 0) return res.status(400).json({ success: false, message: "Paramètres requis" });
        const machine = await Machine.findOne({ machineId, ...machineOwnerQuery(userId) });
        if (!machine) return res.status(404).json({ success: false, message: "Introuvable" });
        const amountFcfa = Math.round(toNumber(liters) * toNumber(machine.pricePerLiter || 100));
        const transaction = await Transaction.create({
            transactionId: `SIM_${machineId}_${Date.now()}`, machineId, userId, amountFcfa,
            paymentMethod: "BACKEND_TEST", source: "dashboard_simulation", status: "SUCCESS"
        });
        res.status(201).json({ success: true, message: "Simulation réussie", transaction });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};