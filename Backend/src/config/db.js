// src/config/db.js

const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;

        // Vérifier que l'URI est définie
        if (!uri) {
            throw new Error("❌ MONGODB_URI n'est pas définie dans le fichier .env");
        }

        console.log("🔌 Tentative de connexion à MongoDB...");
        console.log("📝 URI:", uri.replace(/\/\/(.*?):(.*?)@/, "//***:***@")); // Masque les credentials

        const conn = await mongoose.connect(uri, {
            // Options de connexion recommandées
            serverSelectionTimeoutMS: 5000, // Timeout après 5 secondes
            socketTimeoutMS: 45000, // Timeout socket après 45 secondes
        });

        console.log("====================================");
        console.log("✅ MongoDB connecté avec succès !");
        console.log("📊 Base de données:", conn.connection.db.databaseName);
        console.log("🖥️  Hôte:", conn.connection.host);
        console.log("🔌 Port:", conn.connection.port);
        console.log("====================================");

    } catch (error) {
        console.error("====================================");
        console.error("❌ Erreur connexion MongoDB:");
        console.error("Message:", error.message);
        console.error("====================================");

        // Réessayer la connexion après 5 secondes
        console.log("🔄 Nouvelle tentative dans 5 secondes...");
        setTimeout(connectDB, 5000);
    }
};

// Gestion des événements de connexion
mongoose.connection.on("connected", () => {
    console.log("📡 Mongoose: Événement 'connected'");
});

mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose: Erreur de connexion:", err.message);
});

mongoose.connection.on("disconnected", () => {
    console.log("⚠️ Mongoose: Déconnecté");
});

// Gestion propre de la fermeture
process.on("SIGINT", async () => {
    await mongoose.connection.close();
    console.log("👋 Mongoose: Connexion fermée (arrêt application)");
    process.exit(0);
});

module.exports = connectDB;