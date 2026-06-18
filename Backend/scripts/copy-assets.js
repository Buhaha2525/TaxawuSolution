const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public", "vendor");

console.log("📦 Copie des assets locaux...\n");

// Dossiers à créer
const dirs = [
    path.join(PUBLIC, "chart.js"),
    path.join(PUBLIC, "fontawesome", "css"),
    path.join(PUBLIC, "fontawesome", "webfonts"),
];

// Créer les dossiers
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log("📁 Créé :", dir.replace(ROOT, ""));
    }
});

// Copier Chart.js
try {
    const chartJsSrc = path.join(ROOT, "node_modules", "chart.js", "dist", "chart.umd.js");
    const chartJsDest = path.join(PUBLIC, "chart.js", "chart.umd.js");

    if (fs.existsSync(chartJsSrc)) {
        fs.copyFileSync(chartJsSrc, chartJsDest);
        console.log("✅ Chart.js copié");
    } else {
        console.log("⚠️  Chart.js non trouvé (normal si pas encore installé)");
    }

    // Copier Chart.js minifié
    const chartJsMinSrc = path.join(ROOT, "node_modules", "chart.js", "dist", "chart.umd.min.js");
    const chartJsMinDest = path.join(PUBLIC, "chart.js", "chart.umd.min.js");
    if (fs.existsSync(chartJsMinSrc)) {
        fs.copyFileSync(chartJsMinSrc, chartJsMinDest);
        console.log("✅ Chart.js minifié copié");
    }
} catch (err) {
    console.log("⚠️  Erreur Chart.js:", err.message);
}

// Copier Font Awesome
try {
    const faCssSrc = path.join(ROOT, "node_modules", "@fortawesome", "fontawesome-free", "css", "all.min.css");
    const faCssDest = path.join(PUBLIC, "fontawesome", "css", "all.min.css");

    if (fs.existsSync(faCssSrc)) {
        fs.copyFileSync(faCssSrc, faCssDest);
        console.log("✅ Font Awesome CSS copié");
    } else {
        console.log("⚠️  Font Awesome CSS non trouvé (normal si pas encore installé)");
    }

    // Copier les webfonts
    const faFontsSrc = path.join(ROOT, "node_modules", "@fortawesome", "fontawesome-free", "webfonts");
    const faFontsDest = path.join(PUBLIC, "fontawesome", "webfonts");

    if (fs.existsSync(faFontsSrc)) {
        const files = fs.readdirSync(faFontsSrc);
        files.forEach(file => {
            const src = path.join(faFontsSrc, file);
            const dest = path.join(faFontsDest, file);
            fs.copyFileSync(src, dest);
        });
        console.log("✅ Font Awesome webfonts copiés (" + files.length + " fichiers)");
    }
} catch (err) {
    console.log("⚠️  Erreur Font Awesome:", err.message);
}

console.log("\n🎉 Script terminé !");