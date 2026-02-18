/**
 * ============================================================
 *  APPS SCRIPT — RSVP Save the Date → Google Sheets
 * ============================================================
 *
 *  COLONNES DU SHEET :
 *  A: First Name         (index 0)
 *  B: Last Name          (index 1)
 *  C: Guests             (index 2)
 *  D: Phone Number       (index 3)
 *  E: Telegram username  (index 4)
 *  F: Comes ?            (index 5)
 *  G: Parking lot        (index 6)
 *  H: Total              (index 7)  ← formule, ne pas toucher
 *  I: Statut RSVP        (index 8)
 *  J: Email              (index 9)
 *  K: Restrictions       (index 10)
 *  L: Message            (index 11)
 *  M: Date de réponse    (index 12)
 *  N: lang               (index 13) ← pas utilisé ici
 *
 *  FONCTIONS :
 *  doGet  → Recherche par téléphone (?p=) ou Telegram (?t=)
 *  doPost → Enregistre une réponse RSVP
 *
 *  MISE À JOUR :
 *  Apps Script → Déployer > Gérer > Crayon > Nouvelle version
 *
 * ============================================================
 */


function normalizePhone(raw) {
  if (!raw) return "";
  var digits = String(raw).replace(/[^0-9]/g, "");
  if (digits.substring(0, 2) === "00") digits = digits.substring(2);
  if (digits.charAt(0) === "0") digits = digits.substring(1);
  return digits;
}


function normalizeName(raw) {
  if (!raw) return "";
  return String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[-'\s]/g, "");
}


/**
 * doGet — Recherche un invité par téléphone ou Telegram username.
 *
 *   ?p=33640158915     → col D
 *   ?t=john_doe        → col E
 */
function doGet(e) {
  var phone = e.parameter.p || "";
  var tgUser = e.parameter.t || "";

  var sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Sheet1");

  var rows = sheet.getDataRange().getDisplayValues();
  var result = { found: false };
  var normalizedSearch = normalizePhone(phone);

  for (var i = 1; i < rows.length; i++) {
    var matched = false;

    if (normalizedSearch) {
      var cellPhone = normalizePhone(rows[i][3]); // D
      if (cellPhone && cellPhone === normalizedSearch) matched = true;
    }

    if (!matched && tgUser) {
      var cellTg = String(rows[i][4] || "").trim().toLowerCase().replace(/^@/, "");
      var searchTg = tgUser.trim().toLowerCase().replace(/^@/, "");
      if (cellTg && cellTg === searchTg) matched = true;
    }

    if (matched) {
      result = {
        found: true,
        firstName: rows[i][0],         // A
        lastName:  rows[i][1],         // B
        email:     rows[i][9] || ""    // J
      };
      break;
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * doPost — Enregistre une réponse RSVP.
 *
 * Cherche par Prénom + Nom (normalisé).
 * Trouvé → met à jour. Pas trouvé → nouvelle ligne.
 *
 * Le champ "comes" détermine :
 *   - F: "Yes" ou "No"
 *   - I: "Confirmed" ou "Declined"
 *   - Si "No" : guests = 0, parking = false
 */
function doPost(e) {
  var sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Sheet1");

  var data = JSON.parse(e.postData.contents);
  var rows = sheet.getDataRange().getValues();
  var found = false;

  var dataFirst = normalizeName(data.firstName);
  var dataLast  = normalizeName(data.lastName);

  var comes  = data.comes === true || data.comes === "true";
  var statut = comes ? "Confirmed" : "Declined";

  for (var i = 1; i < rows.length; i++) {
    var firstName = normalizeName(rows[i][0]);
    var lastName  = normalizeName(rows[i][1]);

    if (firstName === dataFirst && lastName === dataLast) {
      var row = i + 1;

      sheet.getRange(row, 3).setValue(comes ? Number(data.guests) : 0);  // C: Guests
      // D (Phone) et E (Telegram) ne sont pas modifiés
      sheet.getRange(row, 6).setValue(comes ? "Yes" : "No");              // F: Comes?
      sheet.getRange(row, 7).setValue(comes ? data.parking : false);      // G: Parking
      // H (Total) est une formule
      sheet.getRange(row, 9).setValue(statut);                            // I: Statut RSVP
      sheet.getRange(row, 10).setValue(data.email);                       // J: Email
      sheet.getRange(row, 11).setValue("Casher");                         // K: Restrictions
      sheet.getRange(row, 12).setValue(data.message);                     // L: Message
      sheet.getRange(row, 13).setValue(new Date());                       // M: Date de réponse

      found = true;
      break;
    }
  }

  if (!found) {
    sheet.appendRow([
      data.firstName,                        // A
      data.lastName,                         // B
      comes ? Number(data.guests) : 0,       // C
      "",                                    // D: Phone
      "",                                    // E: Telegram
      comes ? "Yes" : "No",                  // F: Comes?
      comes ? data.parking : false,           // G: Parking
      "",                                    // H: Total (formule)
      statut,                                // I: Statut RSVP
      data.email,                            // J: Email
      "Casher",                              // K: Restrictions
      data.message,                          // L: Message
      new Date(),                            // M: Date de réponse
      ""                                     // N: lang
    ]);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ result: "ok", found: found }))
    .setMimeType(ContentService.MimeType.JSON);
}
