const API_BASE = import.meta.env.VITE_API_URL || 'https://your-bot.onrender.com';

export function getTelegramId() {
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) return tg.initDataUnsafe.user.id;
  } catch (e) {}
  
  const params = new URLSearchParams(window.location.search);
  return params.get('telegram_id') || '123456789';
}

export function getTelegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch (e) {
    return null;
  }
}

async function apiCall(path, options = {}) {
  const tgId = getTelegramId();
  
  const isGet = !options.method || options.method === 'GET';
  const separator = path.includes('?') ? '&' : '?';
  const finalPath = isGet ? `${path}${separator}_t=${Date.now()}` : path;
  
  const res = await fetch(`${API_BASE}${finalPath}`, {
    ...options,
    cache: 'no-store',
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
  getVersion:           () => apiCall('/api/version'),
  getProfile:           () => apiCall('/api/profile'),
  getPublicProfile:     (id) => apiCall(`/api/profile/public/${id}`),
  updateAvatar:         (avatar_url) => apiCall('/api/profile/avatar', { method: 'POST', body: JSON.stringify({ avatar_url }) }),
  deleteAvatar:         () => apiCall('/api/profile/avatar', { method: 'DELETE' }),
  getPrices:            () => apiCall('/api/profile/prices'),
  getTransactions:      () => apiCall('/api/profile/transactions'),
  updateUsername:       (username) => apiCall('/api/profile/update-username', { method: 'POST', body: JSON.stringify({ username }) }),
  updatePrivacy:        (hide_collectibles) => apiCall('/api/profile/update-privacy', { method: 'POST', body: JSON.stringify({ hide_collectibles }) }),
  claimBonus:           () => apiCall('/api/profile/claim-bonus', { method: 'POST' }),
  requestAccountDeletion: () => apiCall('/api/profile/request-deletion', { method: 'POST' }),
  collectRent:          () => apiCall('/api/profile/collect-rent', { method: 'POST' }),
  getChart:             (symbol, range = '3h') => apiCall(`/api/economy/chart/${symbol}?range=${range}`),
  buy:                  (symbol, amount_eur) => apiCall('/api/trade', { method: 'POST', body: JSON.stringify({ action: 'buy', symbol, amount_eur }) }),
  sell:                 (symbol, amount_crypto) => apiCall('/api/trade', { method: 'POST', body: JSON.stringify({ action: 'sell', symbol, amount_crypto }) }),
  
  getLeaderboard:       (filter = 'profit_season') => apiCall(`/api/economy/leaderboard?filter=${filter}`), 
  
  getRealEstateTypes:   () => apiCall('/api/economy/realestate/types'),
  getMyRealEstate:      () => apiCall('/api/economy/realestate/mine'),
  buyRealEstate:        (type_id) => apiCall('/api/economy/realestate/buy', { method: 'POST', body: JSON.stringify({ type_id }) }),
  getCollectibleTypes:  () => apiCall('/api/economy/collectibles/types'),
  getMyCollectibles:    () => apiCall('/api/economy/collectibles/mine'),
  buyCollectible:       (type_id) => apiCall('/api/economy/collectibles/buy', { method: 'POST', body: JSON.stringify({ type_id }) }),
  sellCollectible:      (user_collectible_id) => apiCall('/api/economy/collectibles/sell', { method: 'POST', body: JSON.stringify({ user_collectible_id }) }),
  openLeverage:         (symbol, direction, leverage, amount_eur) => apiCall('/api/economy/leverage/open', { method: 'POST', body: JSON.stringify({ symbol, direction, leverage, amount_eur }) }),
  getLeveragePositions: () => apiCall('/api/economy/leverage/positions'),
  closeLeverage:        (position_id) => apiCall('/api/economy/leverage/close', { method: 'POST', body: JSON.stringify({ position_id }) }),
  createAlert:          (symbol, target_price, direction) => apiCall('/api/alert', { method: 'POST', body: JSON.stringify({ symbol, target_price, direction }) }),
};
