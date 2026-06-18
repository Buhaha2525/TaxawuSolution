# ✅ MONGODB ATLAS - CHECKLIST D'INSTALLATION
## 📋 Avant de commencer
- [ ] Vérifiez que vous avez une connexion internet
- [ ] Préparez un email pour la création du compte
- [ ] Lisez ce document en entier
---
## 🚀 Étape 1: Créer un compte (2 min)
- [ ] Allez sur https://www.mongodb.com/cloud/atlas
- [ ] Cliquez sur **"Try Free"**
- [ ] Remplissez le formulaire d'inscription
- [ ] Confirmez votre email (vérifiez le spam)
- [ ] Connectez-vous
---
## 🎛️ Étape 2: Créer un cluster (3-10 min)
### Sélection du cloud provider:
- [ ] Provider: Choisissez **AWS** (par défaut)
- [ ] Region: Choisissez la plus proche de vous
  - Europe: Ireland (eu-west-1)
  - Afrique: Autre région proche
  - Amérique: N. Virginia (us-east-1)
### Sélection du tier:
- [ ] Tier: Sélectionnez **M0 Free** ✅
- [ ] Cliquez **"Create"**
- [ ] Attendez 5-10 minutes que le cluster se crée
✔️ Vous verrez "Cluster created successfully" quand c'est terminé
---
## 👤 Étape 3: Créer un utilisateur de base de données (2 min)
Dans le menu de gauche:
- [ ] Cliquez sur **"Database Access"**
Créer un nouvel utilisateur:
- [ ] Cliquez **"Add New Database User"**
- [ ] Authentication Method: **Password** (sélectionné par défaut)
- [ ] Username: `monnayeur_user`
- [ ] Password: Cliquez **"Autogenerate Secure Password"**
- [ ] **COPIER le mot de passe MAINTENANT** (important!)
- [ ] Permissions: **Atlas Admin** (sélectionné par défaut)
- [ ] Cliquez **"Add User"**
✔️ L'utilisateur est créé
---
## 🌐 Étape 4: Configurer l'accès réseau (1 min)
Dans le menu de gauche:
- [ ] Cliquez sur **"Network Access"**
Ajouter une adresse IP:
- [ ] Cliquez **"Add IP Address"**
- [ ] Sélectionnez **"Allow Access from Anywhere"**
- [ ] Confirm IP: `0.0.0.0/0` (apparaît automatiquement)
- [ ] Description: `Development`
- [ ] Cliquez **"Confirm"**
✔️ L'accès réseau est configuré
---
## 🔗 Étape 5: Obtenir la chaîne de connexion (1 min)
Dans le menu de gauche:
- [ ] Allez à **"Clusters"**
- [ ] Cherchez votre cluster et cliquez **"Connect"**
Choisir l'option de connexion:
- [ ] Sélectionnez **"Drivers"**
- [ ] Driver: **Node.js**
- [ ] Version: **5.9 or later** (ou celle proposée)
- [ ] **COPIER la chaîne de connexion complète**
Elle ressemble à:
```
mongodb+srv://monnayeur_user:<PASSWORD>@cluster0.xxxxx.mongodb.net/monnayeur?retryWrites=true&w=majority
```
✔️ Chaîne de connexion copiée
---
## ✏️ Étape 6: Configurer .env (1 min)
Ouvrir `.env` ou créer depuis `.env.example`:
```bash
cd /Users/macbook/Desktop/code_esp_monnayeur
cp .env.example .env
nano .env
```
Remplacer la ligne MONGODB_URI:
**AVANT:**
```
MONGODB_URI=mongodb+srv://monnayeur_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/monnayeur?retryWrites=true&w=majority
```
**APRÈS:**
```
MONGODB_URI=mongodb+srv://monnayeur_user:VOTRE_MOT_DE_PASSE_COPIÉ@cluster0.xxxxx.mongodb.net/monnayeur?retryWrites=true&w=majority
```
**IMPORTANT:** Remplacer:
- [ ] `VOTRE_MOT_DE_PASSE_COPIÉ` → Le mot de passe généré
- [ ] `cluster0.xxxxx` → Votre cluster (copié de la chaîne)
Sauvegarder: `Ctrl+O`, `Entrée`, `Ctrl+X`
✔️ .env configuré
---
## 🧪 Étape 7: Tester la connexion (2 min)
Exécutez le script de test:
```bash
cd /Users/macbook/Desktop/code_esp_monnayeur
node test_mongodb_atlas.js
```
Vous devez voir:
- [ ] ✅ CONNECTÉ À MONGODB ATLAS!
- [ ] 📊 Infos de la connexion
- [ ] Votre Host et Database
- [ ] ✅ TOUS LES TESTS PASSÉS!
Si erreur:
- [ ] Vérifiez le mot de passe
- [ ] Vérifiez Network Access (0.0.0.0/0)
- [ ] Vérifiez votre connexion internet
✔️ Connexion vérifiée
---
## 🎮 Étape 8: Lancer le serveur (1 min)
```bash
node src/server.js
```
Vous devez voir:
- [ ] 🚀 server.js exécuté
- [ ] ✅ MongoDB connecté
- [ ] Serveur OK sur port 3000
✔️ Serveur prêt
---
## 🧪 Étape 9: Tester un paiement (2 min)
**Dans un autre terminal:**
```bash
curl -X POST http://localhost:3000/api/payments/create-payment \
  -H "Content-Type: application/json" \
  -d '{
    "montant": 5000,
    "numero": "+22699999999",
    "successUrl": "https://example.com/success",
    "errorUrl": "https://example.com/error"
  }'
```
Vous devez voir une réponse JSON:
```json
{
  "success": true,
  "message": "Session Wave créée",
  "transaction": {
    "_id": "...",
    "checkoutId": "cos-...",
    "paymentUrl": "https://pay.wave.com/c/..."
  }
}
```
- [ ] Réponse reçue
- [ ] Success: true
- [ ] Transaction créée
✔️ Paiement créé
---
## 📊 Étape 10: Vérifier dans MongoDB Atlas (1 min)
1. Allez à https://cloud.mongodb.com
2. Connectez-vous
3. Cliquez sur votre cluster
4. Cliquez **"Browse Collections"**
5. Cherchez: `monnayeur` → `transactions`
6. Vous devez voir vos transactions!
- [ ] Collections visibles
- [ ] Collection "transactions" présente
- [ ] Vos documents affichés
✔️ Données synchronisées!
---
## ✨ RÉSULTAT FINAL
Si toutes les cases sont cochées:
✅ **MongoDB Atlas est configuré et fonctionnel!**
---
## 🎯 Résumé
| Étape | Durée | États |
|-------|-------|-------|
| 1. Créer compte | 2 min | ✅ |
| 2. Créer cluster | 3-10 min | ✅ |
| 3. Créer utilisateur | 2 min | ✅ |
| 4. Access réseau | 1 min | ✅ |
| 5. Chaîne connexion | 1 min | ✅ |
| 6. Configurer .env | 1 min | ✅ |
| 7. Tester connexion | 2 min | ✅ |
| 8. Lancer serveur | 1 min | ✅ |
| 9. Tester paiement | 2 min | ✅ |
| 10. MongoDB Dashboard | 1 min | ✅ |
| **TOTAL** | **16-23 min** | ✅ |
---
## 🆘 Troubleshooting
### Erreur: "authentication failed"
- [ ] Vérifiez le mot de passe dans .env
- [ ] Vérifiez l'username `monnayeur_user`
- [ ] Les caractères spéciaux sont encodés? (%, &, etc.)
### Erreur: "ip-not-allowed"
- [ ] Vérifiez Network Access
- [ ] Doit être `0.0.0.0/0`
- [ ] Attendre 5 minutes après modification
### Erreur: "connection timeout"
- [ ] Vérifiez votre connexion internet
- [ ] Vérifiez que le cluster est actif (pas en pause)
- [ ] Vérifiez l'URI (pas de typo)
### Erreur: "ENOTFOUND"
- [ ] Vérifiez votre DNS
- [ ] Vérifiez la syntaxe de l'URI
- [ ] Copier-coller l'URI depuis Atlas
---
## 🎓 Prochaines étapes
Une fois MongoDB Atlas configuré:
1. **Créer votre frontend**
   - Voir `WAVE_CLIENT_EXAMPLE.js`
2. **Intégrer Wave API**
   - Voir `WAVE_SETUP.md`
3. **Générer des rapports**
   - MongoDB Atlas peut exporter vos données
4. **Configurer les sauvegardes**
   - MongoDB Atlas le fait automatiquement
5. **Monitoring**
   - Utilisez le dashboard Atlas pour surveiller
---
## 📝 Notes importantes
✅ **Gardez votre mot de passe sûr**
✅ **Ne commitez jamais .env en git**
✅ **Utilisez un utilisateur dédié (pas admin)**
✅ **Activez MFA pour l'account Atlas (optionnel)**
✅ **Limitez l'accès en production**
---
**✅ C'EST PRÊT!**
Vous avez maintenant MongoDB Atlas configuré pour votre système de paiement!
