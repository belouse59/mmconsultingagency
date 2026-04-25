const sheets = require("../config/google");

const SPREADSHEET_ID = process.env.SHEET_ID;

async function appendRow(sheetName, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values],
    },
  });
}

async function getSheetValues(sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  return res.data.values || [];
}
module.exports = {
  appendRow,
  getSheetValues,
};