const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { parseTelegramUser } = require('../auth');
const { COINS, FEE_RATE } = require('../../core/config');

router.get('/prices', async (req, res) => {
  try {
    const prices = await db.getAllPrices();
    res.json({ prices });
  } catch (err) {
    res.status(500).json({ error: 'Preise konnten nicht geladen werden' });
  }
});

router.get('/chart/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const range = req.query.range || '3h';
  
  const hoursMap = { '3h': 3, '12h': 12, '24h': 24 };
  const hours = hoursMap[range] || 3;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await db.supabase
      .from('market_history')
      .select('price_eur, recorded_at')
      .eq('symbol', symbol.toUpperCase())
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });

    if (error) throw error;
    res.json({ symbol: symbol.toUpperCase(), range, data: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Chart-Daten nicht verfügbar' });
  }
});

router.get('/leverage/positions', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const positions = await db.getOpenLeveragedPositions(profile.id);
    const isMonday = new Date().getDay() === 1;
    const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());

    res.json({ 
      positions,
      policy: {
        max_positions: isPro ? 3 : 1,
        margin_limit_factor: isPro ? 0.9 : 0.8,
        max_leverage: (isMonday || isPro) ? 10 : 5,
        is_monday: isMonday,
        is_pro: isPro
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Hebel-Daten' });
  }
});

router.post('/leverage/open', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const { symbol, direction, collateral, leverage, stop_loss, take_profit, limit_price, trailing_stop } = req.body;

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const price = await db.getCurrentPrice(symbol);
    if (!price) return res.status(500).json({ error: 'Kurs nicht verfügbar' });

    const isPro = profile.is_admin || (profile.is_pro && new Date(profile.pro_until) > new Date());
    
    const options = {
      stop_loss: isPro ? stop_loss : null,
      take_profit: isPro ? take_profit : null,
      limit_price: isPro ? limit_price : null,
      trailing_stop: isPro ? trailing_stop : false
    };

    const position = await db.openLeveragedPosition(
      profile.id, 
      symbol, 
      direction.toUpperCase(), 
      Number(collateral), 
      Number(leverage), 
      price,
      options
    );

    if (req.bot) {
      let msg = `⚡ <b>HEBEL-TRADE GESTARTET</b>\n\n`;
      if (options.limit_price) {
        msg = `⏳ <b>LIMIT-ORDER PLATZIERT</b>\n\n`;
      }
      msg += `<b>${symbol} ${direction.toUpperCase()}</b>\nHebel: <b>${leverage}x</b>\nMargin: <b>${Number(collateral).toFixed(2)}€</b>\n`;
      msg += options.limit_price ? `Ziel: <b>${Number(options.limit_price).toLocaleString('de-DE')}€</b>` : `Einstieg: <b>${price.toLocaleString('de-DE')}€</b>`;
      
      req.bot.api.sendMessage(profile.telegram_id, msg, { parse_mode: 'HTML' }).catch(() => {});
    }

    res.json({ success: true, position });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/leverage/partial-close', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const { position_id, percentage } = req.body;

  try {
    const profile = await db.getProfile(tgId);
    const result = await db.partialCloseLeveragedPosition(position_id, profile.id, percentage);

    if (req.bot) {
      const msg = `✂️ <b>TEILSCHLIESSUNG</b>\n\nDu hast <b>${(percentage * 100).toFixed(0)}%</b> deiner Position geschlossen.\nPayout: <b>${result.payout.toFixed(2)}€</b>\nRest-Margin: <b>${result.remaining_collateral.toFixed(2)}€</b>`;
      req.bot.api.sendMessage(profile.telegram_id, msg, { parse_mode: 'HTML' }).catch(() => {});
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/leverage/close', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const { position_id } = req.body;

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const { data: pos } = await db.supabase
      .from('leveraged_positions')
      .select('symbol')
      .eq('id', position_id)
      .single();

    const price = await db.getCurrentPrice(pos.symbol);
    const result = await db.closeLeveragedPosition(position_id, price);

    if (req.bot) {
      const emoji = result.pnl >= 0 ? '💰' : '📉';
      const msg = `${emoji} <b>HEBEL-TRADE GESCHLOSSEN</b>\n\nSymbol: <b>${pos.symbol}</b>\nKurs: <b>${price.toLocaleString('de-DE')}€</b>\nPnL: <b>${result.pnl.toFixed(2)}€</b>\nAuszahlung: <b>${result.payout.toFixed(2)}€</b>`;
      req.bot.api.sendMessage(profile.telegram_id, msg, { parse_mode: 'HTML' }).catch(() => {});
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const { action, symbol, amount_eur, amount_crypto } = req.body;

  if (!['buy', 'sell'].includes(action)) return res.status(400).json({ error: 'Ungültige Aktion' });
  if (!COINS[symbol]) return res.status(400).json({ error: 'Unbekannter Coin' });

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const price = await db.getCurrentPrice(symbol);
    if (!price) return res.status(500).json({ error: 'Kein Kurs verfügbar' });

    let tradeResult = null;

    if (action === 'buy') {
      const euroAmount = Number(amount_eur);
      if (!euroAmount || euroAmount <= 0) return res.status(400).json({ error: 'Ungültiger Euro-Betrag' });

      const fee = parseFloat((euroAmount * (FEE_RATE || 0.005)).toFixed(2));
      const netAmount = euroAmount - fee;
      const cryptoAmount = netAmount / price;

      if (euroAmount > Number(profile.balance)) {
        return res.status(400).json({ error: 'Guthaben unzureichend' });
      }

      const existingAsset = await db.getAsset(profile.id, symbol);
      if (existingAsset && Number(existingAsset.amount) <= 0) {
        await db.supabase.from('assets').update({ first_buy: new Date().toISOString() }).eq('id', existingAsset.id);
      }

      const newBalance = parseFloat((Number(profile.balance) - euroAmount).toFixed(2));

      await db.updateBalance(profile.id, newBalance);
      await db.upsertAsset(profile.id, symbol, cryptoAmount, price);
      await db.addVolume(profile.id, euroAmount);
      
      if (db.addToFeePool) {
        await db.addToFeePool(fee);
      }
      
      await db.logTransaction(profile.id, 'buy', symbol, cryptoAmount, price, fee, euroAmount);

      tradeResult = { 
        success: true, 
        action: 'buy', 
        crypto_amount: cryptoAmount, 
        fee: fee,
        balance: newBalance 
      };

      if (req.bot) {
        const msg = `🟢 <b>TRADE ERÖFFNET</b>\n\nDu hast <b>${cryptoAmount.toFixed(4)} ${symbol}</b> für <b>${euroAmount.toLocaleString('de-DE')}€</b> gekauft.\n<i>Kaufkurs: ${price.toLocaleString('de-DE')}€</i>`;
        req.bot.api.sendMessage(profile.telegram_id, msg, { parse_mode: 'HTML' }).catch(() => {});
      }

    } else if (action === 'sell') {
      const asset = await db.getAsset(profile.id, symbol);
      if (!asset || Number(asset.amount) <= 0) {
        return res.status(400).json({ error: 'Kein Bestand zum Verkaufen vorhanden' });
      }

      const sellAmount = amount_crypto ? Math.min(Number(amount_crypto), Number(asset.amount)) : Number(asset.amount);
      if (sellAmount <= 0) return res.status(400).json({ error: 'Ungültige Menge' });

      const grossEuro = sellAmount * price;
      const fee = parseFloat((grossEuro * (FEE_RATE || 0.005)).toFixed(2));
      const netEuro = parseFloat((grossEuro - fee).toFixed(2));
      const newBalance = parseFloat((Number(profile.balance) + netEuro).toFixed(2));

      await db.upsertAsset(profile.id, symbol, -sellAmount, 0);
      await db.updateBalance(profile.id, newBalance);
      await db.addVolume(profile.id, grossEuro);
      
      if (db.addToFeePool) {
        await db.addToFeePool(fee);
      }

      await db.logTransaction(profile.id, 'sell', symbol, sellAmount, price, fee, netEuro);

      tradeResult = { 
        success: true, 
        action: 'sell', 
        euro_received: netEuro, 
        fee: fee,
        balance: newBalance 
      };

      if (req.bot) {
        const msg = `🔴 <b>TRADE GESCHLOSSEN</b>\n\nDu hast <b>${sellAmount.toFixed(4)} ${symbol}</b> für <b>${netEuro.toLocaleString('de-DE')}€</b> verkauft.\n<i>Verkaufskurs: ${price.toLocaleString('de-DE')}€</i>`;
        req.bot.api.sendMessage(profile.telegram_id, msg, { parse_mode: 'HTML' }).catch(() => {});
      }
    }

    if (tradeResult && db.checkAndGrantAchievements) {
      const unlocked = await db.checkAndGrantAchievements(profile.id);
      tradeResult.new_achievements = unlocked;

      if (unlocked && unlocked.length > 0 && req.bot) {
        for (const ach of unlocked) {
          const msg = `🏆 <b>ACHIEVEMENT FREIGESCHALTET!</b>\n\nGlückwunsch, du hast das Abzeichen <b>${ach.name}</b> erhalten!\n\nDein Bonus: <b>+${ach.reward.toLocaleString('de-DE')}€</b> 💰 wurden deinem Guthaben hinzugefügt.`;
          try {
            await req.bot.api.sendMessage(profile.telegram_id, msg, { parse_mode: 'HTML' });
          } catch (e) {
            console.error(e);
          }
        }
      }
    }

    res.json(tradeResult);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Transaktion fehlgeschlagen' });
  }
});

module.exports = router;
