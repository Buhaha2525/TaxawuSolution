// src/server.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const connectDB = require("./config/db");

// 🆕 Démarrer le nettoyage automatique des événements
const { startCleanupScheduler } = require("./services/cleanup.service");
startCleanupScheduler();

// Service MQTT
require("./services/mqtt.service")


// Routes
const paymentRoutes = require("./routes/payment.routes");
const machineRoutes = require("./routes/machine.routes");
const authRoutes = require("./routes/auth.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const waveRoutes = require("./routes/wave.routes");
const orangeRoutes = require("./routes/orange.routes");

// Service MQTT
require("./services/mqtt.service");

const app = express();

console.log("🚀 server.js exécuté");

// Connexion MongoDB
connectDB();

// ============================================
// MIDDLEWARES
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// ROUTES PAGES HTML
// ============================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "login.html"));
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "register.html"));
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "dashboard.html"));
});

app.get("/distributeur", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "distributeur-dashboard.html"));
});

app.get("/forgot-password", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "forgot-password.html"));
});

app.get("/reset-password", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "reset-password.html"));
});

// ============================================
// FICHIERS STATIQUES
// ============================================

app.use("/vendor", express.static(path.join(__dirname, "..", "public", "vendor"), {
    maxAge: "365d",
    immutable: true
}));

app.use("/css", express.static(path.join(__dirname, "..", "public", "css"), {
    maxAge: "7d"
}));

app.use("/js", express.static(path.join(__dirname, "..", "public", "js"), {
    maxAge: "7d"
}));

app.use("/", express.static(path.join(__dirname, "..", "public"), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
    }
}));

// ============================================
// ROUTES API
// ============================================

app.get("/api", (req, res) => {
    res.json({
        success: true,
        message: "Backend Distributeur Automatique OK",
        version: "1.0.0",
        endpoints: {
            auth: "/api/auth",
            payments: "/api/payments",
            machine: "/api/machine",
            dashboard: "/api/dashboard",
            wave: "/api/wave",
            orange: "/api/orange"
        }
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/machine", machineRoutes);
app.use("/api/wave", waveRoutes);
app.use("/api/orange", orangeRoutes);

// ============================================
// 404
// ============================================

app.use((req, res) => {
    if (req.path.startsWith("/api")) {
        return res.status(404).json({
            success: false,
            message: "Route API non trouvée"
        });
    }
    res.status(404).sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ============================================
// ERREURS GLOBALES
// ============================================

app.use((err, req, res, next) => {
    console.error("❌ Erreur serveur:", err);
    res.status(500).json({
        success: false,
        message: "Erreur interne du serveur",
        error: process.env.NODE_ENV === "development" ? err.message : "Une erreur est survenue"
    });
});

// ============================================
// DÉMARRAGE
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("============================================");
    console.log(`🚀 Serveur OK sur http://localhost:${PORT}`);
    console.log("============================================");
    console.log("📄 Pages :");
    console.log(`   Accueil       : http://localhost:${PORT}/`);
    console.log(`   Login         : http://localhost:${PORT}/login`);
    console.log(`   Register      : http://localhost:${PORT}/register`);
    console.log(`   Dashboard     : http://localhost:${PORT}/dashboard`);
    console.log(`   Distributeur  : http://localhost:${PORT}/distributeur`);
    console.log(`   Forgot Pass   : http://localhost:${PORT}/forgot-password`);
    console.log(`   Reset Pass    : http://localhost:${PORT}/reset-password`);
    console.log("============================================");
    console.log("🔌 APIs :");
    console.log(`   Auth          : http://localhost:${PORT}/api/auth`);
    console.log(`   Dashboard     : http://localhost:${PORT}/api/dashboard`);
    console.log(`   Payments      : http://localhost:${PORT}/api/payments`);
    console.log(`   Machine       : http://localhost:${PORT}/api/machine`);
    console.log(`   Wave          : http://localhost:${PORT}/api/wave`);
    console.log(`   Orange Money  : http://localhost:${PORT}/api/orange`);
    console.log("============================================");
});

module.exports = app;