const crypto = require("crypto");

function createWaveSignature(rawBody) {
    const signingSecret = process.env.WAVE_REQUEST_SIGNING_SECRET;

    if (!signingSecret) {
        throw new Error("WAVE_REQUEST_SIGNING_SECRET manquant dans le fichier .env");
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payloadToSign = `${timestamp}${rawBody}`;

    const signature = crypto
        .createHmac("sha256", signingSecret)
        .update(payloadToSign)
        .digest("hex");

    return `t=${timestamp},v1=${signature}`;
}

async function payerWave(montant, reference) {
    try {
        if (!process.env.WAVE_API_KEY) {
            return {
                succes: false,
                message: "WAVE_API_KEY manquante dans le fichier .env"
            };
        }

        if (!process.env.WAVE_SUCCESS_URL || !process.env.WAVE_ERROR_URL) {
            return {
                succes: false,
                message: "WAVE_SUCCESS_URL ou WAVE_ERROR_URL manquante dans le fichier .env"
            };
        }

        const payload = {
            amount: String(montant),
            currency: "XOF",
            client_reference: reference,
            success_url: process.env.WAVE_SUCCESS_URL,
            error_url: process.env.WAVE_ERROR_URL
        };

        const rawBody = JSON.stringify(payload);
        const waveSignature = createWaveSignature(rawBody);

        console.log("🔐 Signature Wave générée :", {
            signatureHeaderPresent: Boolean(waveSignature),
            signatureHeaderFormatOk: waveSignature.startsWith("t=") && waveSignature.includes(",v1=")
        });

        const response = await fetch(
            `${process.env.WAVE_BASE_URL || "https://api.wave.com"}/v1/checkout/sessions`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.WAVE_API_KEY}`,
                    "Content-Type": "application/json",
                    "Wave-Signature": waveSignature
                },
                body: rawBody
            }
        );

        const rawText = await response.text();

        let data = {};
        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch (parseError) {
            data = {
                rawText,
                parseError: parseError.message
            };
        }

        console.log("📥 Réponse Wave Checkout :", {
            httpStatus: response.status,
            ok: response.ok,
            id: data.id || null,
            client_reference: data.client_reference || null,
            checkout_status: data.checkout_status || null,
            payment_status: data.payment_status || null,
            wave_launch_url_present: Boolean(data.wave_launch_url),
            error: data.error || data.message || null,
            raw: data
        });

        if (!response.ok) {
            return {
                succes: false,
                message: "Erreur création session Wave Checkout",
                statusCode: response.status,
                raw: data
            };
        }

        return {
            succes: true,
            waveCheckoutSessionId: data.id || null,
            waveLaunchUrl: data.wave_launch_url || null,
            wave_launch_url: data.wave_launch_url || null,
            clientReference: data.client_reference || reference,
            checkoutStatus: data.checkout_status || null,
            paymentStatus: data.payment_status || null,
            raw: data
        };

    } catch (error) {
        console.error("❌ Erreur payerWave :", error);

        return {
            succes: false,
            message: error.message
        };
    }
}

module.exports = {
    payerWave
};