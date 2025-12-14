# Verdeko PDF Service v2.0

Service de génération PDF professionnels pour le configurateur Verdeko.  
Utilise Puppeteer pour convertir un template HTML en PDF A4 paysage haute qualité.

## 🚀 Déploiement sur Railway

### Étape 1 : Préparer le repo GitHub

```bash
# Cloner ou créer le repo
git clone https://github.com/stevanrehault-byte/verdeko-pdf.git
cd verdeko-pdf

# Supprimer les anciens fichiers si existants
rm -rf *

# Copier les nouveaux fichiers (depuis ce package)
# package.json, server.js, template.html, Dockerfile, railway.json, .gitignore

# Commit et push
git add .
git commit -m "v2.0 - Configuration Docker pour Puppeteer"
git push origin main
```

### Étape 2 : Configurer Railway

1. **Aller sur [Railway](https://railway.app)** et se connecter avec GitHub

2. **Créer un nouveau projet** :
   - Cliquer "New Project"
   - Sélectionner "Deploy from GitHub repo"
   - Autoriser Railway à accéder à vos repos si demandé
   - Sélectionner `stevanrehault-byte/verdeko-pdf`

3. **Railway détectera automatiquement le Dockerfile**  
   Le build commencera automatiquement.

4. **Exposer le service** :
   - Aller dans l'onglet "Settings"
   - Section "Networking" → Cliquer "Generate Domain"
   - Vous obtiendrez une URL type : `https://verdeko-pdf-production-xxxx.up.railway.app`

### Étape 3 : Tester le service

```bash
# Test health
curl https://VOTRE-URL.up.railway.app/health

# Réponse attendue :
# {"status":"ok","service":"verdeko-pdf","platform":"railway","version":"2.0.0",...}

# Test génération PDF simple
curl -X POST https://VOTRE-URL.up.railway.app/test -o test.pdf

# Test génération PDF complet
curl -X POST https://VOTRE-URL.up.railway.app/generate \
  -H "Content-Type: application/json" \
  -d '{"client":{"prenom":"Test","nom":"Client","email":"test@test.fr"},"terrain":{"surface_brute":50}}' \
  -o guide.pdf
```

### Étape 4 : Configurer WordPress

Modifier la ligne 13 de `verdeko-pdf-api.php` :

```php
const API_URL = 'https://verdeko-pdf-production-xxxx.up.railway.app';
```

---

## 📁 Structure des fichiers

```
verdeko-pdf/
├── Dockerfile          # Image Puppeteer optimisée
├── railway.json        # Configuration Railway
├── package.json        # Dépendances Node.js
├── server.js           # API Express
├── template.html       # Template PDF 10 pages
└── .gitignore
```

## 🔌 API Endpoints

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/` | GET | Info service |
| `/health` | GET | Health check |
| `/test` | POST | Génère un PDF de test |
| `/generate` | POST | Génère le PDF complet |

### POST /generate

**Body JSON :**
```json
{
  "client": {
    "prenom": "Jean",
    "nom": "Dupont",
    "email": "jean@example.fr",
    "telephone": "0600000000"
  },
  "produit": {
    "nom": "Gazon Premium 42mm",
    "prix": 29.90,
    "prix_original": 39.90,
    "image": "https://..."
  },
  "terrain": {
    "forme": "Rectangle",
    "surface_brute": 75.5,
    "surface_nette": 72.0
  },
  "calepinage": {
    "les": [
      { "ref": "A1", "largeur": 4, "longueur": 12.5, "quantite": 1 },
      { "ref": "A2", "largeur": 4, "longueur": 8.2, "quantite": 1 }
    ],
    "orientation": "horizontal",
    "nb_jonctions": 1,
    "chutes_percent": 15.2,
    "svg": "<svg>...</svg>"
  },
  "questionnaire": {
    "type_sol": "terre",
    "animaux": "oui"
  }
}
```

**Réponse :** PDF binaire (application/pdf)

---

## 🛠️ Variables du Template

### Variables simples
- `{{NOM_COMPLET}}`, `{{PRENOM}}`, `{{NOM}}`
- `{{EMAIL}}`, `{{TELEPHONE}}`
- `{{PRODUIT_NOM}}`, `{{PRODUIT_IMAGE}}`, `{{PRIX}}`
- `{{SURFACE}}`, `{{FORME}}`, `{{TOTAL}}`
- etc.

### Conditions
```html
<!--IF:ANIMAUX-->
  Contenu affiché si animaux = oui
<!--ENDIF:ANIMAUX-->

<!--IF:SOL_MEUBLE-->
  Contenu pour sol meuble (terre, sable)
<!--ENDIF:SOL_MEUBLE-->

<!--IF:SOL_DUR-->
  Contenu pour sol dur (béton, dalle)
<!--ENDIF:SOL_DUR-->
```

---

## 💰 Coûts Railway

- **Hobby plan** : ~5$/mois
- **Pro plan** : Usage-based (~0.000463$/vCPU-minute)
- Estimation : 100 PDFs/jour ≈ 3-5$/mois

---

## 🐛 Troubleshooting

### Build échoue sur Railway
- Vérifier que le Dockerfile utilise l'image `ghcr.io/puppeteer/puppeteer:23.4.1`
- Vérifier les logs Railway pour plus de détails

### PDF vide ou erreur
- Tester d'abord `/test` pour valider Puppeteer
- Vérifier les données JSON envoyées

### Timeout
- Railway a un timeout de 30s par défaut
- Les PDFs complexes peuvent prendre 5-15s

---

## 📝 Changelog

### v2.0.0 (Décembre 2024)
- Migration vers Dockerfile Puppeteer officiel
- Ajout endpoint `/test` pour debug
- Amélioration gestion erreurs
- CORS configuré pour prodnative.fr et verdeko.fr
