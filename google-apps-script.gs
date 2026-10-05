/**
 * Future Insurance — Backend לקליטת לידים מדפי הנחיתה
 * שמירה ב-Google Sheets + מייל התראה מיידי לכל ליד חדש.
 *
 * ─────────────────────────────── התקנה ───────────────────────────────
 * 1. פותחים את ה-Google Sheet של הלידים → Extensions → Apps Script
 *    (אם הסקריפט לא מחובר לגיליון — מדביקים את מזהה הגיליון ב-SPREADSHEET_ID)
 * 2. מוחקים את כל הקוד הקיים, מדביקים את הקובץ הזה ושומרים (Ctrl+S)
 * 3. בוחרים בתפריט העליון את הפונקציה testLead → Run, ומאשרים את ההרשאות
 *    (Sheets + Gmail). אמורה להיווצר לשונית "בדיקות" עם שורה, ולהגיע מייל.
 * 4. Deploy → Manage deployments → בוחרים את ה-deployment הקיים → ✏️ Edit
 *    → Version: "New version" → Deploy.
 *      • Execute as: Me
 *      • Who has access: Anyone   ← חובה! ("Anyone with Google account" חוסם את הטפסים)
 *    כך כתובת ה-‎/exec נשארת זהה, ואין צורך לשנות דבר בדפי הנחיתה.
 *
 * ⚠️ שינוי בקוד נכנס לתוקף רק אחרי "New version" ב-Manage deployments.
 *    שמירה בלבד לא מעדכנת את הכתובת החיה.
 */

const NOTIFY_EMAIL   = 'amir@il-ins.co.il';
const SPREADSHEET_ID = '';            // ריק = הגיליון שהסקריפט מחובר אליו
const ERROR_SHEET    = 'שגיאות';
const DEFAULT_SHEET  = 'לידים';
const VERSION        = '2026-10-05';

// כותרות בעברית לעמודות המוכרות; שדות אחרים יופיעו בשמם המקורי
const LABELS = {
  submittedAtLocal: 'תאריך ושעה', pageSource: 'דף מקור', sheetName: 'גיליון',
  firstName: 'שם פרטי', lastName: 'שם משפחה', fullName: 'שם מלא', phone: 'נייד',
  idNumber: 'ת.ז', birthDate: 'תאריך לידה', age: 'גיל', smoker: 'מעשן',
  loanAmount: 'גובה הלוואה', loanYears: 'תקופה (שנים)', currentMonthlyPayment: 'משלם היום (₪/חודש)',
  additionalInsuredCount: 'מבוטחים נוספים',
  idIssueDate: 'תאריך הנפקת ת.ז', currentInsurer: 'חברת ביטוח נוכחית', insuredCount: 'מבוטחים בפוליסה',
  hasWorkInsurance: 'ביטוח מהעבודה',
  carNumber: 'מספר רכב', calcClaimFreeYears: 'שנים ללא תביעות (מחשבון)', calcAnnualPremium: 'משלם לשנה (מחשבון)',
  calcRenewSoon: 'חידוש בקרוב',
  estimatedMonthlySaving: 'חיסכון משוער לחודש', estimatedYearlySaving: 'חיסכון משוער לשנה',
  estimatedTotalSaving: 'חיסכון משוער כולל',
  consent: 'אישור תנאים', marketingConsent: 'הסכמה לדיוור', consentText: 'נוסח ההסכמה שאושר', consentVersion: 'גרסת תנאים',
  deliveryRetry: 'שליחה חוזרת',
  device: 'מכשיר', utm_source: 'utm_source', utm_medium: 'utm_medium', utm_campaign: 'utm_campaign',
  utm_term: 'מילת מפתח', utm_content: 'utm_content', gclid: 'gclid', gbraid: 'gbraid', wbraid: 'wbraid',
  landingPage: 'כתובת דף', referrer: 'מפנה'
};
// שדות שלא נשמרים כעמודה (כפילויות של שדות אחרים / honeypot)
const SKIP = ['mortgageAmount', 'mortgageYears', 'primarySmoker', 'submittedAt', 'company'];
// מספרים עם 0 מוביל ותאריכים — נשמרים כטקסט כדי שלא יאבדו או יומרו
const TEXT_COLS = ['phone', 'idNumber', 'carNumber', 'gclid', 'idIssueDate', 'birthDate'];

/* ═══════════════════════════════ doPost ═══════════════════════════════ */
function doPost(e) {
  let data = null;
  const lock = LockService.getScriptLock();
  try {
    data = parseBody_(e);
    if (data.company) return json_({ ok: true, skipped: 'honeypot' }); // בוט מילא שדה מוסתר
    if (!data.fullName && !data.phone) throw new Error('ליד ללא שם וטלפון — נדחה');

    // 1) שמירה בגיליון (נעילה מונעת דריסה כשמגיעים כמה לידים בו-זמנית)
    lock.waitLock(20000);
    let saved;
    try { saved = saveLead_(data); } finally { lock.releaseLock(); }

    // 2) מייל התראה — אחרי שהליד כבר נשמר; כישלון במייל נרשם, אבל לא מאבד את הליד
    try {
      sendNotification_(data, saved);
    } catch (mailErr) {
      logError_('GmailApp.sendEmail', mailErr, data);
    }

    return json_({ ok: true, sheet: saved.sheetName, row: saved.row });
  } catch (error) {
    logError_('doPost', error, data || (e && e.postData && e.postData.contents));
    return json_({ ok: false, error: String((error && error.message) || error) });
  }
}

/* בדיקת חיים — פתיחת כתובת ה-‎/exec בדפדפן מציגה את הסטטוס והגרסה */
function doGet() {
  return json_({ ok: true, service: 'Future Insurance leads', version: VERSION });
}

/* ═══════════════════════════════ פענוח הבקשה ═══════════════════════════════ */
function parseBody_(e) {
  if (!e) throw new Error('לא התקבל אירוע — להרצה ידנית השתמשו ב-testLead');
  // הדפים שולחים JSON בגוף הבקשה (text/plain) → מגיע ב-e.postData.contents
  if (e.postData && e.postData.contents) {
    const raw = e.postData.contents;
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('התוכן אינו אובייקט JSON');
      return obj;
    } catch (err) {
      // גיבוי: שליחה כטופס רגיל (application/x-www-form-urlencoded)
      if (e.parameter && Object.keys(e.parameter).length) return Object.assign({}, e.parameter);
      throw new Error('JSON לא תקין: ' + err.message + ' | התחלה: ' + String(raw).slice(0, 120));
    }
  }
  if (e.parameter && Object.keys(e.parameter).length) return Object.assign({}, e.parameter);
  throw new Error('גוף הבקשה ריק');
}

/* ═══════════════════════════════ שמירה בגיליון ═══════════════════════════════ */
function getSpreadsheet_() {
  const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('הסקריפט לא מחובר לגיליון — יש למלא SPREADSHEET_ID');
  return ss;
}

// שמות לשוניות: עד 100 תווים, בלי התווים \ / ? * [ ] :
function cleanSheetName_(name) {
  const s = String(name || '').replace(/[\\\/\?\*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  return s || DEFAULT_SHEET;
}

function saveLead_(data) {
  const ss = getSpreadsheet_();
  const sheetName = cleanSheetName_(data.sheetName || data.pageSource);
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  if (!data.submittedAtLocal) {
    data.submittedAtLocal = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'dd/MM/yyyy HH:mm:ss');
  }

  // המפתח המקורי של כל עמודה נשמר כהערה על הכותרת → שדות חדשים נוספים כעמודות אוטומטית
  let keys = sheet.getLastRow() > 0 && sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getNotes()[0].map(String)
    : [];
  if (!keys.length || !keys[0]) keys = ['status', 'submittedAtLocal', 'fullName', 'phone', 'sheetName'];
  Object.keys(data).forEach(k => { if (SKIP.indexOf(k) === -1 && keys.indexOf(k) === -1) keys.push(k); });

  const header = sheet.getRange(1, 1, 1, keys.length);
  header.setValues([keys.map(k => k === 'status' ? 'סטטוס' : (LABELS[k] || k))]);
  header.setNotes([keys]);
  header.setFontWeight('bold').setBackground('#0b1d45').setFontColor('#f3d9a4');
  sheet.setFrozenRows(1);
  if (!sheet.isRightToLeft()) sheet.setRightToLeft(true);

  const row = keys.map(k => {
    if (k === 'status') return 'חדש';
    if (k === 'sheetName') return sheetName;
    const v = data[k];
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return (TEXT_COLS.indexOf(k) !== -1 || /_id$/.test(k)) ? "'" + v : v;
  });
  sheet.appendRow(row);
  const rowNum = sheet.getLastRow();
  return { sheetName: sheetName, row: rowNum, url: ss.getUrl() + '#gid=' + sheet.getSheetId() + '&range=A' + rowNum };
}

/* ═══════════════════════════════ מייל התראה ═══════════════════════════════ */
function sendNotification_(d, saved) {
  const phone = String(d.phone || '');
  const intl = phone.replace(/\D/g, '').replace(/^0/, '972');
  const subject = '🔔 ליד חדש · ' + saved.sheetName + ' · ' + (d.fullName || '') + ' · ' + phone;

  // ת.ז מוצגת חלקית במייל (מלאה בגיליון) — מידע רגיש לא נשלח במלואו בדוא"ל
  const masked = d.idNumber ? '•••••' + String(d.idNumber).slice(-4) : '';
  const rows = [
    ['שם', d.fullName], ['נייד', phone], ['דף', d.pageSource || saved.sheetName],
    ['ת.ז', masked], ['תאריך לידה', d.birthDate], ['מספר רכב', d.carNumber],
    ['גובה הלוואה', d.loanAmount], ['תקופה (שנים)', d.loanYears],
    ['חברת ביטוח', d.currentInsurer], ['משלם היום', d.currentMonthlyPayment],
    ['מבוטחים', d.insuredCount || d.additionalInsuredCount], ['ביטוח מהעבודה', d.hasWorkInsurance],
    ['מעשן', d.smoker], ['חיסכון משוער', d.estimatedTotalSaving || d.estimatedYearlySaving],
    ['הסכמה לדיוור', d.marketingConsent],
    ['מקור', [d.utm_source, d.utm_campaign].filter(Boolean).join(' / ')],
    ['Google Ads (gclid)', d.gclid ? 'כן' : ''], ['שליחה חוזרת', d.deliveryRetry],
    ['מכשיר', d.device], ['זמן', d.submittedAtLocal]
  ].filter(r => r[1] !== undefined && r[1] !== null && String(r[1]) !== '');

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const htmlBody =
    '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;color:#0e1a36">' +
    '<h2 style="margin:0 0 6px;color:#1d4ed8">ליד חדש · ' + esc(saved.sheetName) + '</h2>' +
    '<p style="margin:0 0 14px;color:#5e6b87">התקבל מדף הנחיתה ונשמר בשורה ' + saved.row + '</p>' +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' +
    rows.map(r => '<tr><td style="padding:7px 10px;background:#f1f4fa;font-weight:bold;width:150px;border-bottom:1px solid #e3e8f1">' +
      esc(r[0]) + '</td><td style="padding:7px 10px;border-bottom:1px solid #e3e8f1">' + esc(r[1]) + '</td></tr>').join('') +
    '</table><p style="margin:18px 0 0">' +
    '<a href="tel:' + esc(phone) + '" style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">📞 חיוג</a> ' +
    '<a href="https://wa.me/' + intl + '" style="background:#25d366;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">וואטסאפ</a> ' +
    '<a href="' + saved.url + '" style="color:#1d4ed8;margin-right:8px">פתיחה בגיליון</a></p></div>';

  const textBody = rows.map(r => r[0] + ': ' + r[1]).join('\n') + '\n\nגיליון: ' + saved.url;

  GmailApp.sendEmail(NOTIFY_EMAIL, subject, textBody, { htmlBody: htmlBody, name: 'Future Insurance · לידים' });
}

/* ═══════════════════════════════ לוג שגיאות ═══════════════════════════════ */
// כל שגיאה נרשמת גם ב-Executions (console) וגם בלשונית "שגיאות" בגיליון
function logError_(where, error, payload) {
  const msg = String((error && error.stack) || error);
  console.error('[' + where + '] ' + msg);
  try {
    const sh = getSpreadsheet_().getSheetByName(ERROR_SHEET) || getSpreadsheet_().insertSheet(ERROR_SHEET);
    if (sh.getLastRow() === 0) sh.appendRow(['זמן', 'מיקום', 'שגיאה', 'נתונים שהתקבלו']);
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    sh.appendRow([new Date(), where, msg.slice(0, 1000), body.slice(0, 5000)]);
  } catch (e2) {
    console.error('logError_ failed: ' + e2);
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════ בדיקה ידנית מתוך העורך (בוחרים testLead → Run) ═══════════════ */
function testLead() {
  const fake = {
    postData: { contents: JSON.stringify({
      sheetName: 'בדיקות', pageSource: 'בדיקה מהעורך', fullName: 'ליד בדיקה', firstName: 'ליד', lastName: 'בדיקה',
      phone: '0500000000', idNumber: '000000018', utm_source: 'test', consent: 'כן'
    }) }
  };
  console.log(doPost(fake).getContent());
}
