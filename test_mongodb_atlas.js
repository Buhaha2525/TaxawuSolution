/**
 * 🧪 TEST MONGODB ATLAS
 *
 * Exécutez ce script pour vérifier que votre connexion Atlas fonctionne
 * node test_mongodb_atlas.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

console.log("\n🧪 TEST MONGODB ATLAS CONNECTION\n");

async function testConnection() {
    try {
        // 1. Afficher la chaîne (sans le mot de passe)
        const uri = process.env.MONGODB_URI;
        const safeUri = uri.replace(/mongodb\+srv:\/\/.*:.*@/, "mongodb+srv://***:***@");
        console.log("📍 URI:", safeUri);

        // 2. Connecter à MongoDB Atlas
        console.log("\n⏳ Connexion à MongoDB Atlas...");

        await mongoose.connect(process.env.MONGODB_URI, {
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000
        });

        console.log("✅ CONNECTÉ À MONGODB ATLAS!\n");

        // 3. Vérifier le statut
        const db = mongoose.connection;
        console.log("📊 Infos de la connexion:");
        console.log("   - Host:", db.host);
        console.log("   - Port:", db.port);
        console.log("   - Database:", db.name);
        console.log("   - State:", db.readyState === 1 ? "Connected" : "Disconnected");

        // 4. Lister les collections
        const collections = await db.db.listCollections().toArray();
        console.log("\n📚 Collections dans la base:");

        if (collections.length === 0) {
            console.log("   (Aucune collection - c'est normal pour un nouveau cluster)");
        } else {
            collections.forEach(col => {
                console.log(`   - ${col.name}`);
            });
        }

        // 5. Test de création de document
        console.log("\n🧪 Test: Créer une document de test...");

        const testSchema = new mongoose.Schema({
            message: String,
            timestamp: Date
        });

        const TestModel = mongoose.model("TestDoc", testSchema);

        const testDoc = await TestModel.create({
            message: "Test de connexion MongoDB Atlas",
            timestamp: new Date()
        });

        console.log("✅ Document créé avec succès!");
        console.log("   ID:", testDoc._id);

        // 6. Lire le document
        const found = await TestModel.findById(testDoc._id);
        console.log("✅ Document trouvé!");
        console.log("   Message:", found.message);

        // 7. Supprimer le test
        await TestModel.deleteOne({ _id: testDoc._id });
        console.log("✅ Document de test supprimé");

        console.log("\n════════════════════════════════════════════");
        console.log("✅ TOUS LES TESTS PASSÉS!");
        console.log("════════════════════════════════════════════\n");

        console.log("Prochaines étapes:");
        console.log("1. Lancez votre serveur: node src/server.js");
        console.log("2. Testez un paiement");
        console.log("3. Vérifiez dans MongoDB Atlas Dashboard");

    } catch (error) {
        console.error("\n❌ ERREUR DE CONNEXION:\n");

        if (error.message.includes("ENOTFOUND")) {
            console.error("   ⚠️  Problème réseau ou DNS");
            console.error("   → Vérifiez votre connexion internet");
        } else if (error.message.includes("authentication failed")) {
            console.error("   ⚠️  Authentification échouée");
            console.error("   → Vérifier username/password dans .env");
        } else if (error.message.includes("IP address")) {
            console.error("   ⚠️  IP non autorisée");
            console.error("   → Aller à MongoDB Atlas > Network Access");
            console.error("   → Ajouter 0.0.0.0/0");
        } else if (error.message.includes("ECONNREFUSED")) {
            console.error("   ⚠️  Connexion refusée");
            console.error("   → Vérifier que le cluster est créé");
        } else {
            console.error("   Message:", error.message);
        }

        console.error("\n📞 Aide:");
        console.error("   - Vérifiez votre .env");
        console.error("   - Vérifiez Network Access dans Atlas");
        console.error("   - Lisez MONGODB_ATLAS_SETUP.md");

        process.exit(1);
    } finally {
        // Fermer la connexion
        await mongoose.connection.close();
        console.log("🔌 Connexion fermée\n");
    }
}

// Lancer le test
testConnection();

