const { createClient } = require('@supabase/supabase-js');
const { supabaseConfig } = require('./config');

const supabase = createClient(supabaseConfig.url, supabaseConfig.key);

const db = { supabase };

Object.assign(db, require('./db/profiles')(db));
Object.assign(db, require('./db/assets')(db));
Object.assign(db, require('./db/transactions')(db));
Object.assign(db, require('./db/leaderboard')(db));
Object.assign(db, require('./db/realEstate')(db));
Object.assign(db, require('./db/pro')(db));
Object.assign(db, require('./db/achievements')(db));

db.getOpenLeveragedPositions = async function(profileId) {
  const { data, error } = await this.supabase
    .from('leveraged_positions')
    .select('*')
    .eq('profile_id', profileId)
    .eq('status', 'OPEN');
  
  if (error) throw error;
  return data || [];
};

db.getAllOpenLeveragedPositions = async function() {
  const { data, error } = await this.supabase
    .from('leveraged_positions')
    .select('*')
    .eq('status', 'OPEN');
    
  if (error) throw error;
  return data || [];
};

db.openLeveragedPosition = async function(profileId, symbol, direction, collateral, leverage, entryPrice, options = {}) {
  const { data: profile } = await this.supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (!profile) throw new Error('Profil nicht gefunden');

  const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
  const isMonday = new Date().getDay() === 1;

  const maxPositions = isPro ? 3 : 1;
  const maxLeverage = (isPro || isMonday) ? 10 : 5;
  const marginLimitFactor = isPro ? 0.90 : 0.50;

  if (leverage > maxLeverage) {
    throw new Error(`Maximaler Hebel aktuell bei ${maxLeverage}x.`);
  }

  const openPos = await this.getOpenLeveragedPositions(profileId);
  if (openPos.length >= maxPositions) {
    throw new Error(`Maximal ${maxPositions} offene Hebel-Position(en) erlaubt.`);
  }

  const currentUsedMargin = openPos.reduce((sum, p) => sum + Number(p.collateral), 0);
  const totalBalance = Number(profile.balance);
  const newCollateral = Number(collateral);
  const maxAllowedMargin = totalBalance * marginLimitFactor;

  if ((currentUsedMargin + newCollateral) > maxAllowedMargin) {
    const available = Math.max(0, maxAllowedMargin - currentUsedMargin);
    throw new Error(`Margin-Limit überschritten (${isPro ? '90%' : '50%'} vom Cash). Verfügbar: ${available.toFixed(2)}€`);
  }

  const notional = newCollateral * Number(leverage);
  const fee = notional * 0.005;
  const totalCost = newCollateral + fee;

  if (totalBalance < totalCost) {
    throw new Error(`Nicht genug Guthaben. Benötigt: ${totalCost.toFixed(2)}€`);
  }

  const newBalance = totalBalance - totalCost;
  await this.updateBalance(profileId, newBalance);

  await this.supabase.from('transactions').insert({
    profile_id: profileId,
    type: 'leverage_open',
    symbol: symbol,
    total_eur: newCollateral,
    price_eur: Number(entryPrice),
    amount: notional,
    fee_eur: fee,
    created_at: new Date().toISOString()
  });

  const liqPrice = direction === 'LONG' 
    ? entryPrice * (1 - (1 / leverage) * 0.9) 
    : entryPrice * (1 + (1 / leverage) * 0.9);

  const { data, error } = await this.supabase.from('leveraged_positions').insert({
    profile_id: profileId,
    symbol: symbol,
    direction: direction,
    collateral: newCollateral,
    leverage: Number(leverage),
    entry_price: Number(entryPrice),
    liquidation_price: liqPrice,
    status: 'OPEN',
    stop_loss: options.stop_loss || null,
    take_profit: options.take_profit || null,
    limit_price: options.limit_price || null,
    trailing_stop: options.trailing_stop || false,
    is_limit_order: !!options.limit_price
  }).select().single();

  if (error) throw error;
  return data;
};

db.closeLeveragedPosition = async function(positionId, closePrice, isLiquidation = false) {
  const { data: pos } = await this.supabase
    .from('leveraged_positions')
    .select('*')
    .eq('id', positionId)
    .single();

  if (!pos || pos.status !== 'OPEN') throw new Error('Position bereits geschlossen');

  const notional = Number(pos.collateral) * Number(pos.leverage);
  let pnl = 0;

  if (pos.direction === 'LONG') {
    pnl = ((Number(closePrice) - Number(pos.entry_price)) / Number(pos.entry_price)) * notional;
  } else {
    pnl = ((Number(pos.entry_price) - Number(closePrice)) / Number(pos.entry_price)) * notional;
  }

  let equity = Number(pos.collateral) + pnl;
  const fee = notional * 0.005;
  let payout = 0;
  let status = 'CLOSED';
  let reason = null;

  if (isLiquidation || equity <= (Number(pos.collateral) * 0.1)) {
    status = 'LIQUIDATED';
    payout = 0;
    reason = isLiquidation ? 'CRON_LIQUIDATION' : 'MARGIN_CALL';
  } else {
    payout = equity - fee;
    if (payout < 0) payout = 0;
  }

  await this.supabase.from('leveraged_positions').update({
    status: status,
    exit_price: Number(closePrice),
    closed_at: new Date().toISOString(),
    pnl: pnl,
    equity_at_close: equity,
    liquidation_reason: reason
  }).eq('id', positionId);

  if (payout > 0) {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('balance')
      .eq('id', pos.profile_id)
      .single();

    if (profile) {
      await this.updateBalance(pos.profile_id, Number(profile.balance) + payout);
    }
  }

  await this.supabase.from('transactions').insert({
    profile_id: pos.profile_id,
    type: status === 'LIQUIDATED' ? 'leverage_liquidated' : 'leverage_close',
    symbol: pos.symbol,
    total_eur: payout,
    price_eur: Number(closePrice),
    amount: notional,
    fee_eur: status === 'LIQUIDATED' ? 0 : fee,
    created_at: new Date().toISOString()
  });

  return { pnl, payout, equity, status };
};

db.partialCloseLeveragedPosition = async function(positionId) {
  const { data: pos } = await this.supabase
    .from('leveraged_positions')
    .select('*')
    .eq('id', positionId)
    .single();

  if (!pos || pos.status !== 'OPEN') throw new Error('Position nicht gefunden');

  const { data: currentPriceData } = await this.supabase
    .from('current_prices')
    .select('price_eur')
    .eq('symbol', pos.symbol)
    .single();

  const closePrice = currentPriceData.price_eur;
  const partialFactor = 0.5;
  const closingCollateral = Number(pos.collateral) * partialFactor;
  const closingNotional = closingCollateral * Number(pos.leverage);

  let pnl = 0;
  if (pos.direction === 'LONG') {
    pnl = ((Number(closePrice) - Number(pos.entry_price)) / Number(pos.entry_price)) * closingNotional;
  } else {
    pnl = ((Number(pos.entry_price) - Number(closePrice)) / Number(pos.entry_price)) * closingNotional;
  }

  const fee = closingNotional * 0.005;
  const payout = (closingCollateral + pnl) - fee;

  await this.supabase.from('leveraged_positions').update({
    collateral: Number(pos.collateral) - closingCollateral
  }).eq('id', positionId);

  if (payout > 0) {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('balance')
      .eq('id', pos.profile_id)
      .single();
    await this.updateBalance(pos.profile_id, Number(profile.balance) + payout);
  }

  await this.supabase.from('transactions').insert({
    profile_id: pos.profile_id,
    type: 'leverage_close',
    symbol: pos.symbol,
    total_eur: payout,
    price_eur: Number(closePrice),
    amount: closingNotional,
    fee_eur: fee,
    details: 'Partial Close 50%',
    created_at: new Date().toISOString()
  });

  return { pnl, payout };
};

db.checkAndGrantAchievements = async function(profileId) {
  try {
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('balance, total_volume')
      .eq('id', profileId)
      .single();

    if (!profile) return [];

    const balance = Number(profile.balance || 0);
    const volume = Number(profile.total_volume || 0);

    const { data: earned } = await this.supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('profile_id', profileId);

    const earnedIds = (earned || []).map(a => a.achievement_id);

    const achievements = [
      { id: 1, condition: balance >= 15000, reward: 500, name: 'Jung-Investor' },
      { id: 2, condition: volume >= 50000, reward: 1000, name: 'Daytrader' },
      { id: 3, condition: balance >= 100000, reward: 5000, name: 'Krypto-Wal' },
      { id: 4, condition: volume >= 1000000, reward: 10000, name: 'Marktmacher' }
    ];

    const newlyUnlocked = [];
    let totalReward = 0;

    for (const ach of achievements) {
      if (ach.condition && !earnedIds.includes(ach.id)) {
        await this.supabase.from('user_achievements').insert({
          profile_id: profileId,
          achievement_id: ach.id
        });
        newlyUnlocked.push(ach);
        totalReward += ach.reward;
      }
    }

    if (newlyUnlocked.length > 0 && totalReward > 0) {
      const newBalance = balance + totalReward;
      await this.updateBalance(profileId, newBalance);

      await this.supabase.from('transactions').insert({
        profile_id: profileId,
        type: 'achievement_reward',
        symbol: 'REWARD',
        total_eur: totalReward,
        price_eur: 0,
        amount: 0,
        fee_eur: 0,
        created_at: new Date().toISOString()
      });
    }

    return newlyUnlocked;
  } catch (err) {
    return [];
  }
};

db.cleanupExpiredBackgrounds = async function() {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const { data: expired } = await this.supabase
    .from('profiles')
    .select('id, background_url')
    .lte('background_disabled_at', fourWeeksAgo.toISOString());

  if (expired && expired.length > 0) {
    for (const profile of expired) {
      if (profile.background_url) {
        const fileName = profile.background_url.split('/').pop();
        await this.supabase.storage.from('backgrounds').remove([fileName]);
      }
      await this.supabase
        .from('profiles')
        .update({ background_url: null, background_disabled_at: null })
        .eq('id', profile.id);
    }
  }
};
// --- NEUE PRO-BESTELL-LOGIK (v0.3.1) ---

/**
 * Erstellt eine neue Pro-Anfrage mit Tarifauswahl
 */
db.createProRequest = async function(profileId, months, price) {
  const { data, error } = await this.supabase
    .from('pro_requests')
    .insert({
      profile_id: profileId,
      duration_months: months,
      price_paid: price,
      status: 'pending',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Erhöht die Strikes eines Users bei Ablehnung
 */
db.addProStrike = async function(profileId) {
  const { data: profile } = await this.supabase
    .from('profiles')
    .select('pro_strikes')
    .eq('id', profileId)
    .single();

  const newStrikes = (profile?.pro_strikes || 0) + 1;
  
  await this.supabase
    .from('profiles')
    .update({ pro_strikes: newStrikes })
    .eq('id', profileId);

  return newStrikes;
};

/**
 * Aktiviert Pro für einen spezifischen Zeitraum
 */
db.activateProForUser = async function(profileId, months) {
  const proUntil = new Date();
  proUntil.setMonth(proUntil.getMonth() + months);

  const { data, error } = await this.supabase
    .from('profiles')
    .update({ 
      is_pro: true, 
      pro_until: proUntil.toISOString(),
      pro_strikes: 0 // Bei erfolgreichem Kauf werden Strikes zurückgesetzt
    })
    .eq('id', profileId);

  if (error) throw error;
  return proUntil;
};

module.exports = { db };
