/* =====================================================================
   הגדרות משותפות לכל דפי הנחיתה — זה הקובץ היחיד שצריך לערוך
   ===================================================================== */
window.SITE_CONFIG = {
  brand: 'Future Insurance',
  agentName: 'אמיר שושני',

  // ---- פרטים משפטיים (מופיעים אוטומטית בפוטר, בתנאי השימוש ובהצהרת הנגישות) ----
  licenseNumber: '00000',          // ⚠️ להחליף במספר רישיון הסוכן מרשות שוק ההון
  email: '',                       // ⚠️ להשלים — נדרש בהצהרת הנגישות ובמדיניות הפרטיות
  accessibilityCoordinator: 'אמיר שושני',
  legalUpdated: '05.10.2026',      // תאריך עדכון אחרון של המסמכים המשפטיים
  legalVersion: '2026-10-05',      // נשמר עם כל ליד כראיה לנוסח שאושר

  // עוגיות ו-Consent Mode של Google:
  //   'notice' — המדידה פעילה, והגולש יכול לבחור "רק חיוניות" (מקובל בישראל, שומר על נתוני ההמרות)
  //   'opt-in' — המדידה כבויה עד שהגולש מאשר (מחמיר יותר; Google משלימה המרות במודל סטטיסטי)
  cookieMode: 'notice',

  // כתובת ה-Web App של Google Apps Script (קובץ google-apps-script.gs בתיקייה)
  scriptUrl: 'https://script.google.com/macros/s/AKfycbxu4uYQHxzuGSsH8ljJ6xO0ooF2zZekvwK7HJh0IiF2fJWqM3v0oPv0EnrUqh0FSfLhzQ/exec',

  phoneDisplay: '052-842-2884',
  phoneTel: '0528422884',
  whatsappNumber: '972528422884',

  // Google Ads — ההמרה נורית בדף התודה בלבד (כדי לא לספור פעמיים)
  // לדוגמה: gtagId: 'AW-123456789', conversionSendTo: 'AW-123456789/AbCdEfGhIj'
  gtagId: '',
  conversionSendTo: '',
  // אם עובדים עם Google Tag Manager — מזהה המכולה, לדוגמה 'GTM-XXXXXXX'
  gtmId: ''
};
