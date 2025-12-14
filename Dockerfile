# Verdeko PDF Service - Railway
# Dockerfile optimisé pour Puppeteer

FROM ghcr.io/puppeteer/puppeteer:23.4.1

# Variables d'environnement
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Dossier de travail
WORKDIR /app

# Copier les fichiers package
COPY package*.json ./

# Installer les dépendances (en tant que root)
USER root
RUN npm install --omit=dev

# Copier le reste des fichiers
COPY . .

# Permissions
RUN chown -R pptruser:pptruser /app

# Revenir à l'utilisateur puppeteer
USER pptruser

# Port exposé (Railway définit PORT automatiquement)
EXPOSE 3000

# Commande de démarrage
CMD ["node", "server.js"]
