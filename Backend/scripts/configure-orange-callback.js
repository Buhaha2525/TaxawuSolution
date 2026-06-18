#!/usr/bin/env node

require("dotenv").config({ path: ".env" });

/**
 * Script pour configurer le Callback Merchant Orange Money
 * Configure où Orange doit envoyer les notifications de paiement
 */

const baseUrl = process.env.ORANGE_BASE_URL || "https://api.sandbox.orange-sonatel.com";
const clientId = process.env.ORANGE_CLIENT_ID;
const clientSecret = process.env.ORANGE_CLIENT_SECRET;
const envApiKey = process.env.ORANGE_API_KEY;

// Les paramètres que vous devez fournir
const merchantCode = process.argv[2] || "614841"; // Code marchand (6 chiffres)
const callbackUrl = process.argv[3] || "https://twisted-outtakes-algorithm.ngrok-free.dev/api/orange/webhook/merchant-payment";
const merchantName = process.argv[4] || "Machine 1";
const providedApiKey = process.argv[5] || null;
const apiKey = providedApiKey || envApiKey;

function isPlaceholder(value) {
    if (!value) return true;
    const normalized = String(value).trim().toLowerCase();
    return (
        normalized === "votre_api_key_orange_ici" ||
        normalized === "your_api_key_here" ||
        normalized.includes("placeholder")
    );
}

console.log("🔧 === Configuration Callback Orange Money ===\n");
console.log("ℹ️  Rappel: ORANGE_CLIENT_SECRET ≠ ORANGE_API_KEY");
console.log("   - client_id + client_secret => obtenir le token OAuth");
console.log("   - apiKey => configurer le callback merchant Orange\n");

if (!clientId || !clientSecret) {
    console.error("❌ Erreur: Variables d'environnement manquantes:");
    if (!clientId) console.error("   - ORANGE_CLIENT_ID");
    if (!clientSecret) console.error("   - ORANGE_CLIENT_SECRET");
    process.exit(1);
}

async function getAccessToken() {
    console.log("1️⃣  Récupération du token d'accès...");

    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials"
    });

    const response = await fetch(`${baseUrl}/oauth/v1/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(`Erreur token: ${data.detail || response.statusText}`);
    }

    console.log("   ✅ Token obtenu");
    return data.access_token;
}

async function readOrangeResponse(response) {
    const rawText = await response.text();

    if (!rawText) {
        return { rawText: "", data: null };
    }

    try {
        return { rawText, data: JSON.parse(rawText) };
    } catch (error) {
        return { rawText, data: rawText };
    }
}

async function setMerchantCallback(token) {
    console.log("\n2️⃣  Configuration du callback...");
    console.log(`   Merchant Code: ${merchantCode}`);
    console.log(`   Callback URL: ${callbackUrl}`);
    console.log(`   Merchant Name: ${merchantName}`);

    if (isPlaceholder(apiKey)) {
        throw new Error(
            "ORANGE_API_KEY manquant ou placeholder. Ajoutez la vraie clé dans .env ou passez-la en 5e argument: node scripts/configure-orange-callback.js <code> <callbackUrl> <nom> <apiKey>"
        );
    }

    const payload = {
        apiKey,
        callbackUrl,
        code: merchantCode,
        name: merchantName
    };

    const response = await fetch(`${baseUrl}/api/notification/v1/merchantcallback`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "X-Api-Key": apiKey,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const { data, rawText } = await readOrangeResponse(response);

    if (!response.ok) {
        throw new Error(
            `Erreur configuration: ${data?.detail || data?.message || rawText || response.statusText}`
        );
    }

    console.log("   ✅ Callback configuré avec succès");
    if (rawText) {
        console.log("   Réponse Orange:", rawText);
    } else {
        console.log("   Réponse Orange: (vide)");
    }
    return data;
}

async function getMerchantCallback(token) {
    console.log("\n3️⃣  Vérification de la configuration...");

    const response = await fetch(`${baseUrl}/api/notification/v1/merchantcallback?code=${merchantCode}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "X-Api-Key": apiKey,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    });

    const { data, rawText } = await readOrangeResponse(response);

    if (!response.ok) {
        throw new Error(
            `Erreur vérification: ${data?.detail || data?.message || rawText || response.statusText}`
        );
    }

    console.log("   ✅ Configuration vérifiée");
    if (rawText) {
        console.log("   Réponse Orange:", rawText);
    }
    return data;
}

async function main() {
    try {
        const token = await getAccessToken();
        const configResult = await setMerchantCallback(token);
        const verifyResult = await getMerchantCallback(token);

        console.log("\n✅ === Configuration réussie ===");
        console.log("\n📋 Détails:");
        console.log(JSON.stringify({
            merchantCode,
            callbackUrl,
            merchantName,
            apiKeySource: providedApiKey ? "argument CLI" : "variable d'environnement",
            configured: true
        }, null, 2));

        console.log("\n🎯 Prochaines étapes:");
        console.log("1. Générez un QR code avec: POST /api/orange/qrcode");
        console.log("2. Scannez et payez via Orange Money");
        console.log("3. Orange enverra le callback à:", callbackUrl);
        console.log("4. Vérifiez les logs du backend pour voir le paiement reçu");

    } catch (error) {
        console.error("\n❌ Erreur:", error.message);
        process.exit(1);
    }
}

main();






