/**
 * Verdeko PDF Service v2.1
 * API Express + Puppeteer pour génération PDF
 * Optimisé pour Railway (mémoire limitée)
 */

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'verdeko-pdf', 
        platform: 'railway',
        version: '2.1.0',
        timestamp: new Date().toISOString()
    });
});

// Page d'accueil
app.get('/', (req, res) => {
    res.json({ 
        service: 'Verdeko PDF Service',
        version: '2.1.0',
        status: 'running',
        platform: 'Railway',
        endpoints: {
            health: 'GET /health',
            generate: 'POST /generate',
            test: 'POST /test'
        }
    });
});

// Configuration Puppeteer optimisée pour containers
const PUPPETEER_OPTIONS = {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-infobars',
        '--window-size=1200,800',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-web-security',
        '--font-render-hinting=none'
    ],
    timeout: 60000
};

// Test endpoint (génère un PDF simple)
app.post('/test', async (req, res) => {
    console.log('🧪 Test PDF demandé');
    let browser = null;
    
    try {
        console.log('📦 Lancement Chromium...');
        browser = await puppeteer.launch(PUPPETEER_OPTIONS);
        console.log('✅ Chromium lancé');
        
        const page = await browser.newPage();
        console.log('📄 Page créée');
        
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head><title>Test Verdeko</title></head>
            <body style="font-family:Arial;text-align:center;padding:50px;">
                <h1 style="color:#4f934f;">✅ Verdeko PDF Service</h1>
                <p>Le service fonctionne correctement!</p>
                <p>Date: ${new Date().toLocaleString('fr-FR')}</p>
            </body>
            </html>
        `, { waitUntil: 'domcontentloaded' });
        console.log('📝 Contenu chargé');
        
        const pdfBuffer = await page.pdf({ 
            format: 'A4', 
            printBackground: true,
            margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
        });
        console.log('📄 PDF généré, taille:', pdfBuffer.length);
        
        await browser.close();
        browser = null;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="verdeko-test.pdf"');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
        
        console.log('✅ Test PDF envoyé avec succès');
    } catch (error) {
        console.error('❌ Erreur test:', error.message);
        console.error('Stack:', error.stack);
        
        if (browser) {
            try { await browser.close(); } catch (e) { }
        }
        
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

// Génération PDF principale
app.post('/generate', async (req, res) => {
    console.log('📄 Nouvelle demande de génération PDF');
    const startTime = Date.now();
    
    let browser = null;
    
    try {
        const data = req.body;
        
        // Validation
        if (!data) {
            return res.status(400).json({ error: 'Données manquantes', received: typeof data });
        }
        
        if (!data.client && !data.terrain) {
            return res.status(400).json({ 
                error: 'Données insuffisantes',
                required: ['client ou terrain'],
                received: Object.keys(data)
            });
        }
        
        // Charger le template
        const templatePath = path.join(__dirname, 'template.html');
        
        if (!fs.existsSync(templatePath)) {
            console.error('❌ Template non trouvé:', templatePath);
            return res.status(500).json({ error: 'Template HTML non trouvé' });
        }
        
        let html = fs.readFileSync(templatePath, 'utf8');
        
        // Traiter le template avec les données
        html = processTemplate(html, data);
        
        console.log('📝 Template traité, lancement Puppeteer...');
        
        // Lancer Puppeteer
        browser = await puppeteer.launch(PUPPETEER_OPTIONS);
        
        const page = await browser.newPage();
        
        // Définir le viewport pour A4 paysage
        await page.setViewport({
            width: 1122,
            height: 793,
            deviceScaleFactor: 1
        });
        
        // Charger le HTML
        await page.setContent(html, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        // Générer le PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            preferCSSPageSize: false
        });
        
        await browser.close();
        browser = null;
        
        const duration = Date.now() - startTime;
        const clientName = data.client?.nom || data.client?.prenom || 'client';
        console.log(`✅ PDF généré en ${duration}ms pour ${clientName} (${pdfBuffer.length} bytes)`);
        
        // Envoyer le PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="verdeko-guide-${sanitizeFilename(clientName)}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('❌ Erreur génération PDF:', error.message);
        
        if (browser) {
            try { await browser.close(); } catch (e) { }
        }
        
        res.status(500).json({ 
            error: error.message,
            type: error.name,
            duration: Date.now() - startTime
        });
    }
});

// Fonction de traitement du template
function processTemplate(html, data) {
    const client = data.client || {};
    const produit = data.produit || {};
    const terrain = data.terrain || {};
    const calep = data.calepinage || {};
    const quest = data.questionnaire || {};
    
    // Client
    const prenom = client.prenom || '';
    const nom = client.nom || '';
    const nomComplet = (prenom + ' ' + nom).trim() || 'Client';
    const email = client.email || '';
    const telephone = client.telephone || client.tel || '';
    
    // Produit
    const produitNom = produit.nom || 'Gazon Synthétique Verdeko';
    const produitImg = produit.image || '';
    const produitPrix = parseFloat(produit.prix || produit.prix_m2 || 0);
    const produitPrixOriginal = parseFloat(produit.prix_original || produit.prix_barre || 0);
    
    // Terrain
    const forme = terrain.forme || 'Rectangle';
    const surface = parseFloat(terrain.surface_nette || terrain.surface || 0);
    const surfaceBrute = parseFloat(terrain.surface_brute || surface);
    
    // Calepinage
    const les = calep.les || calep.rouleaux || [];
    const orientation = calep.orientation || 'horizontal';
    const chutesPct = parseFloat(calep.chutes_percent || calep.perte_percent || 0);
    const nbJonctions = parseInt(calep.nb_jonctions || calep.jonctions || Math.max(0, les.length - 1));
    const svg = calep.svg || '';
    
    // Questionnaire
    const typeSol = quest.type_sol || quest.sol || 'terre';
    const hasAnimaux = quest.has_animaux || 
                       (quest.animaux || '').toLowerCase() === 'oui' || 
                       quest.animaux === true;
    const isSolMeuble = /terre|sable|meuble|gazon|pelouse/i.test(typeSol);
    
    // Calculs
    const hasRemise = produitPrixOriginal > produitPrix && (produitPrixOriginal - produitPrix) > 0.01;
    const remisePct = hasRemise ? Math.round(((produitPrixOriginal - produitPrix) / produitPrixOriginal) * 100) : 0;
    const total = surfaceBrute * produitPrix;
    
    // Surface à commander depuis les lés
    let surfaceCommander = 0;
    les.forEach(le => {
        const l = parseFloat(le.largeur || 4);
        const L = parseFloat(le.longueur || 10);
        const q = parseInt(le.quantite || 1);
        surfaceCommander += l * L * q;
    });
    if (surfaceCommander === 0) surfaceCommander = surfaceBrute;
    
    // Labels
    const solLabel = isSolMeuble ? 'Sol meuble (terre, sable)' : 'Sol dur (béton, dalle)';
    const orientHClass = orientation === 'horizontal' ? 'orient-active' : 'orient-inactive';
    const orientVClass = orientation === 'vertical' ? 'orient-active' : 'orient-inactive';
    
    // Générer le tableau des rouleaux
    let rouleauxRows = '';
    let totalM2 = 0;
    les.forEach((le, i) => {
        const l = parseFloat(le.largeur || 4);
        const L = parseFloat(le.longueur || 10);
        const q = parseInt(le.quantite || 1);
        const ref = le.ref || ('L' + (i + 1));
        const s = l * L * q;
        totalM2 += s;
        rouleauxRows += `<tr>
            <td><span class="le-badge">${ref}</span></td>
            <td>${q}x ${l.toFixed(0)}m × ${L.toFixed(2)}m</td>
            <td style="text-align:right;">${s.toFixed(0)} m²</td>
        </tr>`;
    });
    
    // Ordre de pose
    let ordrePose = '';
    les.forEach((le, i) => {
        const ref = le.ref || ('L' + (i + 1));
        const l = parseFloat(le.largeur || 4);
        const L = parseFloat(le.longueur || 10);
        if (i > 0) ordrePose += '<span class="ordre-arrow">›</span>';
        ordrePose += `<span class="ordre-item"><span class="le-badge">${i + 1}</span> ${ref} <span class="dim">${l.toFixed(0)}m × ${L.toFixed(1)}m</span></span> `;
    });
    
    // Quantités accessoires
    const geoM2 = Math.ceil(surfaceBrute * 1.15);
    const nbRouleauxGeo = Math.ceil(geoM2 / 25);
    const geoQty = `${geoM2} m² (${nbRouleauxGeo} rouleaux)`;
    const joncMl = nbJonctions * 8;
    const joncQty = `${joncMl} ml (${nbJonctions} unités)`;
    const clousQty = '1 boîte(s)';
    const nbBouteilles = Math.max(1, Math.ceil(surfaceBrute / 50));
    const nettoyantQty = `${nbBouteilles} bouteille(s)`;
    
    // Formatter les nombres
    const fmt = (n, d = 2) => n.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    
    // Table de remplacement
    const replacements = {
        '{{NOM_COMPLET}}': nomComplet,
        '{{PRENOM}}': prenom,
        '{{NOM}}': nom,
        '{{EMAIL}}': email,
        '{{TELEPHONE}}': telephone,
        '{{PRODUIT_NOM}}': produitNom,
        '{{PRODUIT_IMAGE}}': produitImg,
        '{{PRIX}}': fmt(produitPrix),
        '{{PRIX_ORIGINAL}}': fmt(produitPrixOriginal),
        '{{REMISE_PCT}}': remisePct.toString(),
        '{{FORME}}': forme,
        '{{SURFACE}}': fmt(surfaceBrute),
        '{{SURFACE_NETTE}}': fmt(surface),
        '{{SURFACE_COMMANDER}}': fmt(surfaceCommander),
        '{{TOTAL}}': fmt(total),
        '{{TYPE_SOL}}': typeSol,
        '{{SOL_LABEL}}': solLabel,
        '{{ANIMAUX_OUI_NON}}': hasAnimaux ? 'oui' : 'non',
        '{{NB_JONCTIONS}}': nbJonctions.toString(),
        '{{CHUTES_PCT}}': fmt(chutesPct, 1),
        '{{ORIENT_H_CLASS}}': orientHClass,
        '{{ORIENT_V_CLASS}}': orientVClass,
        '{{SVG_CALEPINAGE}}': svg,
        '{{ROULEAUX_ROWS}}': rouleauxRows,
        '{{ORDRE_POSE}}': ordrePose,
        '{{TOTAL_M2}}': fmt(totalM2),
        '{{GEO_QTY}}': geoQty,
        '{{JONC_QTY}}': joncQty,
        '{{CLOUS_QTY}}': clousQty,
        '{{NETTOYANT_QTY}}': nettoyantQty,
        '{{DATE}}': new Date().toLocaleDateString('fr-FR'),
        '{{ANNEE}}': new Date().getFullYear().toString()
    };
    
    // Appliquer les remplacements
    for (const [key, value] of Object.entries(replacements)) {
        html = html.split(key).join(value);
    }
    
    // Traiter les conditions
    const conditions = [
        { name: 'EMAIL', show: !!email },
        { name: 'TELEPHONE', show: !!telephone },
        { name: 'ANIMAUX', show: hasAnimaux },
        { name: 'SOL_MEUBLE', show: isSolMeuble },
        { name: 'SOL_DUR', show: !isSolMeuble },
        { name: 'HAS_REMISE', show: hasRemise },
        { name: 'PRODUIT_IMAGE', show: !!produitImg },
        { name: 'NO_PRODUIT_IMAGE', show: !produitImg },
        { name: 'JONCTIONS', show: nbJonctions > 0 },
        { name: 'SVG', show: !!svg }
    ];
    
    conditions.forEach(({ name, show }) => {
        const regex = new RegExp(`<!--IF:${name}-->([\\s\\S]*?)<!--ENDIF:${name}-->`, 'g');
        if (show) {
            html = html.replace(regex, '$1');
        } else {
            html = html.replace(regex, '');
        }
    });
    
    return html;
}

// Sanitize filename
function sanitizeFilename(str) {
    return str
        .toLowerCase()
        .replace(/[àâä]/g, 'a')
        .replace(/[éèêë]/g, 'e')
        .replace(/[îï]/g, 'i')
        .replace(/[ôö]/g, 'o')
        .replace(/[ùûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
}

// Démarrer le serveur
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Verdeko PDF Service v2.1 démarré`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Prêt à générer des PDFs!`);
});
