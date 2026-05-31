const crypto = require("crypto");

function generateToken(email) {
  const timestamp = Date.now();

  const payload = `${email}:${timestamp}`;

  const signature = crypto
    .createHmac("sha256", process.env.TOKEN_SECRET)
    .update(payload)
    .digest("hex");

  return Buffer.from(
    `${payload}:${signature}`
  ).toString("base64url");
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(
      token,
      "base64url"
    ).toString();

    const [email, timestamp, signature] =
      decoded.split(":");

    const payload = `${email}:${timestamp}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.TOKEN_SECRET)
      .update(payload)
      .digest("hex");

    if (signature !== expectedSignature) return null;

    const expired =
      Date.now() - Number(timestamp) >
      24 * 60 * 60 * 1000;

    if (expired) return null;

    return { email };

  } catch {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken
};