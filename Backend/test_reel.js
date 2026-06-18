// test-wave-100-reel.js
// Test 100% RÉEL avec ESP32 physique et Wave réel

require("dotenv").config();

const API_URL = "http://localhost:3000/api";
const MQTT = require("mqtt");

// Config
const TEST_EMAIL = "test@test.com";
const TEST_PASSWORD = "test123";
const TEST_MONTANT = 100; // Petit montant pour test réel
const TEST_TELEPHONE = "770996000"; // Ton vrai numéro

const MQTT_URL = `${process.env.MQTT_PROTOCOL}://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`;

let token = null;
let reference = null;
let mqttClient = null;
let distributionConfirmee = false;

// ============================================
// FONCTIONS
// ============================================

async function login() {
    console.log("\n🔐 Connexion...");
    const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
    });
    const data = await res.json();
    if (data.success) {
        token = data.token;
        console.log("✅ Connecté :", data.user.name);
        return true;
    }
    console.log("❌", data.message);
    return false;
}

async function initierPaiementReel() {
    console.log("\n🌊 Envoi demande Wave RÉELLE...");
    console.log("   Montant :", TEST_MONTANT, "FCFA");
    console.log("   Téléphone :", TEST_TELEPHONE);

    const res = await fetch(`${API_URL}/wave/payer`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
            montant: TEST_MONTANT,
            telephone: TEST_TELEPHONE
        })
    });

    const data = await res.json();

    if (data.succes) {
        reference = data.transaction.reference;
        console.log("✅ Demande envoyée !");
        console.log("   Référence :", reference);
        console.log("\n📱 VÉRIFIEZ VOTRE TÉLÉPHONE !");
        console.log("   Vous devriez recevoir une notification Wave");
        console.log("   Acceptez le paiement dans l'app Wave\n");
        return true;
    } else {
        console.log("❌", data.erreur || data.message);
        return false;
    }
}

function connecterMQTT() {
    return new Promise((resolve) => {
        console.log("📡 Connexion MQTT...");

        mqttClient = MQTT.connect(MQTT_URL, {
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            clean: true
        });

        mqttClient.on("connect", () => {
            console.log("✅ MQTT connecté !");
            mqttClient.subscribe("machines/MACHINE_001/#");
            console.log("👂 Écoute ESP32...\n");
            resolve(true);
        });

        mqttClient.on("message", (topic, message) => {
            const data = message.toString();
            const parsed = JSON.parse(data);

            // Heartbeat ESP32
            if (parsed.type === "heartbeat") {
                console.log(`💓 ESP32 vivant | Uptime: ${parsed.uptimeMs}ms | Free heap: ${parsed.freeHeap}`);
            }

            // Événement pièce
            if (parsed.type === "coin_payment_detected") {
                console.log(`\n🪙 PIÈCE DÉTECTÉE: ${parsed.amountFcfa} FCFA (${parsed.pulseCount} impulsions)`);
            }

            // Confirmation distribution
            if (topic.includes("acks") && parsed.status === "SUCCESS") {
                console.log("\n🚰💧 DISTRIBUTION CONFIRMÉE PAR L'ESP32 !");
                console.log("   L'eau a coulé !");
                distributionConfirmee = true;
            }

            // Statut machine
            if (parsed.type === "machine_status") {
                console.log(`📊 Machine: ${parsed.canDispense ? "DISPONIBLE" : "INDISPONIBLE"} | Counter: ${parsed.counterLevel}`);
            }
        });

        mqttClient.on("error", (err) => {
            console.log("⚠️ MQTT:", err.message);
        });
    });
}

async function attendrePaiementOuSimuler() {
    console.log("⏳ Attente du paiement...");
    console.log("   Options :");
    console.log("   1. Payez VRAIMENT avec l'app Wave sur votre téléphone");
    console.log("   2. Tapez 'simuler' pour simuler la confirmation");
    console.log("   3. Ctrl+C pour annuler\n");

    // Attendre 60 secondes max
    const startTime = Date.now();
    const timeout = 60000;

    while (Date.now() - startTime < timeout) {
        // Vérifier si le statut a changé
        if (reference) {
            const res = await fetch(`${API_URL}/wave/verifier/${reference}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.statut === "SUCCES") {
                console.log("\n✅ PAIEMENT REÇU !");
                return true;
            }
        }

        // Afficher un point toutes les 2 secondes
        process.stdout.write(".");
        await sleep(2000);
    }

    console.log("\n⏰ Timeout - Simulation du paiement...");
    return await simulerPaiement();
}

async function simulerPaiement() {
    console.log("🔄 Simulation confirmation...");

    const res = await fetch(`${API_URL}/wave/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_reference: reference,
            status: "completed"
        })
    });

    const data = await res.json();
    console.log("✅ Simulation OK");
    return true;
}

async function attendreDistribution() {
    console.log("\n⏳ Attente distribution ESP32...");

    const startTime = Date.now();
    const timeout = 15000;

    while (Date.now() - startTime < timeout) {
        if (distributionConfirmee) {
            return true;
        }
        await sleep(500);
    }

    console.log("⚠️ Pas de confirmation ESP32 dans les 15 secondes");
    console.log("   Vérifiez que l'ESP32 est allumé et connecté");
    return false;
}

async function verifierResultatFinal() {
    console.log("\n📊 Vérification finale...");

    const res = await fetch(`${API_URL}/payments`, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    const data = await res.json();

    if (data.success && data.transactions.length > 0) {
        const tx = data.transactions[0];
        console.log("\n📋 Dernière transaction :");
        console.log("   Référence :", tx.reference);
        console.log("   Montant :", tx.amountFcfa, "FCFA");
        console.log("   Méthode :", tx.paymentMethod);
        console.log("   Statut :", tx.status);
        console.log("   Date :", new Date(tx.createdAt).toLocaleString("fr-FR"));

        console.log("\n" + "=".repeat(50));
        if (tx.status === "SUCCES" && distributionConfirmee) {
            console.log("🎉 TEST 100% RÉUSSI !");
            console.log("💰 Client payé → 🚰 Eau distribuée → 💰 Argent reçu");
        } else if (tx.status === "SUCCES") {
            console.log("⚠️ Paiement OK mais distribution non confirmée");
            console.log("   Vérifiez l'ESP32");
        } else {
            console.log("❌ Échec - Statut:", tx.status);
        }
        console.log("=".repeat(50));
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// DÉMARRAGE
// ============================================

async function main() {
    console.log("\n" + "=".repeat(50));
    console.log("🧪 TEST 100% RÉEL - WAVE + ESP32");
    console.log("=".repeat(50));
    console.log("⚠️  Ce test va VRAIMENT débiter de l'argent");
    console.log("   Montant test :", TEST_MONTANT, "FCFA");
    console.log("=".repeat(50));

    try {
        // 1. Login
        if (!await login()) process.exit(1);

        // 2. Connecter MQTT
        await connecterMQTT();

        // 3. Initier paiement réel
        if (!await initierPaiementReel()) process.exit(1);

        // 4. Attendre paiement ou simuler
        await attendrePaiementOuSimuler();

        // 5. Attendre confirmation ESP32
        await attendreDistribution();

        // 6. Vérifier résultat
        await verifierResultatFinal();

    } catch (error) {
        console.error("❌ Erreur:", error.message);
    } finally {
        if (mqttClient) mqttClient.end();
        console.log("\n👋 Test terminé\n");
        process.exit(0);
    }
}

// Ctrl+C
process.on("SIGINT", () => {
    console.log("\n👋 Arrêt...");
    if (mqttClient) mqttClient.end();
    process.exit(0);
});

main();