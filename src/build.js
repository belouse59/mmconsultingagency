const fs = require("fs");
const path = require("path");
const { loadTemplate } = require("./utils/templateLoader");
const siteConfig = require("./config/siteConfig");
require("dotenv").config();

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const PAGES_DIR = path.join(__dirname, "templates", "pages");
const LAYOUT_DIR = path.join(__dirname, "templates", "layout");

function buildPage({ mainPage, script, pageFile, outputFile, headVars, footerVars, variables }) {

  // 1. Load layout
  const base = fs.readFileSync(
    path.join(LAYOUT_DIR, "base.html"),
    "utf8"
  );
  
  buildVariable(headVars, variables, outputFile);


  // 2. Load components
  const head = loadTemplate("layout/head.html", headVars);
  const whatsAppWidget = mainPage ? loadTemplate("layout/whatsApp.html") : "";
  const footer = mainPage ? loadTemplate("layout/footer.html", footerVars) : "";
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

function buildVariable(headVars, variables, outputFile) {
  const DYNAMIC_URL = process.env.APP_URL + "/" + outputFile;
  headVars.og_Title = variables.og_Title;
  headVars.twitter_Title = variables.twitter_Title;
  headVars.og_Description = variables.og_Description;
  headVars.twitter_Description = variables.twitter_Description;
  headVars.description = variables.description;
  headVars.keywords = variables.keywords;
  headVars.canonical = DYNAMIC_URL;
  headVars.og_Url = DYNAMIC_URL;
  headVars.twitter_Url = DYNAMIC_URL;
  headVars.robots = variables.robots
  headVars.STRUCTURED_DATA_BUSINESS = variables.STRUCTURED_DATA_BUSINESS || "";
  headVars.STRUCTURED_DATA_FAQ = variables.STRUCTURED_DATA_BUSINESS || "";

}


// BUILDER

//index.html
buildPage({
  mainPage: true,
  script: '<script type="module "src="/js/app.js"></script>',
  pageFile: "index.html",
  outputFile: "index.html",
  headVars: siteConfig.head,
  footerVars: {
    ...siteConfig.footer,
    ...siteConfig.social,
    YEAR: new Date().getFullYear()
  },
  variables: {
    description:"M&M Consulting è il broker energetico di Messina. Confrontiamo oltre 20 fornitori di luce e gas per trovare la tariffa più conveniente per la tua casa o azienda. Analisi gratuita, nessun impegno.",
    twitter_Title: "Broker Energia Messina | M&M Consulting",
    twitter_Description: "Risparmia fino al 30% sulla bolletta luce e gas con il nostro servizio gratuito.",
    og_Title: "Broker Energia Messina | Risparmia su Luce e Gas – M&M Consulting",
    og_Description: "Confrontiamo oltre 20 fornitori di energia a Messina per trovare la tariffa più conveniente per luce e gas. Analisi gratuita e senza impegno.",
    STRUCTURED_DATA_BUSINESS: `  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "M&M Consulting",
      "description": "Broker energetico a Messina. Confrontiamo oltre 20 fornitori di luce e gas per trovare la tariffa migliore.",
      "url": "https://www.mmconsulting.it",
      "telephone": "+390909412150",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Via Industriale, 120",
        "addressLocality": "Messina",
        "addressRegion": "ME",
        "postalCode": "98120",
        "addressCountry": "IT"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 38.1938,
        "longitude": 15.5540
      },
      "openingHoursSpecification": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
        "opens": "09:00",
        "closes": "18:00"
      },
      "areaServed": ["Messina", "Sicilia", "Italia"],
      "serviceType": "Consulenza energetica e confronto fornitori",
      "priceRange": "Gratuito"
    }
  </script>`,
  STRUCTURED_DATA_FAQ:`  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
      {
        "@type": "Question",
        "name": "Il servizio di consulenza energetica è gratuito?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Sì, l'analisi è completamente gratuita e senza impegno. Non paghiamo nulla per confrontare i fornitori."
        }
      },
      {
        "@type": "Question",
        "name": "Quanto posso risparmiare sulla bolletta?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "In media i nostri clienti risparmiano fino al 30% sulla bolletta energetica annuale."
        }
      },
      {
        "@type": "Question",
        "name": "Devo cambiare fornitore subito?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Decidi tu se accettare o meno la proposta. Non c'è nessun obbligo."
        }
      },
      {
        "@type": "Question",
        "name": "Quanto tempo richiede la consulenza?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Bastano pochi minuti per compilare il simulatore o il modulo di contatto. Il nostro team ti ricontatta entro 24 ore."
        }
      }
      ]
    }
  </script>`,
  robots: "index, follow"
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
    title: "Privacy Policy | M&M Consulting Messina",
    EXTRA_CSS: '<link rel="stylesheet" href="./assets/css/legal.css" />'
  },
  footerVars: {
    ...siteConfig.footer,
    ...siteConfig.social,
    YEAR: new Date().getFullYear()
  },
  variables: {
    keywords: "privacy policy, trattamento dati personali, GDPR, informativa privacy, protezione dati, M&M Consulting Messina",
    description:"Consulta la Privacy Policy di M&M Consulting Messina e scopri come raccogliamo, utilizziamo e proteggiamo i tuoi dati personali in conformità al GDPR.",
    twitter_Title: "Privacy Policy | M&M Consulting Messina",
    twitter_Description: "Consulta la Privacy Policy del sito web M&M Consulting Messina.",
    og_Title: "Privacy Policy | M&M Consulting Messina",
    og_Description: "Informativa Privacy di M&M Consulting Messina conforme al GDPR.",
    robots: "noindex, follow"
  }
});


//legal-note-page.html
buildPage({
  mainPage: false,
  script: "",
  pageFile: "legal-note.html",
  outputFile: "legal-note.html",
  headVars: {
    ...siteConfig.head,
    title: "Note Legali | M&M Consulting Messina",
    EXTRA_CSS: '<link rel="stylesheet" href="./assets/css/legal.css" />'
  },
  footerVars: {
    ...siteConfig.footer,
    ...siteConfig.social,
    YEAR: new Date().getFullYear()
  },
  variables: {
    keywords: "note legali, legal notice, condizioni di utilizzo, disclaimer sito web, proprietà sito web, M&M Consulting Messina",
    description:"Consulta le Note Legali di M&M Consulting Messina con informazioni su proprietà del sito, responsabilità e condizioni di utilizzo.",
    twitter_Title: "Note Legali | M&M Consulting Messina",
    twitter_Description: "Consulta le Note Legali del sito web M&M Consulting Messina.",
    og_Title: "Note Legali | M&M Consulting Messina",
    og_Description: "Consulta le Note Legali e le informazioni legali del sito M&M Consulting Messina.",
    robots: "noindex, follow"

  }
});

//cookies-policy-page.html
buildPage({
  mainPage: false,
  script: "",
  pageFile: "cookies-policy.html",
  outputFile: "cookies-policy.html",
  headVars: {
    ...siteConfig.head,
    title: "Cookies Policy | M&M Consulting Messina",
    EXTRA_CSS: '<link rel="stylesheet" href="./assets/css/legal.css" />'
  },
  footerVars: {
    ...siteConfig.footer,
    ...siteConfig.social,
    YEAR: new Date().getFullYear()
  },
  variables: {
    keywords: "cookies policy, informativa cookies, gestione cookies, cookies sito web, privacy e cookies, cookies tecnici analitici profilazione, M&M Consulting Messina",
    description:"Leggi la Cookies Policy di M&M Consulting Messina e scopri come utilizziamo cookies tecnici, analitici e di profilazione sul nostro sito web.",
    twitter_Title: "Cookies Policy | M&M Consulting Messina",
    twitter_Description: "Consulta la Cookie Policy di M&M Consulting Messina.",
    og_Title: "Cookies Policy | M&M Consulting Messina",
    og_Description: "Informativa sull'utilizzo dei cookies tecnici, analitici e di profilazione del sito web M&M Consulting Messina.",
    robots: "noindex, follow"

  }
});