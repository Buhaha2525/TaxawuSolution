const crypto = require("crypto");

const DEFAULT_BASE_URL =
    process.env.ORANGE_BASE_URL ||
    process.env.ORANGE_API_BASE_URL ||
    "https://api.sandbox.orange-sonatel.com";

const TOKEN_PATH = "/oauth/v1/token";
const PUBLIC_KEY_PATH = "/api/account/v1/publicKeys";
const MERCHANT_CALLBACK_PATH = "/api/notification/v1/merchantcallback";
const QR_CODE_PATH = "/api/eWallet/v4/qrcode";

let cachedToken = null;

function getConfig() {
    return {
        baseUrl: DEFAULT_BASE_URL.replace(/\/$/, ""),
        clientId: process.env.ORANGE_CLIENT_ID,
        clientSecret: process.env.ORANGE_CLIENT_SECRET,
        apiKey: process.env.ORANGE_API_KEY,
        defaultCallbackUrl:
            process.env.ORANGE_CALLBACK_URL ||
            process.env.ORANGE_WEBHOOK_URL ||
            null,
        defaultSuccessUrl: process.env.ORANGE_SUCCESS_URL || null,
        defaultCancelUrl: process.env.ORANGE_CANCEL_URL || null
    };
}

async function readResponse(response) {
    const rawText = await response.text();

    if (!rawText) {
        return { rawText: "", data: {} };
    }

    try {
        return { rawText, data: JSON.parse(rawText) };
    } catch (error) {
        return { rawText, data: rawText };
    }
}

function buildError(message, statusCode, raw) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.raw = raw;
    return error;
}

function formatToken(tokenData) {
    return {
        success: true,
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type || "bearer",
        expiresIn: Number(tokenData.expires_in || 0),
        scope: tokenData.scope || null,
        raw: tokenData
    };
}

async function getAccessToken({ forceRefresh = false } = {}) {
    const { baseUrl, clientId, clientSecret } = getConfig();

    if (!clientId || !clientSecret) {
        return {
            success: false,
            message:
                "ORANGE_CLIENT_ID ou ORANGE_CLIENT_SECRET manquant dans le fichier .env"
        };
    }

    if (
        !forceRefresh &&
        cachedToken &&
        cachedToken.accessToken &&
        cachedToken.expiresAt > Date.now() + 60000
    ) {
        return {
            success: true,
            accessToken: cachedToken.accessToken,
            tokenType: cachedToken.tokenType,
            expiresIn: Math.max(0, Math.floor((cachedToken.expiresAt - Date.now()) / 1000)),
            scope: cachedToken.scope,
            cached: true,
            raw: cachedToken.raw
        };
    }

    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials"
    });

    const response = await fetch(`${baseUrl}${TOKEN_PATH}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body
    });

    const { data, rawText } = await readResponse(response);

    if (!response.ok) {
        return {
            success: false,
            statusCode: response.status,
            message: "Impossible de générer le token Orange Money",
            raw: data || rawText
        };
    }

    if (!data?.access_token) {
        return {
            success: false,
            statusCode: 500,
            message: "Réponse token Orange Money invalide",
            raw: data
        };
    }

    const expiresIn = Number(data.expires_in || 0);

    cachedToken = {
        accessToken: data.access_token,
        tokenType: data.token_type || "bearer",
        scope: data.scope || null,
        expiresAt: Date.now() + Math.max(0, expiresIn) * 1000,
        raw: data
    };
    return formatToken(data);
}

async function getAuthorizedHeaders(extraHeaders = {}) {
    const tokenResult = await getAccessToken();

    if (!tokenResult.success) {
        return tokenResult;
    }

    return {
        success: true,
        headers: {
            Authorization: `Bearer ${tokenResult.accessToken}`,
            ...extraHeaders
        },
        token: tokenResult
    };
}

async function requestOrange(path, { method = "GET", body, headers = {}, useAuth = true } = {}) {
    const { baseUrl } = getConfig();
    let finalHeaders = { ...headers };

    if (useAuth) {
        const authResult = await getAuthorizedHeaders(finalHeaders);
        if (!authResult.success) {
            return authResult;
        }
        finalHeaders = authResult.headers;
    }

    const init = {
        method,
        headers: finalHeaders
    };

    if (body !== undefined) {
        init.body = typeof body === "string" ? body : JSON.stringify(body);
        if (!finalHeaders["Content-Type"] && !finalHeaders["content-type"]) {
            init.headers["Content-Type"] = "application/json";
        }
    }

    const response = await fetch(`${baseUrl}${path}`, init);
    const { data, rawText } = await readResponse(response);

    return {
        success: response.ok,
        ok: response.ok,
        statusCode: response.status,
        data,
        raw: data || rawText,
        headers: Object.fromEntries(response.headers.entries())
    };
}

async function getPublicKey() {
    return requestOrange(PUBLIC_KEY_PATH, { method: "GET" });
}

async function setMerchantCallback({ apiKey, callbackUrl, code, name }) {
    if (!apiKey && !getConfig().apiKey) {
        return {
            success: false,
            message: "ORANGE_API_KEY manquant dans le fichier .env"
        };
    }

    return requestOrange(MERCHANT_CALLBACK_PATH, {
        method: "POST",
        headers: {
            "X-Api-Key": apiKey || getConfig().apiKey,
            "Content-Type": "application/json"
        },
        body: {
            apiKey: apiKey || getConfig().apiKey,
            callbackUrl,
            code,
            name
        }
    });
}

async function getMerchantCallback({ code, page = 0, size = 20 }) {
    const params = new URLSearchParams();

    if (code) params.set("code", code);
    if (page !== undefined && page !== null) params.set("page", String(page));
    if (size !== undefined && size !== null) params.set("size", String(size));

    const query = params.toString();
    return requestOrange(
        `${MERCHANT_CALLBACK_PATH}${query ? `?${query}` : ""}`,
        { method: "GET" }
    );
}

async function createMerchantQrCode({
    code,
    name,
    amount,
    callbackUrl,
    callbackSuccessUrl,
    callbackCancelUrl,
    validity = 15,
    metadata = {},
    apiKey
}) {
    const { apiKey: configuredApiKey, defaultCallbackUrl, defaultSuccessUrl, defaultCancelUrl } = getConfig();
    const finalCallbackUrl = callbackUrl || defaultCallbackUrl;
    const finalSuccessUrl = callbackSuccessUrl || defaultSuccessUrl;
    const finalCancelUrl = callbackCancelUrl || defaultCancelUrl;
    const finalApiKey = apiKey || configuredApiKey;

    if (!finalApiKey) {
        return {
            success: false,
            message: "ORANGE_API_KEY manquant dans le fichier .env"
        };
    }

    if (!finalCallbackUrl) {
        return {
            success: false,
            message:
                "callbackUrl manquant : définis ORANGE_CALLBACK_URL ou fournis callbackUrl à la requête"
        };
    }

    const amountValue = Number(amount);

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
        return {
            success: false,
            message: "Montant Orange Money invalide"
        };
    }

    const payload = {
        amount: {
            unit: "XOF",
            value: amountValue
        },
        callbackCancelUrl: finalCancelUrl || finalCallbackUrl,
        callbackSuccessUrl: finalSuccessUrl || finalCallbackUrl,
        code: String(code || "").trim(),
        metadata: metadata || {},
        name: name || "Orange Merchant",
        validity: Number.isFinite(Number(validity)) ? Number(validity) : 15
    };

    const response = await requestOrange(QR_CODE_PATH, {
        method: "POST",
        headers: {
            "X-Api-Key": finalApiKey,
            "X-Callback-Url": finalCallbackUrl,
            "Content-Type": "application/json"
        },
        body: payload
    });

    return {
        ...response,
        request: payload
    };
}

function encryptWithPublicKey(publicKey, plainText) {
    if (!publicKey) {
        throw buildError("Clé publique Orange Money manquante", 400);
    }

    if (plainText === undefined || plainText === null) {
        throw buildError("Valeur à chiffrer manquante", 400);
    }

    const encrypted = crypto.publicEncrypt(
        {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_PADDING
        },
        Buffer.from(String(plainText), "utf8")
    );

    return encrypted.toString("base64");
}

module.exports = {
    createMerchantQrCode,
    encryptWithPublicKey,
    getAccessToken,
    getMerchantCallback,
    getPublicKey,
    requestOrange,
    setMerchantCallback
};

