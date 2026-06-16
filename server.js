/**
 * Verdeko PDF Service v3.1.0
 * API Express + Puppeteer pour génération PDF
 * Optimisé pour Railway
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
    origin: [
        'https://prodnative.fr',
        'https://www.prodnative.fr',
        'https://verdeko.fr',
        'https://www.verdeko.fr',
        /\.railway\.app$/
    ],
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
        version: '3.1.0',
        timestamp: new Date().toISOString()
    });
});

// Page d'accueil
app.get('/', (req, res) => {
    res.json({ 
        service: 'Verdeko PDF Service',
        version: '3.1.0',
        status: 'running',
        platform: 'Railway',
        endpoints: {
            health: 'GET /health',
            generate: 'POST /generate',
            test: 'POST /test'
        },
        usage: {
            method: 'POST',
            url: '/generate',
            body: {
                client: { prenom: 'string', nom: 'string', email: 'string', telephone: 'string' },
                produit: { nom: 'string', prix: 'number', image: 'string' },
                terrain: { forme: 'string', surface_brute: 'number' },
                calepinage: { les: 'array', svg: 'string', orientation: 'string' },
                questionnaire: { type_sol: 'string', animaux: 'string' }
            }
        }
    });
});

// Test endpoint (génère un PDF simple)
app.post('/test', async (req, res) => {
    console.log('🧪 Test PDF demandé');
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ]
        });
        
        const page = await browser.newPage();
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
        `);
        
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="verdeko-test.pdf"');
        res.send(pdfBuffer);
        
        console.log('✅ Test PDF généré avec succès');
    } catch (error) {
        console.error('❌ Erreur test:', error);
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
        
        // Permettre des données minimales pour les tests
        if (!data.client && !data.terrain) {
            return res.status(400).json({ 
                error: 'Données insuffisantes',
                required: ['client ou terrain'],
                received: Object.keys(data)
            });
        }
        
        // Diagnostic : que reçoit-on vraiment ? (à retirer plus tard)
        console.log('[data] quest=' + JSON.stringify(data.questionnaire || {})
            + ' | img=' + ((data.produit || {}).image || '\u2205')
            + ' | cover=' + ((data.produit || {}).image_cover || '\u2205')
            + ' | prod.id=' + ((data.produit || {}).id || '\u2205') + ' nom=' + ((data.produit || {}).nom || '\u2205')
            + ' | les=' + (((data.calepinage || {}).les || []).length)
            + ' | acc=' + Object.keys(data.accessoires || {}).join(','));

        // Charger le template
        const templatePath = path.join(__dirname, 'template.html');
        
        if (!fs.existsSync(templatePath)) {
            console.error('❌ Template non trouvé:', templatePath);
            return res.status(500).json({ error: 'Template HTML non trouvé' });
        }
        
        let html = fs.readFileSync(templatePath, 'utf8');

        // V3 : injection des données — le rendu se fait dans le template (JS)
        const payload = JSON.stringify(data).replace(/</g, '\\u003c');
        html = html.replace('</head>', '<script>window.VERDEKO_PDF_DATA = ' + payload + ';<\/script></head>');
        
        console.log('📝 Template traité, lancement Puppeteer...');
        
        // Lancer Puppeteer avec options optimisées pour container
        browser = await puppeteer.launch({
            headless: 'new',
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
                '--disable-translate'
            ],
            timeout: 30000
        });
        
        const page = await browser.newPage();

        // Capture des erreurs/logs navigateur (diagnostic)
        page.on('pageerror', e => console.error('[browser pageerror]', e.message));
        page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') console.log('[browser ' + t + ']', m.text()); });

        // Définir le viewport pour A4 paysage
        await page.setViewport({
            width: 1122,  // 297mm en pixels à 96dpi
            height: 793,  // 210mm en pixels à 96dpi
            deviceScaleFactor: 2
        });
        
        // Charger le HTML
        await page.setContent(html, { 
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 30000 
        });
        
        // Attendre la fin du rendu du template (V6 pose ce flag)
        await page.waitForFunction('window.__verdekoReady === true', { timeout: 15000 })
            .catch(() => console.warn('\u26A0\uFE0F __verdekoReady non détecté, on continue'));

        // Attendre que les fonts soient chargées
        await page.evaluateHandle('document.fonts.ready');
        
        // Petit délai pour le rendu final
        await new Promise(r => setTimeout(r, 500));
        
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
        console.log(`✅ PDF généré en ${duration}ms pour ${clientName}`);
        
        // Envoyer le PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="verdeko-guide-${sanitizeFilename(clientName)}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('❌ Erreur génération PDF:', error);
        
        // S'assurer de fermer le browser en cas d'erreur
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error('Erreur fermeture browser:', e);
            }
        }
        
        res.status(500).json({ 
            error: error.message,
            type: error.name,
            duration: Date.now() - startTime
        });
    }
});

// (processTemplate retiré en v3 : le rendu est piloté par le template via window.VERDEKO_PDF_DATA)

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
    console.log(`🚀 Verdeko PDF Service v3.1.0 démarré`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Prêt à générer des PDFs!`);
});
