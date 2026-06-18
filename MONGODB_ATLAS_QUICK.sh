#!/bin/bash

# 🌐 MONGODB ATLAS - GUIDE ULTRA-RAPIDE

echo "
════════════════════════════════════════════════════════════════════════════
🌐 MONGODB ATLAS - SETUP 10 MIN
════════════════════════════════════════════════════════════════════════════

📍 C'est quoi MongoDB Atlas?
   = MongoDB en cloud (gratuit, sûr, facile)

════════════════════════════════════════════════════════════════════════════
✅ ÉTAPE 1: Créer un compte
════════════════════════════════════════════════════════════════════════════

1. Allez sur: https://www.mongodb.com/cloud/atlas
2. Cliquez 'Try Free'
3. Créez un compte avec votre email
4. Confirmez votre email

⏱️  Temps: 2 min

════════════════════════════════════════════════════════════════════════════
✅ ÉTAPE 2: Créer un cluster
════════════════════════════════════════════════════════════════════════════

1. Dashboard → 'Create a Deployment'
2. Choisissez:
   - Cloud Provider: AWS / Google Cloud / Azure
   - Region: Proche de vous
   - Tier: M0 Free ✅
3. Cliquez 'Create'
4. Attendez 5-10 min

⏱️  Temps: 3 min

════════════════════════════════════════════════════════════════════════════
✅ ÉTAPE 3: Créer un utilisateur
════════════════════════════════════════════════════════════════════════════

1. Allez à 'Database Access'
2. 'Add New Database User'
3. Username: monnayeur_user
4. Password: [générée auto] → COPIER LE MOT DE PASSE!
5. Permissions: Atlas Admin
6. 'Create User'

⏱️  Temps: 2 min

════════════════════════════════════════════════════════════════════════════
✅ ÉTAPE 4: Configurer l'accès réseau
════════════════════════════════════════════════════════════════════════════

1. Allez à 'Network Access'
2. 'Add IP Address'
3. Sélectionnez '0.0.0.0/0' (accès partout)
4. 'Confirm'

⏱️  Temps: 1 min

════════════════════════════════════════════════════════════════════════════
✅ ÉTAPE 5: Obtenir la connexion
════════════════════════════════════════════════════════════════════════════

1. Allez à 'Clusters'
2. Click 'Connect'
3. Sélectionnez 'Drivers'
4. Node.js + Version 4.1 or higher
5. COPIER la chaîne de connexion

Elle ressemble à:
mongodb+srv://monnayeur_user:PASSWORD@cluster0.xxxxx.mongodb.net/monnayeur?retryWrites=true&w=majority

⏱️  Temps: 1 min

════════════════════════════════════════════════════════════════════════════
✅ ÉTAPE 6: Configurer votre projet
════════════════════════════════════════════════════════════════════════════

1. Éditez .env:
   MONGODB_URI=mongodb+srv://monnayeur_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/monnayeur?retryWrites=true&w=majority

2. Remplacez:
   - YOUR_PASSWORD → votre mot de passe
   - cluster0 → votre cluster
   - xxxxx → votre ID

⏱️  Temps: 1 min

════════════════════════════════════════════════════════════════════════════
✅ ÉTAPE 7: Tester
════════════════════════════════════════════════════════════════════════════

Lancez le serveur:
  node src/server.js

Vous devez voir:
  ✅ MongoDB connecté

Puis testez:
  curl -X POST http://localhost:3000/api/payments/create-payment \\
    -H \"Content-Type: application/json\" \\
    -d '{
      \"montant\": 5000,
      \"numero\": \"+22699999999\",
      \"successUrl\": \"https://example.com/success\",
      \"errorUrl\": \"https://example.com/error\"
    }'

Vous devez voir les données dans MongoDB Atlas Dashboard!

════════════════════════════════════════════════════════════════════════════
✅ C'EST PRÊT!
════════════════════════════════════════════════════════════════════════════

Maintenant:
✅ Vos données sont dans le cloud
✅ Accessible depuis n'importe où
✅ Sauvegarde automatique
✅ Gratuit jusqu'à 500MB

📊 Voir vos données:
   https://cloud.mongodb.com → Your Project → Browse Collections

════════════════════════════════════════════════════════════════════════════
"


