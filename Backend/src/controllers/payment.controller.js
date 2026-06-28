// src/controllers/payment.controller.js

const mqttService = require("../services/mqtt.service");
const Transaction = require("../models/transaction.model");

exports.createPayment = async (req, res) => {
    try {
        const { montant, numero } = req.body;

        if (!montant || montant <= 0) {
            return res.status(400).json({ success: false, message: "Montant invalide" });
        }
        if (!numero) {
            return res.status(400).json({ success: false, message: "Numéro requis" });
        }

        // 🆕 Vérifier que l'utilisateur est connecté
        if (!req.userId) {
            return res.status(401).json({ success: false, message: "Authentification requise" });
        }

        const transaction = await Transaction.create({
            montant,
            numero,
            status: "PENDING",
            userId: req.userId
        });

        try {
            await mqttService.sendCommandToMachine({
                action: "DISPENSE",
                transactionId: transaction._id,
                montant,
                numero
            });

            transaction.status = "SENT";
            await transaction.save();

        } catch (mqttError) {
            transaction.status = "FAILED";
            await transaction.save();
            return res.status(500).json({ success: false, message: "Erreur envoi machine MQTT" });
        }

        res.json({ success: true, message: "Paiement envoyé", transaction });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

// 🆕 CORRIGÉ : TOUJOURS filtrer par userId
exports.getTransactions = async (req, res) => {
    try {
        // Si pas de userId, renvoyer un tableau vide
        if (!req.userId) {
            return res.json({ success: true, count: 0, transactions: [] });
        }

        // ✅ Récupérer TOUTES les transactions de l'utilisateur
        // + les transactions des machines qui lui appartiennent
        const Machine = require("../models/machine.model");
        const userMachines = await Machine.find({ ownerId: req.userId });
        const machineIds = userMachines.map(m => m.machineId);

        const transactions = await Transaction.find({
            $or: [
                { userId: req.userId },
                { machineId: { $in: machineIds } }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(100);

        console.log(`📊 Transactions trouvées: ${transactions.length} pour userId: ${req.userId}`);

        res.json({ success: true, count: transactions.length, transactions });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

exports.getTransactionById = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ success: false, message: "Authentification requise" });
        }

        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction introuvable" });
        }

        res.json({ success: true, transaction });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

exports.updateTransactionStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!req.userId) {
            return res.status(401).json({ success: false, message: "Authentification requise" });
        }

        const transaction = await Transaction.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { status },
            { new: true }
        );

        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction introuvable" });
        }

        res.json({ success: true, message: "Status mis à jour", transaction });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};
// ============================================
// EXPORT CSV
// ============================================
exports.exportCSV = async (req, res) => {
    try {
        let filter = {};

        // Si ADMIN → voir tout, sinon filtrer par userId
        if (req.userRole !== "ADMIN") {
            filter = { userId: req.userId };
        }

        const transactions = await Transaction.find(filter)
            .sort({ createdAt: -1 })
            .limit(1000);

        // Générer le CSV
        let csv = 'Date,Machine,Montant (FCFA),Méthode,Statut,Référence\n';
        transactions.forEach(t => {
            const date = t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : 'N/A';
            const machine = t.machineId || 'N/A';
            const amount = t.amountFcfa || t.montant || 0;
            const method = t.paymentMethod || 'N/A';
            const status = t.status || 'N/A';
            const reference = t.reference || 'N/A';

            csv += `${date},${machine},${amount},${method},${status},${reference}\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=taxawu-transactions-${Date.now()}.csv`);
        res.send('\uFEFF' + csv); // BOM pour Excel

    } catch (error) {
        console.error("Erreur export CSV:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};