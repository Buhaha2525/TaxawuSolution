// seed-production.js
// Script pour initialiser une base de production propre

require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./src/models/user.model");
const Machine = require("./src/models/machine.model");
const Transaction = require("./src/models/transaction.model");
const MachineEvent = require("./src/models/machineEvent.model");
const ResetToken = require("./src/models/resetToken.model");

async function seedProduction() {
    try {
        console.log("🌱 Initialisation de la base de production...\n");

        // 1. Connexion
        console.log("🔌 Connexion MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connecté !\n");

        // 2. Nettoyer TOUTES les collections
        console.log("🧹 Nettoyage complet de la base...");
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const collection of collections) {
            await mongoose.connection.db.dropCollection(collection.name);
            console.log(`   🗑️  ${collection.name}`);
        }
        console.log("✅ Base complètement vidée !\n");

        // 3. Créer l'admin par défaut
        console.log("👤 Création de l'administrateur...");
        const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || "Senegal2024";

        const admin = await User.create({
            email: process.env.ADMIN_EMAIL || "sowdmzz@gmail.com",
            password: adminPassword,
            name: "Administrateur",
            phone: "770000000",
            role: "ADMIN",
            companyName: "AquaCashFlow",
            isActive: true
        });

        console.log(`   ✅ Admin créé : ${admin.email}`);
        console.log(`   🔑 Mot de passe : ${adminPassword}`);
        console.log(`   ⚠️  CHANGEZ CE MOT DE PASSE APRÈS LA PREMIÈRE CONNEXION !\n`);

        // 4. Résumé
        const usersCount = await User.countDocuments();
        const machinesCount = await Machine.countDocuments();
        const transactionsCount = await Transaction.countDocuments();
        const eventsCount = await MachineEvent.countDocuments();

        console.log("=".repeat(50));
        console.log("📊 RÉSUMÉ BASE DE PRODUCTION");
        console.log("=".repeat(50));
        console.log(`   👤 Utilisateurs   : ${usersCount}`);
        console.log(`   🚰 Machines       : ${machinesCount}`);
        console.log(`   💳 Transactions   : ${transactionsCount}`);
        console.log(`   📡 Événements     : ${eventsCount}`);
        console.log("=".repeat(50));

        console.log("\n✅ Base de production prête !");
        console.log("\n📝 Informations de connexion :");
        console.log(`   Email    : ${admin.email}`);
        console.log(`   Password : ${adminPassword}`);
        console.log("   URL      : https://aquacashflow.com/login");
        console.log("\n⚠️  CHANGEZ LE MOT DE PASSE ADMIN APRÈS LA PREMIÈRE CONNEXION !\n");

    } catch (error) {
        console.error("❌ Erreur :", error);
    } finally {
        await mongoose.connection.close();
        console.log("👋 Déconnexion MongoDB\n");
        process.exit(0);
    }
}

seedProduction();