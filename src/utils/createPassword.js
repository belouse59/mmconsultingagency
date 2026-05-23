const { hashPassword } = require("argon2");
const password = process.argv[2];
 
if (!password) {
  console.error("\n❌  Usage: npm run hash-password <password>\n");
  process.exit(1);
}
 
if (password.length < 8) {
  console.error("\n❌  Password must be at least 8 characters.\n");
  process.exit(1);
}
hashPassword(password).then((hash) =>{
  console.log(hash);
  console.log("\n📋  Paste into:");
  console.log("    .env → LOYALTY_ADMIN_PASSWORD_HASH");
  console.log("    Or use when creating a partner via admin API\n");
}).catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});