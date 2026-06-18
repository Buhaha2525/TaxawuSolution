#!/usr/bin/env node
require("dotenv").config({ path: ".env" });
const orangeService = require("../src/services/orange.service");

async function run() {
    const code = process.argv[2] || process.env.ORANGE_MERCHANT_CODE;
    const callbackUrl = process.argv[3] || process.env.ORANGE_CALLBACK_URL;
    const name = process.argv[4] || process.env.ORANGE_MERCHANT_NAME || "Machine";
    const apiKey = process.env.ORANGE_API_KEY;

    console.log("=== ORANGE MONEY CALLBACK REGISTRATION ===");
    console.log("Base URL:    ", process.env.ORANGE_BASE_URL);
    console.log("Client ID:   ", process.env.ORANGE_CLIENT_ID ? "Configured" : "MISSING");
    console.log("API Key:     ", apiKey ? "Configured" : "MISSING");
    console.log("Merchant Code:", code);
    console.log("Callback URL:", callbackUrl);
    console.log("Merchant Name:", name);
    console.log("==========================================");

    if (!code || !callbackUrl || !apiKey) {
        console.error("❌ Error: Missing merchant code, callback URL, or API key. Make sure they are set in your .env file or passed as arguments.");
        console.log("\nUsage:\n  node scripts/register-callback.js [MERCHANT_CODE] [CALLBACK_URL] [MERCHANT_NAME]");
        process.exit(1);
    }

    try {
        console.log("1. Generating access token...");
        const tokenResult = await orangeService.getAccessToken({ forceRefresh: true });
        
        if (!tokenResult.success) {
            console.error("❌ Failed to generate access token:", tokenResult.message);
            console.error("Raw response:", tokenResult.raw);
            return;
        }

        console.log("✅ Access token generated successfully.");
        console.log("   Token Type:", tokenResult.tokenType);
        console.log("   Scopes:    ", tokenResult.scope || "None listed");
        console.log("   Token:     ", tokenResult.accessToken ? (tokenResult.accessToken.substring(0, 15) + "...") : "None");

        console.log("\n2. Sending registration request to Orange Money...");
        const result = await orangeService.setMerchantCallback({
            apiKey,
            callbackUrl,
            code: String(code).trim(),
            name
        });

        if (result.success) {
            console.log("✅ Success! Callback registered successfully.");
            console.log("Response:", JSON.stringify(result.data, null, 2));
        } else {
            console.error("❌ Failed to register callback.");
            console.error("Status Code:", result.statusCode);
            console.error("Error Message:", result.message);
            console.error("Raw Response:", JSON.stringify(result.raw || result.data, null, 2));
        }
    } catch (error) {
        console.error("❌ An unexpected error occurred:", error.message || error);
    }
}

run();
