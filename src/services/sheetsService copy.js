"use strict";

const sheets = require("../config/google");

const SPREADSHEET_ID = process.env.SHEET_ID;

if (!SPREADSHEET_ID) {
  console.warn("[sheetsService] SHEET_ID env variable is not set.");
}

/**
 * Append a row to a named sheet tab.
 * @param {string} sheetName   - The tab name (e.g. "ContactUsForm")
 * @param {Array}  values      - Flat array of cell values
 */
async function appendRow(sheetName, values) {
  if (!SPREADSHEET_ID) throw new Error("SHEET_ID is not configured.");

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId:   SPREADSHEET_ID,
      range:           `${sheetName}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    });
  } catch (err) {
    // Surface a clean error so the controller can respond properly
    throw new Error(`Sheets appendRow failed [${sheetName}]: ${err.message}`);
  }
}

/**
 * Read all rows from a named sheet tab.
 * @param {string} sheetName
 * @returns {Array<Array>} rows (empty array if none)
 */
async function getSheetValues(sheetName) {
  if (!SPREADSHEET_ID) throw new Error("SHEET_ID is not configured.");

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range:         `${sheetName}!A:Z`,
    });
    return res.data.values || [];
  } catch (err) {
    throw new Error(`Sheets getValues failed [${sheetName}]: ${err.message}`);
  }
}

module.exports = { appendRow, getSheetValues };