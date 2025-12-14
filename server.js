const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'verdeko-pdf', platform: 'railway' });
});

// Page d'accueil
app.get('/', (req, res) => {
    res.json({ 
        service: 'Verdeko PDF Service',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: 'GET /health',
            generate: 'POST /generate'
        }
    });
});

// Génération PDF
app.post('/generate', async (req, res) => {
    console.log('📄 Nouvelle demande de génération PDF');
    const startTime = Date.now();
    
    try {
        const data = req.body;
        
        if (!data || !data.client) {
            return res.status(400).json({ error: 'Données manquantes' });
        }
        
        // Charger le template
        const templatePath = path.join(__dirname, 'template.html');
        let html = fs.readFileSync(templatePath, 'utf8');
        
        // Remplacer les variables
        html = processTemplate(html, data);
        
        // Générer le PDF avec Puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process'
            ]
        });
        
        const page = await browser.newPage();
        
        await page.setContent(html, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });
        
        await browser.close();
        
        const duration = Date.now() - startTime;
        console.log(`✅ PDF généré en ${duration}ms`);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="verdeko-guide-${data.client.nom || 'client'}.pdf"`);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('❌ Erreur génération PDF:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fonction de traitement du template
function processTemplate(html, data) {
    const client = data.client || {};
    const produit = data.produit || {};
    const terrain = data.terrain || {};
    const calep = data.calepinage || {};
    const quest = data.questionnaire || {};
    
    const prenom = client.prenom || '';
    const nom = client.nom || '';
    const nomComplet = (prenom + ' ' + nom).trim() || 'Client';
    const email = client.email || '';
    const telephone = client.telephone || '';
    
    const produitNom = produit.nom || 'Gazon Synthétique';
    const produitImg = produit.image || '';
    const produitPrix = parseFloat(produit.prix || produit.prix_m2 || 0);
    const produitPrixOriginal = parseFloat(produit.prix_original || 0);
    
    const forme = terrain.forme || 'Rectangle';
    const surface = parseFloat(terrain.surface_nette || terrain.surface || 0);
    const surfaceBrute = parseFloat(terrain.surface_brute || surface);
    
    const les = calep.les || [];
    const orientation = calep.orientation || 'horizontal';
    const chutesPct = parseFloat(calep.chutes_percent || 0);
    const nbJonctions = parseInt(calep.nb_jonctions || Math.max(0, les.length - 1));
    const svg = calep.svg || '';
    
    const typeSol = quest.type_sol || 'terre';
    const hasAnimaux = quest.has_animaux || (quest.animaux || '').toLowerCase() === 'oui';
    const isSolMeuble = /terre|sable|meuble/i.test(typeSol);
    
    const hasRemise = produitPrixOriginal > produitPrix && (produitPrixOriginal - produitPrix) > 0.01;
    const remisePct = hasRemise ? Math.round(((produitPrixOriginal - produitPrix) / produitPrixOriginal) * 100) : 0;
    const total = surfaceBrute * produitPrix;
    
    let surfaceCommander = 0;
    les.forEach(le => {
        const l = parseFloat(le.largeur || 4);
        const L = parseFloat(le.longueur || 10);
        const q = parseInt(le.quantite || 1);
        surfaceCommander += l * L * q;
    });
    if (surfaceCommander === 0) surfaceCommander = surfaceBrute;
    
    const solLabel = isSolMeuble ? 'Sol meuble (terre, sable)' : 'Sol dur (béton, dalle)';
    const orientHClass = orientation === 'horizontal' ? 'orient-active' : 'orient-inactive';
    const orientVClass = orientation === 'vertical' ? 'orient-active' : 'orient-inactive';
    
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
    
    let ordrePose = '';
    les.forEach((le, i) => {
        const ref = le.ref || ('L' + (i + 1));
        const l = parseFloat(le.largeur || 4);
        const L = parseFloat(le.longueur || 10);
        if (i > 0) ordrePose += '<span class="ordre-arrow">›</span>';
        ordrePose += `<span class="ordre-item"><span class="le-badge">${i + 1}</span> ${ref} <span class="dim">${l.toFixed(0)}m × ${L.toFixed(1)}m</span></span> `;
    });
    
    const geoM2 = Math.ceil(surfaceBrute * 1.15);
    const nbRouleauxGeo = Math.ceil(geoM2 / 25);
    const geoQty = `${geoM2} m² (${nbRouleauxGeo} rouleaux)`;
    const joncMl = nbJonctions * 8;
    const joncQty = `${joncMl} ml (${nbJonctions} unités)`;
    const clousQty = '1 boîte(s)';
    const nbBouteilles = Math.max(1, Math.ceil(surfaceBrute / 50));
    const nettoyantQty = `${nbBouteilles} bouteille(s)`;
    
    const fmt = (n, d = 2) => n.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    
    const replacements = {
        '{{NOM_COMPLET}}': nomComplet,
        '{{EMAIL}}': email,
        '{{TELEPHONE}}': telephone,
        '{{PRODUIT_NOM}}': produitNom,
        '{{PRODUIT_IMAGE}}': produitImg,
        '{{PRIX}}': fmt(produitPrix),
        '{{PRIX_ORIGINAL}}': fmt(produitPrixOriginal),
        '{{REMISE_PCT}}': remisePct,
        '{{FORME}}': forme,
        '{{SURFACE}}': fmt(surfaceBrute),
        '{{SURFACE_COMMANDER}}': fmt(surfaceCommander),
        '{{TOTAL}}': fmt(total),
        '{{TYPE_SOL}}': typeSol,
        '{{SOL_LABEL}}': solLabel,
        '{{ANIMAUX_OUI_NON}}': hasAnimaux ? 'oui' : 'non',
        '{{NB_JONCTIONS}}': nbJonctions,
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
        '{{ANNEE}}': new Date().getFullYear()
    };
    
    for (const [key, value] of Object.entries(replacements)) {
        html = html.split(key).join(value);
    }
    
    // Conditions
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

app.listen(PORT, () => {
    console.log(`🚀 Verdeko PDF Service démarré sur le port ${PORT}`);
});
