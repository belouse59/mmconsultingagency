const fs = require("fs");
const path = require("path");
const { loadTemplate } = require("./utils/templateLoader");
const siteConfig = require("./config/siteConfig");
require("dotenv").config();

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const PAGES_DIR = path.join(__dirname, "templates", "pages");
const LAYOUT_DIR = path.join(__dirname, "templates", "layout");

function buildPage({ mainPage, script, pageFile, outputFile, headVars, footerVars }) {

  // 1. Load layout
  const base = fs.readFileSync(
    path.join(LAYOUT_DIR, "base.html"),
    "utf8"
  );
  const DYNAMIC_URL = process.env.APP_URL +"/"+ outputFile;
  headVars.canonical = DYNAMIC_URL;
  headVars.og_Url = DYNAMIC_URL;


  // 2. Load components
  const head = loadTemplate("layout/head.html", headVars);
  const whatsAppWidget = mainPage ? loadTemplate("layout/whatsApp.html"): "";
  const footer = mainPage ? loadTemplate("layout/footer.html", footerVars): "";
  // 3. Load page content only
  const content = fs.readFileSync(
    path.join(PAGES_DIR, pageFile),
    "utf8"
  );

  // 4. Inject into base template
  const html = base
    .replace("{{HEAD}}", head)
    .replace("{{CONTENT}}", content)
    .replace("{{FOOTER}}", footer)
    .replace("{{WHATS_APP_WIDGET}}", whatsAppWidget)
    .replace("{{SCRIPT}}", script)

  // 5. Write file
  fs.writeFileSync(
    path.join(PUBLIC_DIR, outputFile),
    html
  );
}

// BUILDER

//index.html
buildPage({
  mainPage:true,
  script:'<script src="/js/app.js" defer></script>',
  pageFile: "index.html",
  outputFile: "index.html",
  headVars: siteConfig.head,
  footerVars: {
    ...siteConfig.footer,
    ...siteConfig.social,
    YEAR: new Date().getFullYear()
  }
});

//privacy-page.html
buildPage({
  mainPage: false,
  script: "",
  pageFile: "privacy-policy.html",
  outputFile: "privacy-page.html",
  headVars: {
    ...siteConfig.head,
    title: "Privacy Policy",
    EXTRA_CSS: '<link rel="stylesheet" href="./assets/css/legal.css" />'
  },
  footerVars: {
    ...siteConfig.footer,
    ...siteConfig.social,
    YEAR: new Date().getFullYear()
  }
});


//legal-note-page.html
buildPage({
  mainPage:false,
  script: "",
  pageFile: "legal-note.html",
  outputFile: "legal-note.html",
  headVars: {
    ...siteConfig.head,
    title: "Legal Note",
    EXTRA_CSS: '<link rel="stylesheet" href="./assets/css/legal.css" />'
  },
  footerVars: {
    ...siteConfig.footer,
    ...siteConfig.social,
    YEAR: new Date().getFullYear()
  }
});

//cookies-policy-page.html
buildPage({
  mainPage:false,
  script: "",
  pageFile: "cookies-policy.html",
  outputFile: "cookies-policy.html",
  headVars: {
    ...siteConfig.head,
    title: "Cookies Policy",
    EXTRA_CSS: '<link rel="stylesheet" href="./assets/css/legal.css" />'
  },
  footerVars: {
    ...siteConfig.footer,
    ...siteConfig.social,
    YEAR: new Date().getFullYear()
  }
});