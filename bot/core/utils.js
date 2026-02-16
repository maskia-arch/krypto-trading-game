// ============================================================
// CORE UTILITIES (core/utils.js)
// ============================================================

/**
 * HTML-Escaping für Telegram-Nachrichten.
 * Verhindert, dass Sonderzeichen wie <, > oder & in Usernamen 
 * oder Texten zu Fehlern beim Senden führen.
 * * @param {string} text - Der zu formatierende Text
 * @returns {string} - Sicherer HTML-String
 */
function esc(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Formatiert eine Zahl als Währung (EUR)
 * @param {number} amount 
 * @returns {string}
 */
function formatEuro(amount) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

/**
 * Berechnet die Zeitdifferenz in Minuten zwischen jetzt und einem Datum
 * @param {string|Date} dateString 
 * @returns {number} Differenz in Minuten
 */
function getMinutesDiff(dateString) {
  if (!dateString) return Infinity;
  const last = new Date(dateString);
  return (Date.now() - last.getTime()) / 1000 / 60;
}

module.exports = {
  esc,
  formatEuro,
  getMinutesDiff
};
