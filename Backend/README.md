# Backend paiement du distributeur

Ce backend supporte maintenant l'intégration **Orange Money** en plus du flux Wave existant.

## Variables d'environnement Orange Money

```bash
ORANGE_BASE_URL=https://api.sandbox.orange-sonatel.com
ORANGE_CLIENT_ID=...
ORANGE_CLIENT_SECRET=...
ORANGE_API_KEY=...
ORANGE_CALLBACK_URL=https://ton-domaine.com/api/orange/webhook/merchant-payment
ORANGE_SUCCESS_URL=https://ton-domaine.com/success
ORANGE_CANCEL_URL=https://ton-domaine.com/cancel
```

## Correspondance code marchand ↔ machine

Ajoute le code marchand Orange dans la machine via `orangeMerchantCode`.
Le callback Orange est ensuite relié à la machine grâce à ce champ.

## Routes principales

- `GET /api/orange/health` : test rapide
- `GET /api/orange/public-key` : récupérer la clé publique Orange
- `POST /api/orange/merchant-callback` : configurer le callback marchand
- `GET /api/orange/merchant-callback` : lire les callbacks configurés
- `POST /api/orange/qrcode` : générer un QR code Orange Money
- `POST /api/orange/webhook/merchant-payment` : callback Orange Money reçu par le backend

## Flux recommandé

1. Enregistrer `orangeMerchantCode` sur la machine.
2. Configurer le callback marchand Orange avec `/api/orange/merchant-callback`.
3. Générer le QR avec `/api/orange/qrcode`.
4. Orange appelle le webhook `POST /api/orange/webhook/merchant-payment`.
5. Si le paiement est `SUCCESS`, le backend envoie la commande `DISPENSE` à la machine via MQTT.

## Remarque

Le `X-Callback-Url` utilisé par Orange doit pointer vers une URL publique en HTTPS.

## Smoke test local

```bash
node scripts/orange-smoke-test.js
node scripts/orange-smoke-test.js token
node scripts/orange-smoke-test.js qrcode
```
