"use strict";

const { google } = require("googleapis");
require("dotenv").config();

if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
  throw new Error(
    "Missing GOOGLE_SERVICE_ACCOUNT env variable. " +
    "Add the service account JSON as a single-line string in your .env file."
  );
}

let credentials;
try {
  credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
} catch {
  throw new Error("GOOGLE_SERVICE_ACCOUNT is not valid JSON.");
}

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

module.exports = sheets;