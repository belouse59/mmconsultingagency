/* ═══════════════════════════════════════════════════════════
   SERVER-SIDE PAGE GUARDS
   Registered on explicit GET routes in app.js BEFORE express.static()
═══════════════════════════════════════════════════════════ */

const path = require("path");
 
const PUBLIC = path.join(__dirname, "../../public");
 
function sendPage(res, relativePath) {
  res.sendFile(path.join(PUBLIC, relativePath));
}
