#!/usr/bin/env node

require("dotenv").config();

const orange = require("../src/services/orange.service");

async function main() {
    const mode = (process.argv[2] || "status").toLowerCase();

    if (mode === "token") {
        const result = await orange.getAccessToken();
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.success ? 0 : 1);
    }

    if (mode === "qrcode") {
        const result = await orange.createMerchantQrCode({
            code: process.env.ORANGE_TEST_MERCHANT_CODE || "123456",
            name: process.env.ORANGE_TEST_MERCHANT_NAME || "Test Merchant",
            amount: Number(process.env.ORANGE_TEST_AMOUNT || 100),
            callbackUrl: process.env.ORANGE_CALLBACK_URL || "https://example.com/api/orange/webhook/merchant-payment"
        });
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.success ? 0 : 1);
    }

    console.log(JSON.stringify({
        success: true,
        hasClientId: Boolean(process.env.ORANGE_CLIENT_ID),
        hasClientSecret: Boolean(process.env.ORANGE_CLIENT_SECRET),
        hasApiKey: Boolean(process.env.ORANGE_API_KEY),
        baseUrl: process.env.ORANGE_BASE_URL || process.env.ORANGE_API_BASE_URL || "https://api.sandbox.orange-sonatel.com"
    }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

