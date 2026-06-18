FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances (npm ci échoue si package-lock.json est incompatible)
RUN npm install

# ================================================
# Stage 2: Production image (minimale)
# ================================================
FROM node:20-alpine

WORKDIR /app

# Créer l'utilisateur non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copier node_modules du builder
COPY --from=builder /app/node_modules ./node_modules

# Copier le code de l'application
COPY --chown=nodejs:nodejs . .

# Installer qrcode spécifiquement (solution de contournement)
RUN npm install qrcode

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000

# Exposer le port
EXPOSE 3000

# Utiliser l'utilisateur non-root
USER nodejs

# Démarrer l'application
CMD ["node", "src/server.js"]
# ============================
