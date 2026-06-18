#!/bin/bash

# 🌊 WAVE API - TESTS CURL
# Assurez-vous que votre serveur tourne sur http://localhost:3000

API_URL="http://localhost:3000/api/payments"

echo "================================"
echo "🌊 TESTS WAVE API"
echo "================================"

# Test 1: Créer un paiement
echo -e "\n1️⃣  CRÉATION D'UN PAIEMENT"
echo "POST $API_URL/create-payment"

PAYMENT_RESPONSE=$(curl -s -X POST "$API_URL/create-payment" \
  -H "Content-Type: application/json" \
  -d '{
    "montant": 5000,
    "numero": "+22699999999",
    "successUrl": "https://example.com/success",
    "errorUrl": "https://example.com/error"
  }')

echo "$PAYMENT_RESPONSE" | jq '.'

# Extraire le checkoutId et transactionId
CHECKOUT_ID=$(echo "$PAYMENT_RESPONSE" | jq -r '.transaction.checkoutId')
TRANSACTION_ID=$(echo "$PAYMENT_RESPONSE" | jq -r '.transaction._id')
PAYMENT_URL=$(echo "$PAYMENT_RESPONSE" | jq -r '.transaction.paymentUrl')

echo -e "\n✅ IDs extraits:"
echo "  - Checkout ID: $CHECKOUT_ID"
echo "  - Transaction ID: $TRANSACTION_ID"
echo "  - Payment URL: $PAYMENT_URL"

# Test 2: Récupérer le statut
echo -e "\n\n2️⃣  VÉRIFICATION DU STATUT"
echo "GET $API_URL/status/$CHECKOUT_ID"

curl -s -X GET "$API_URL/status/$CHECKOUT_ID" | jq '.'

# Test 3: Récupérer une transaction par ID
echo -e "\n\n3️⃣  RÉCUPÉRATION TRANSACTION"
echo "GET $API_URL/$TRANSACTION_ID"

curl -s -X GET "$API_URL/$TRANSACTION_ID" | jq '.'

# Test 4: Récupérer toutes les transactions
echo -e "\n\n4️⃣  TOUTES LES TRANSACTIONS"
echo "GET $API_URL/"

curl -s -X GET "$API_URL/" | jq '.'

# Test 5: Mettre à jour le statut
echo -e "\n\n5️⃣  UPDATE STATUT (Simulation)"
echo "PUT $API_URL/$TRANSACTION_ID/status"

curl -s -X PUT "$API_URL/$TRANSACTION_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "COMPLETED"}' | jq '.'

# Test 6: Rembourser (optionnel)
# echo -e "\n\n6️⃣ REMBOURSEMENT"
# echo "POST $API_URL/$TRANSACTION_ID/refund"
# curl -s -X POST "$API_URL/$TRANSACTION_ID/refund" | jq '.'

echo -e "\n================================"
echo "✅ Tests terminés"
echo "================================"

# Notes de test
echo -e "\n📝 NOTES:"
echo "1. Le paiement reste 'PENDING' jusqu'à ce que Wave le marque comme 'succeeded'"
echo "2. Pour tester le vrai paiement, visitez: $PAYMENT_URL"
echo "3. Après paiement, vous serez redirigé à votre successUrl"
echo "4. Vérifiez le statut avec: GET /api/payments/status/$CHECKOUT_ID"

