require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const rateLimit = require("express-rate-limit");
const adminRoutes = require("./routes/admin.routes");
const compression = require("compression");

// Rate limiters
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { success: false, message: "Trop de requêtes, réessayez plus tard." }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: "Trop de tentatives de connexion." }
});

// Nettoyage automatique
const { startCleanupScheduler } = require("./services/cleanup.service");
startCleanupScheduler();

// Service MQTT
require("./services/mqtt.service");

// Routes
const paymentRoutes = require("./routes/payment.routes");
const machineRoutes = require("./routes/machine.routes");
const authRoutes = require("./routes/auth.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const waveRoutes = require("./routes/wave.routes");
const orangeRoutes = require("./routes/orange.routes");

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
// Après les middlewares de base
app.use(compression({
    level: 6,  // Niveau de compression (1-9)
    threshold: 0  // Compresser toutes les réponses
}));
// Rate limiting
app.use("/api/", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

// ============================================
// ROUTES PAGES HTML
// ============================================
app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "..", "public", "index.html")); });
app.get("/login", (req, res) => { res.sendFile(path.join(__dirname, "..", "public", "login.html")); });
app.get("/register", (req, res) => { res.sendFile(path.join(__dirname, "..", "public", "register.html")); });
app.get("/dashboard", (req, res) => { res.sendFile(path.join(__dirname, "..", "public", "dashboard.html")); });
app.get("/distributeur", (req, res) => { res.sendFile(path.join(__dirname, "..", "public", "distributeur-dashboard.html")); });
app.get("/forgot-password", (req, res) => { res.sendFile(path.join(__dirname, "..", "public", "forgot-password.html")); });
app.get("/reset-password", (req, res) => { res.sendFile(path.join(__dirname, "..", "public", "reset-password.html")); });
app.get("/profil", (req, res) => { res.sendFile(path.join(__dirname, "..", "public", "profil.html")); });
// Service Worker (pas de cache)
app.get("/sw.js", (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "application/javascript");
    res.sendFile(path.join(__dirname, "..", "public", "sw.js"));
});
// ============================================
// FICHIERS STATIQUES
// ============================================
// Fichiers statiques avec cache agressif
app.use("/css", express.static(path.join(__dirname, "..", "public", "css"), {
    maxAge: "30d",
    immutable: true
}));

app.use("/js", express.static(path.join(__dirname, "..", "public", "js"), {
    maxAge: "30d",
    immutable: true
}));

app.use("/vendor", express.static(path.join(__dirname, "..", "public", "vendor"), {
    maxAge: "365d",
    immutable: true
}));

app.use("/icon-192.png", express.static(path.join(__dirname, "..", "public"), {
    maxAge: "365d",
    immutable: true
}));

app.use("/icon-512.png", express.static(path.join(__dirname, "..", "public"), {
    maxAge: "365d",
    immutable: true
}));
app.use("/", express.static(path.join(__dirname, "..", "public"), {
    setHeaders: (res, filePath) => { if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache"); }
}));
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "admin.html"));
});

// ============================================
// ROUTES API
// ============================================
app.get("/api", (req, res) => {
    res.json({ success: true, message: "Backend Taxawu Solution OK", version: "1.0.0" });
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/machine", machineRoutes);
app.use("/api/wave", waveRoutes);
app.use("/api/orange", orangeRoutes);
app.use("/api/orange-money", require("./routes/orange.routes"));
app.use("/api/admin", adminRoutes);

// 404
app.use((req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ success: false, message: "Route API non trouvée" });
    res.status(404).sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// Erreurs globales
app.use((err, req, res, next) => {
    console.error("❌ Erreur serveur:", err);
    res.status(500).json({ success: false, message: "Erreur interne" });
});

// Démarrage
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur OK sur http://localhost:${PORT}`));

module.exports = app;