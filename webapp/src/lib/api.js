const API_BASE = import.meta.env.VITE_API_URL || 'https://your-bot.onrender.com';

export function getTelegramInitData() {
  return window.Telegram?.WebApp?.initData || '';
}

export function getTelegramId() {
  try {
    const tg = window.Telegram?.WebApp;
    // v0.3.0 Check: Sicherstellen, dass die ID als Number zurückgegeben wird
    if (tg?.initDataUnsafe?.user?.id) return Number(tg.initDataUnsafe.user.id);
  } catch (e) {}
  
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get('telegram_id');
  return queryId ? Number(queryId) : null;
}

export function getTelegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch (e) {
    return null;
  }
}

async function apiCall(path, options = {}) {
  const initData = getTelegramInitData();
  const tgId = getTelegramId();
  
  // v0.3.0 Bugfix: Wenn beides fehlt, ist der User nicht authentifiziert
  if (!initData && !tgId) {
    console.error("Auth-Error: Weder initData noch ID gefunden.");
    throw new Error('Nicht autorisiert. Bitte App neu über den Bot starten.');
  }
  
  const isGet = !options.method || options.method === 'GET';
  const separator = path.includes('?') ? '&' : '?';
  const finalPath = isGet ? `${path}${separator}_t=${Date.now()}` : path;
  
  try {
    const res = await fetch(`${API_BASE}${finalPath}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': initData,
        'x-telegram-id': String(tgId),
        ...options.headers,
      },
    });
    
    // Falls 401 Unauthorized kommt, explizite Meldung für den Store
    if (res.status === 401) {
      throw new Error('Sitzung abgelaufen oder ungültig. Bitte neu starten.');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Fehler');
    
    return data;
  } catch (err) {
    console.error(`API Call failed [${path}]:`, err.message);
    throw err;
  }
}

export const api = {
  // ... (restliche API-Funktionen bleiben gleich)
  getVersion:             () => apiCall('/api/version'),
  getProfile:             () => apiCall('/api/profile'),
  getPublicProfile:       (id) => apiCall(`/api/profile/public/${id}`),
  updateAvatar:           (avatar_url) => apiCall('/api/profile/avatar', { method: 'POST', body: JSON.stringify({ avatar_url }) }),
  deleteAvatar:           () => apiCall('/api/profile/avatar', { method: 'DELETE' }),
  updateBackground:       (background_url) => apiCall('/api/profile/background', { method: 'POST', body: JSON.stringify({ background_url }) }),
  deleteBackground:       () => apiCall('/api/profile/background', { method: 'DELETE' }),
  getPrices:              () => apiCall('/api/profile/prices'),
  getTransactions:        () => apiCall('/api/profile/transactions'),
  updateUsername:         (username) => apiCall('/api/profile/update-username', { method: 'POST', body: JSON.stringify({ username }) }),
  updatePrivacy:          (hide_collectibles) => apiCall('/api/profile/update-privacy', { method: 'POST', body: JSON.stringify({ hide_collectibles }) }),
  claimBonus:             () => apiCall('/api/profile/claim-bonus', { method: 'POST' }),
  requestAccountDeletion: () => apiCall('/api/profile/request-deletion', { method: 'POST' }),
  collectRent:            () => apiCall('/api/profile/collect-rent', { method: 'POST' }),
  getChart:               (symbol, range = '3h') => apiCall(`/api/economy/chart/${symbol}?range=${range}`),
  buy:                    (symbol, amount_eur) => apiCall('/api/trade', { method: 'POST', body: JSON.stringify({ action: 'buy', symbol, amount_eur }) }),
  sell:                   (symbol, amount_crypto) => apiCall('/api/trade', { method: 'POST', body: JSON.stringify({ action: 'sell', symbol, amount_crypto }) }),
  getLeaderboard:         (filter = 'profit_season') => apiCall(`/api/economy/leaderboard?filter=${filter}`), 
  getReferrals:           () => apiCall('/api/referrals'),
  getRealEstateTypes:     () => apiCall('/api/economy/realestate/types'),
  getMyRealEstate:        () => apiCall('/api/economy/realestate/mine'),
  buyRealEstate:          (type_id) => apiCall('/api/economy/realestate/buy', { method: 'POST', body: JSON.stringify({ type_id }) }),
  getCollectibleTypes:    () => apiCall('/api/economy/collectibles/types'),
  getMyCollectibles:      () => apiCall('/api/economy/collectibles/mine'),
  buyCollectible:         (type_id) => apiCall('/api/economy/collectibles/buy', { method: 'POST', body: JSON.stringify({ type_id }) }),
  sellCollectible:        (user_collectible_id) => apiCall('/api/economy/collectibles/sell', { method: 'POST', body: JSON.stringify({ user_collectible_id }) }),
  getLeveragePositions:   () => apiCall('/api/leverage/positions'),
  openLeverage:           (symbol, direction, collateral, leverage, options = {}) => apiCall('/api/leverage/open', { 
    method: 'POST', 
    body: JSON.stringify({ 
      symbol, 
      direction, 
      collateral, 
      leverage,
      stop_loss: options.stop_loss || null,
      take_profit: options.take_profit || null,
      limit_price: options.limit_price || null,
      trailing_stop: options.trailing_stop || false
    }) 
  }),
  partialClose:           (position_id) => apiCall('/api/leverage/partial-close', { 
    method: 'POST', 
    body: JSON.stringify({ position_id, percentage: 0.5 }) // Korrektur: 0.5 statt 50 für das Backend
  }),
  closeLeverage:          (position_id) => apiCall('/api/leverage/close', { method: 'POST', body: JSON.stringify({ position_id }) }),
  createAlert:            (symbol, target_price, direction) => apiCall('/api/alert', { method: 'POST', body: JSON.stringify({ symbol, target_price, direction }) }),
};
