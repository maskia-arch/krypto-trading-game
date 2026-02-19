function esc(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatEuro(amount) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

function formatCompact(amount) {
  return new Intl.NumberFormat('de-DE', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(amount);
}

function getMinutesDiff(dateString) {
  if (!dateString) return Infinity;
  const last = new Date(dateString);
  return (Date.now() - last.getTime()) / 1000 / 60;
}

function getJoinYear(dateString) {
  if (!dateString) return new Date().getFullYear();
  return new Date(dateString).getFullYear();
}

module.exports = {
  esc,
  formatEuro,
  formatCompact,
  getMinutesDiff,
  getJoinYear
};
