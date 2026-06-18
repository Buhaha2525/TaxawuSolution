# 🌊 Intégration Wave CheckOut API
## Configuration Rapide
### 1. Obtenir vos clés
- Allez sur [Wave Business Portal](https://business.wave.com)
- Developer → API Keys → Create API Key
- Copiez votre clé (format: `wave_sn_prod_...`)
### 2. Configurer .env
```bash
WAVE_API_KEY=wave_sn_prod_YOUR_KEY_HERE
WAVE_SIGNING_SECRET=wave_sn_AKS_YOUR_SECRET_HERE  # Optionnel
WAVE_SUCCESS_URL=https://votreapp.com/success
WAVE_ERROR_URL=https://votreapp.com/error
```
### 3. Endpoints Added
#### Créer un paiement
```http
POST /api/payments/create-payment
{
  "montant": 5000,
  "numero": "+22699999999",
  "successUrl": "https://votreapp.com/success",
  "errorUrl": "https://votreapp.com/error"
}
```
#### Vérifier le statut
```http
GET /api/payments/status/:checkoutId
```
#### Rembourser
```http
POST /api/payments/:transactionId/refund
```
## 📊 Modèle Transaction Mis à Jour
- ✅ checkoutId (Wave)
- ✅ waveTransactionId
- ✅ paymentStatus (processing/succeeded/cancelled)
- ✅ provider (WAVE, MOMO, etc.)
- ✅ Gestion des erreurs Wave
## 📁 Fichiers Modifiés
- ✅ `src/models/transaction.model.js` - Ajout champs Wave
- ✅ `src/services/wave.service.js` - API complète
- ✅ `src/controllers/payment.controller.js` - Endpoints
- ✅ `src/routes/payment.routes.js` - Routes
- ✅ `src/config/wave.config.js` - Configuration
## 🚀 Prochaines Étapes
1. Configurer vos clés Wave
2. Tester les endpoints
3. Intégrer sur votre frontend
4. Configurer les webhooks (optionnel)
