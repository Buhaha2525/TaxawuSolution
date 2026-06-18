# Guide de Migration de Domaine - Orange Money (Sonatel)

Ce document récapitule les étapes nécessaires pour mettre à jour la configuration de votre intégration **Orange Money** à chaque fois que votre nom de domaine backend change (par exemple, lors d'un redémarrage de ngrok qui génère une nouvelle URL, ou lors du déploiement final sur votre domaine de production).

---

## 📋 Résumé rapide de la procédure
1. **Modifier le fichier `.env`** avec le nouveau nom de domaine.
2. **Exécuter le script d'enregistrement** auprès de l'API Orange Money.
3. **Mettre à jour la base de données** pour lier le code marchand et la nouvelle URL à la machine.
4. **Vérifier** que tout fonctionne.

---

## 🛠 Étape 1 : Mettre à jour le fichier `.env`

Ouvrez le fichier `.env` de votre backend et mettez à jour les variables d'URL avec votre nouveau domaine ou votre nouvelle adresse ngrok :

```env
# Remplacer <NOUVEAU_DOMAINE> par votre nouvelle URL (ex: mon-nouveau-ngrok.ngrok-free.dev)
ORANGE_CALLBACK_URL=https://<NOUVEAU_DOMAINE>/api/orange/webhook/merchant-payment
ORANGE_SUCCESS_URL=https://<NOUVEAU_DOMAINE>/success
ORANGE_CANCEL_URL=https://<NOUVEAU_DOMAINE>/cancel
BACKEND_URL=https://<NOUVEAU_DOMAINE>/
```

> [!WARNING]
> N'incluez pas de `/` à la fin de l'URL pour `ORANGE_CALLBACK_URL` et assurez-vous qu'elle se termine bien par `/api/orange/webhook/merchant-payment`.

---

## 🚀 Étape 2 : Enregistrer la nouvelle URL de callback chez Orange Money

Les serveurs d'Orange Money doivent être notifiés de votre nouvelle URL pour qu'ils puissent y rediriger les webhooks (notifications de paiement). 

Dans votre terminal (dossier `Backend`), exécutez le script d'enregistrement en fournissant votre code marchand :

```bash
node scripts/register-callback.js <VOTRE_CODE_MARCHAND>
```

* **Exemple avec ngrok** : si votre code marchand de production est `614841`, le script va lire l'URL configurée dans le `.env` et l'enregistrer directement en production auprès d'Orange Money.

Si l'enregistrement réussit, vous verrez ce message :
```text
2. Sending registration request to Orange Money...
✅ Success! Callback registered successfully.
```

---

## 💾 Étape 3 : Mettre à jour la base de données locale (MongoDB)

Chaque machine stocke son propre code marchand et son URL de callback associés. Vous devez mettre à jour la base de données locale pour que le serveur sache comment mapper le code marchand reçu lors du paiement.

Exécutez le script `set-machine-merchant-code.js` :

```bash
node scripts/set-machine-merchant-code.js <MACHINE_ID> <VOTRE_CODE_MARCHAND> <NOM_MACHINE> <NOUVELLE_URL_CALLBACK>
```

* **Exemple** :
  ```bash
  node scripts/set-machine-merchant-code.js MACHINE_001 614841 "Machine 1" https://mon-nouveau-ngrok.ngrok-free.dev/api/orange/webhook/merchant-payment
  ```

---

## 🧪 Étape 4 : Tester et Valider

### 1. Consulter la configuration active chez Orange Money
Vous pouvez interroger l'API d'Orange Money pour savoir quelle URL est actuellement enregistrée pour votre code marchand en appelant l'endpoint GET de votre serveur :
* **Endpoint** : `GET /api/orange/merchant-callback?code=<VOTRE_CODE_MARCHAND>&machineId=MACHINE_001`
*(Nécessite le token d'autorisation JWT).*

### 2. Effectuer une simulation de paiement locale
Pour vérifier que l'intégration locale fonctionne sans faire de vrai paiement :
1. Ouvrez `scripts/simulate-callback-direct.js`.
2. Changez la valeur de `transactionId` par un identifiant unique temporaire (pour éviter l'erreur de doublon MongoDB).
3. Exécutez :
   ```bash
   node scripts/simulate-callback-direct.js
   ```
