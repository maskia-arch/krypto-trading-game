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

function calculateLiquidationPrice(entryPrice, leverage, direction) {
  const maintenanceMargin = 0.1; 
  if (direction === 'LONG') {
    return entryPrice * (1 - (1 / leverage) * (1 - maintenanceMargin));
  } else {
    return entryPrice * (1 + (1 / leverage) * (1 - maintenanceMargin));
  }
}

function calculatePnL(entryPrice, currentPrice, leverage, collateral, direction) {
  const notional = Number(collateral) * Number(leverage);
  if (direction === 'LONG') {
    return ((currentPrice - entryPrice) / entryPrice) * notional;
  } else {
    return ((entryPrice - currentPrice) / entryPrice) * notional;
  }
}

module.exports = {
  esc,
  formatEuro,
  formatCompact,
  getMinutesDiff,
  getJoinYear,
  calculateLiquidationPrice,
  calculatePnL
};
