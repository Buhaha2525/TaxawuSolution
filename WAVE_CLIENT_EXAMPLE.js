/**
 * 🌊 EXEMPLE D'INTÉGRATION WAVE - CÔTÉ CLIENT
 *
 * Utilisation: Intégrez ce code dans votre frontend (React, Vue, etc.)
 */

// Configuration
const API_BASE_URL = "http://localhost:3000/api";

/**
 * 1️⃣ CRÉER UN PAIEMENT WAVE
 */
async function createWavePayment(montant, numero) {
    try {
        console.log("💳 Création du paiement Wave...");

        const response = await fetch(`${API_BASE_URL}/payments/create-payment`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                montant: montant,
                numero: numero,
                successUrl: window.location.origin + "/payment/success",
                errorUrl: window.location.origin + "/payment/error"
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        console.log("✅ Session Wave créée:", data.transaction);

        // 🎯 REDIRIGER VERS WAVE
        window.location.href = data.transaction.paymentUrl;

        return data.transaction;

    } catch (error) {
        console.error("❌ Erreur:", error);
        alert("Erreur: " + error.message);
    }
}

/**
 * 2️⃣ VÉRIFIER LE STATUT DU PAIEMENT
 */
async function checkPaymentStatus(checkoutId) {
    try {
        console.log("📊 Vérification du statut...");

        const response = await fetch(`${API_BASE_URL}/payments/status/${checkoutId}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        console.log("Statut:", data.transaction.paymentStatus);

        return data.transaction;

    } catch (error) {
        console.error("❌ Erreur:", error);
    }
}

/**
 * 3️⃣ REMBOURSER UN PAIEMENT
 */
async function refundPayment(transactionId) {
    try {
        console.log("💰 Remboursement du paiement...");

        const response = await fetch(`${API_BASE_URL}/payments/${transactionId}/refund`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        console.log("✅ Remboursement effectué");
        return data.transaction;

    } catch (error) {
        console.error("❌ Erreur:", error);
    }
}

/**
 * 4️⃣ RÉCUPÉRER UNE TRANSACTION
 */
async function getTransaction(transactionId) {
    try {
        const response = await fetch(`${API_BASE_URL}/payments/${transactionId}`);
        const data = await response.json();

        return data.transaction;

    } catch (error) {
        console.error("❌ Erreur:", error);
    }
}

/**
 * 5️⃣ RÉCUPÉRER TOUTES LES TRANSACTIONS
 */
async function getAllTransactions() {
    try {
        const response = await fetch(`${API_BASE_URL}/payments/`);
        const data = await response.json();

        return data.transactions;

    } catch (error) {
        console.error("❌ Erreur:", error);
    }
}

// ===================================
// EXEMPLES D'UTILISATION
// ===================================

// Exemple 1: Initier un paiement
/*
document.getElementById('pay-btn').addEventListener('click', async () => {
    await createWavePayment(
        5000,  // montant en XOF
        '+22699999999'  // numéro de téléphone
    );
});
*/

// Exemple 2: Vérifier le statut après redirection
/*
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutId = urlParams.get('checkout_id');

    if (checkoutId) {
        checkPaymentStatus(checkoutId).then(transaction => {
            if (transaction.paymentStatus === 'succeeded') {
                alert('Paiement effectué! ✅');
            }
        });
    }
});
*/

// Exemple 3: Formulaire complet
/*
<form id="payment-form">
    <input type="number" id="montant" placeholder="Montant (XOF)" required>
    <input type="tel" id="numero" placeholder="+22699999999" required>
    <button type="submit">Payer avec Wave</button>
</form>

<script>
document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const montant = document.getElementById('montant').value;
    const numero = document.getElementById('numero').value;

    await createWavePayment(montant, numero);
});
</script>
*/

// Exporter pour utilisations dans modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createWavePayment,
        checkPaymentStatus,
        refundPayment,
        getTransaction,
        getAllTransactions
    };
}

