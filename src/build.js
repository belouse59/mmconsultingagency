const fs = require("fs");
const path = require("path");
const { loadTemplate } = require("./utils/templateLoader");
const siteConfig = require("./config/siteConfig");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const PAGES_DIR = path.join(__dirname, "templates", "pages");
const LAYOUT_DIR = path.join(__dirname, "templates", "layout");

function buildPage({ pageFile, outputFile, headVars, headerVars, footerVars }) {

  // 1. Load layout
  const base = fs.readFileSync(
    path.join(LAYOUT_DIR, "base.html"),
    "utf8"
  );

  const navItems = siteConfig.header.nav
  .map(item => `<li><a class="nav-link" href="#${item.target}">${item.label}</a></li>`)
  .join("");

const mobileNavItems = siteConfig.header.nav
  .map(item => `<li><a class="mobile-link" href="#${item.target}">${item.label}</a></li>`)
  .join("");

  // 2. Load components
  const head = loadTemplate("layout/head.html", headVars);
  const header = loadTemplate("layout/header.html", headerVars);
  const footer = loadTemplate("layout/footer.html", footerVars);

  // 3. Load page content only
  const content = fs.readFileSync(
    path.join(PAGES_DIR, pageFile),
    "utf8"
  );

  // 4. Inject into base template
  const html = base
    .replace("{{HEAD}}", head)
    .replace("{{HEADER}}", header)
    .replace("{{CONTENT}}", content)
    .replace("{{FOOTER}}", footer);

  // 5. Write file
  fs.writeFileSync(
    path.join(PUBLIC_DIR, outputFile),
    html
  );
}

// BUILD
buildPage({
  pageFile: "index.html",
  outputFile: "index.html",
  headVars: siteConfig.head,
  headerVars: siteConfig.header,
  footerVars: {
    ...siteConfig.footer,
    ...siteConfig.social,
    YEAR: new Date().getFullYear()
  }
});

buildPage({
  pageFile: "privacy-policy.html",
  outputFile: "privacy-page.html",
  headVars: {
    ...siteConfig.head,
    title: "Privacy Policy"
  },
  headerVars: siteConfig.header,
  footerVars: {
    ...siteConfig.footer,
    ...siteConfig.social,
    YEAR: new Date().getFullYear()
  }
});