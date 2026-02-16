// ============================================================
// API Client – kommuniziert mit dem Bot-Backend
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'https://your-bot.onrender.com';

function getTelegramId() {
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) return tg.initDataUnsafe.user.id;
  } catch (e) { /* Nicht in Telegram */ }
  const params = new URLSearchParams(window.location.search);
  return params.get('telegram_id') || '123456789';
}

function getTelegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch (e) { return null; }
}

async function apiCall(path, options = {}) {
  const tgId = getTelegramId();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-id': String(tgId),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Fehler');
  return data;
}

export const api = {
  getVersion:           ()                              => apiCall('/api/version'),
  getProfile:           ()                              => apiCall('/api/profile'),
  getPrices:            ()                              => apiCall('/api/prices'),
  getChart:             (symbol, range = '3h')          => apiCall(`/api/chart/${symbol}?range=${range}`),
  buy:                  (symbol, amount_eur)            => apiCall('/api/trade', { method: 'POST', body: JSON.stringify({ action: 'buy', symbol, amount_eur }) }),
  sell:                 (symbol, amount_crypto)          => apiCall('/api/trade', { method: 'POST', body: JSON.stringify({ action: 'sell', symbol, amount_crypto }) }),
  getLeaderboard:       ()                              => apiCall('/api/leaderboard'),
  getRealEstateTypes:   ()                              => apiCall('/api/realestate/types'),
  getMyRealEstate:      ()                              => apiCall('/api/realestate/mine'),
  buyRealEstate:        (type_id)                       => apiCall('/api/realestate/buy', { method: 'POST', body: JSON.stringify({ type_id }) }),
  collectRent:          ()                              => apiCall('/api/realestate/collect', { method: 'POST' }),
  getCollectibleTypes:  ()                              => apiCall('/api/collectibles/types'),
  getMyCollectibles:    ()                              => apiCall('/api/collectibles/mine'),
  buyCollectible:       (type_id)                       => apiCall('/api/collectibles/buy', { method: 'POST', body: JSON.stringify({ type_id }) }),
  openLeverage:         (symbol, direction, leverage, amount_eur) => apiCall('/api/leverage/open', { method: 'POST', body: JSON.stringify({ symbol, direction, leverage, amount_eur }) }),
  closeLeverage:        (position_id)                   => apiCall('/api/leverage/close', { method: 'POST', body: JSON.stringify({ position_id }) }),
  getLeveragePositions:  ()                             => apiCall('/api/leverage/positions'),
  createAlert:          (symbol, target_price, direction) => apiCall('/api/alert', { method: 'POST', body: JSON.stringify({ symbol, target_price, direction }) }),
  getTransactions:      ()                              => apiCall('/api/transactions'),
};

export { getTelegramId, getTelegramUser };
