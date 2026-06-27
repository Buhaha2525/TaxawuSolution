// src/controllers/admin.controller.js

const User = require("../models/user.model");
const Machine = require("../models/machine.model");
const Transaction = require("../models/transaction.model");

// ============================================
// STATS GLOBALES (admin seulement)
// ============================================
exports.getGlobalStats = async (req, res) => {
    try {
        // Vérifier que l'utilisateur est admin
        if (req.userRole !== "ADMIN") {
            return res.status(403).json({ success: false, message: "Accès réservé aux administrateurs" });
        }

        const totalUsers = await User.countDocuments();
        const totalMachines = await Machine.countDocuments();
        const totalTransactions = await Transaction.countDocuments();

        // Revenus totaux
        const revenue = await Transaction.aggregate([
            { $match: { status: { $in: ["SUCCESS", "SUCCES", "COMPLETED", "DISPENSE_SENT", "PAID"] } } },
            { $group: { _id: null, total: { $sum: { $ifNull: ["$amountFcfa", "$montant"] } } } }
        ]);

        // Machines en ligne
        const onlineMachines = await Machine.countDocuments({ mqttOnline: true });

        // Utilisateurs actifs aujourd'hui
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const activeToday = await User.countDocuments({ lastLogin: { $gte: today } });

        // Revenus par méthode
        const revenueByMethod = await Transaction.aggregate([
            { $match: { status: { $in: ["SUCCESS", "SUCCES", "COMPLETED", "DISPENSE_SENT", "PAID"] } } },
            { $group: { _id: "$paymentMethod", total: { $sum: { $ifNull: ["$amountFcfa", "$montant"] } }, count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalMachines,
                totalTransactions,
                onlineMachines,
                activeToday,
                totalRevenue: revenue[0]?.total || 0,
                revenueByMethod
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// LISTE DES UTILISATEURS
// ============================================
exports.getUsers = async (req, res) => {
    try {
        if (req.userRole !== "ADMIN") {
            return res.status(403).json({ success: false, message: "Accès réservé aux administrateurs" });
        }

        const users = await User.find({})
            .select("-password")
            .sort({ createdAt: -1 })
            .lean();

        // Ajouter le nombre de machines par utilisateur
        const usersWithMachines = await Promise.all(users.map(async (user) => {
            const machineCount = await Machine.countDocuments({ ownerId: user._id });
            const transactionCount = await Transaction.countDocuments({ userId: user._id });
            return { ...user, machineCount, transactionCount };
        }));

        res.json({ success: true, users: usersWithMachines });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// LISTE DE TOUTES LES MACHINES
// ============================================
exports.getAllMachines = async (req, res) => {
    try {
        if (req.userRole !== "ADMIN") {
            return res.status(403).json({ success: false, message: "Accès réservé aux administrateurs" });
        }

        const machines = await Machine.find({})
            .sort({ createdAt: -1 })
            .lean();

        // Ajouter le nom du propriétaire
        const machinesWithOwner = await Promise.all(machines.map(async (machine) => {
            const owner = machine.ownerId ? await User.findById(machine.ownerId).select("name email").lean() : null;
            const txCount = await Transaction.countDocuments({ machineId: machine.machineId });
            return { ...machine, owner: owner || { name: "N/A", email: "N/A" }, transactionCount: txCount };
        }));

        res.json({ success: true, machines: machinesWithOwner });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// TOUTES LES TRANSACTIONS
// ============================================
exports.getAllTransactions = async (req, res) => {
    try {
        if (req.userRole !== "ADMIN") {
            return res.status(403).json({ success: false, message: "Accès réservé aux administrateurs" });
        }

        const transactions = await Transaction.find({})
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        res.json({ success: true, count: transactions.length, transactions });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};