# Verdeko PDF Service - Railway
FROM node:20-slim

# Installer les dépendances Chrome
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Variables Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Dossier de travail
WORKDIR /app

# Copier et installer les dépendances
COPY package*.json ./
RUN npm install --omit=dev

# Copier le reste
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
