const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { COINS, FEE_RATE, SPOT_FEE_RATE, TRADING_LIMITS, isMondayBerlin } = require('../../core/config');

// 1. Marktdaten (Öffentlich, aber via Middleware gesichert)
router.get('/prices', async (req, res) => {
  try {
    const prices = await db.getAllPrices();
    res.json({ prices });
  } catch (err) {
    res.status(500).json({ error: 'Preise konnten nicht geladen werden' });
  }
});

// 2. Hebel-Positionen & Policy
router.get('/leverage/positions', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const positions = await db.getOpenLeveragedPositions(profile.id);
    const isMonday = isMondayBerlin();
    const isPro = req.permissions.isPro;
    const isAdmin = req.permissions.isAdmin;
    const effectivelyPro = isPro || isAdmin;

    // v0.3.21: Zocker-Modus Policy
    let limits;
    if (effectivelyPro) {
      limits = TRADING_LIMITS.PRO;
    } else if (isMonday) {
      limits = TRADING_LIMITS.FREE_MONDAY;
    } else {
      limits = TRADING_LIMITS.FREE;
    }

    // v0.3.30: Temporäre Features (Glücksrad) einbeziehen
    let tempFeatures = [];
    if (!effectivelyPro && db.getActiveTempFeatures) {
      try {
        tempFeatures = await db.getActiveTempFeatures(profile.id);
        const featureKeys = tempFeatures.map(f => f.feature_key);
        
        if (featureKeys.includes('zocker_mode')) {
          limits = { ...limits, MAX_LEVERAGE: 50, ZOCKER_LEVERAGES: [20, 50], ZOCKER_ENABLED: true };
        }
        if (featureKeys.includes('multi_positions')) {
          limits = { ...limits, MAX_POSITIONS: 3 };
        }
      } catch (e) {
        console.error('Temp features check error:', e.message);
      }
    }

    res.json({ 
      positions,
      policy: {
        max_positions: limits.MAX_POSITIONS,
        margin_limit_factor: limits.MARGIN_LIMIT_FACTOR,
        max_leverage: limits.MAX_LEVERAGE,
        maxLeverage: limits.MAX_LEVERAGE,
        maxPositions: limits.MAX_POSITIONS,
        standardLeverages: limits.STANDARD_LEVERAGES,
        zockerLeverages: limits.ZOCKER_LEVERAGES || [],
        zockerEnabled: limits.ZOCKER_ENABLED || false,
        is_monday: isMonday,
        is_pro: effectivelyPro,
        isPro: effectivelyPro,
        isAdmin: !!isAdmin,
        tempFeatures: tempFeatures.map(f => f.feature_key)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Hebel-Daten' });
  }
});

// 3. Hebel-Trade eröffnen (inkl. Pro-Features + Temp-Features)
router.post('/leverage/open', async (req, res) => {
  const { symbol, direction, collateral, leverage, stop_loss, take_profit, limit_price, trailing_stop } = req.body;

  try {
    const profile = await db.getProfile(req.tgId);
    const price = await db.getCurrentPrice(symbol);
    if (!price) return res.status(500).json({ error: 'Kurs nicht verfügbar' });

    let isPro = req.permissions.isPro || req.permissions.isAdmin;
    
    // v0.3.31: Temp Features für Free User berücksichtigen
    let tempFeatureKeys = [];
    if (!isPro && db.getActiveTempFeatures) {
      try {
        const tempFeatures = await db.getActiveTempFeatures(profile.id);
        tempFeatureKeys = tempFeatures.map(f => f.feature_key);
      } catch (e) {}
    }

    const hasZocker = isPro || tempFeatureKeys.includes('zocker_mode');
    const hasTrailing = isPro || tempFeatureKeys.includes('trailing_stop');
    const hasLimitOrders = isPro || tempFeatureKeys.includes('limit_orders');
    const hasStopLoss = isPro || tempFeatureKeys.includes('stop_loss');
    
    const options = {
      stop_loss: hasStopLoss ? stop_loss : null,
      take_profit: hasStopLoss ? take_profit : null,
      limit_price: hasLimitOrders ? limit_price : null,
      trailing_stop: hasTrailing ? trailing_stop : false
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
      let msg = options.limit_price ? `⏳ <b>LIMIT-ORDER PLATZIERT</b>\n\n` : `⚡ <b>HEBEL-TRADE GESTARTET</b>\n\n`;
      msg += `<b>${symbol} ${direction.toUpperCase()}</b>\nHebel: <b>${leverage}x</b>\nMargin: <b>${Number(collateral).toFixed(2)}€</b>\n`;
      msg += options.limit_price ? `Ziel: <b>${Number(options.limit_price).toLocaleString('de-DE')}€</b>` : `Einstieg: <b>${price.toLocaleString('de-DE')}€</b>`;
      
      req.bot.api.sendMessage(profile.telegram_id, msg, { parse_mode: 'HTML' }).catch(() => {});
    }

    res.json({ success: true, position });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Teilschließung
router.post('/leverage/partial-close', async (req, res) => {
  const { position_id, percentage } = req.body;

  try {
    const profile = await db.getProfile(req.tgId);
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

// 5. Position schließen
router.post('/leverage/close', async (req, res) => {
  const { position_id } = req.body;

  try {
    const profile = await db.getProfile(req.tgId);
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

// 6. Spot Handel (Kauf/Verkauf)
router.post('/', async (req, res) => {
  const { action, symbol, amount_eur, amount_crypto } = req.body;

  if (!['buy', 'sell'].includes(action)) return res.status(400).json({ error: 'Ungültige Aktion' });
  if (!COINS[symbol]) return res.status(400).json({ error: 'Unbekannter Coin' });

  try {
    const profile = await db.getProfile(req.tgId);
    const price = await db.getCurrentPrice(symbol);
    if (!price) return res.status(500).json({ error: 'Kein Kurs verfügbar' });

    let tradeResult = null;

    if (action === 'buy') {
      const euroAmount = Number(amount_eur);
      if (euroAmount > Number(profile.balance)) return res.status(400).json({ error: 'Guthaben unzureichend' });

      // v0.3.23: Spot Fee = 0.25%
      const fee = parseFloat((euroAmount * (SPOT_FEE_RATE || 0.0025)).toFixed(2));
      const cryptoAmount = (euroAmount - fee) / price;
      const newBalance = parseFloat((Number(profile.balance) - euroAmount).toFixed(2));

      await db.updateBalance(profile.id, newBalance);
      await db.upsertAsset(profile.id, symbol, cryptoAmount, price);
      await db.addVolume(profile.id, euroAmount);
      if (db.addToFeePool) await db.addToFeePool(fee);
      
      await db.logTransaction(profile.id, 'buy', symbol, cryptoAmount, price, fee, euroAmount);

      tradeResult = { success: true, action: 'buy', crypto_amount: cryptoAmount, balance: newBalance };

      if (req.bot) {
        req.bot.api.sendMessage(profile.telegram_id, `🟢 <b>SPOT-KAUF</b>\n\n${cryptoAmount.toFixed(4)} ${symbol} gekauft für ${euroAmount.toLocaleString('de-DE')}€`, { parse_mode: 'HTML' }).catch(() => {});
      }
    } else if (action === 'sell') {
      // ===== VERKAUFS-LOGIK =====
      const cryptoAmount = Number(amount_crypto);
      if (!cryptoAmount || cryptoAmount <= 0) {
        return res.status(400).json({ error: 'Ungültige Verkaufsmenge' });
      }

      // Asset des Users laden
      const { data: asset } = await db.supabase
        .from('assets')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('symbol', symbol)
        .single();

      if (!asset || Number(asset.amount) < cryptoAmount - 0.000001) {
        return res.status(400).json({ error: 'Nicht genügend Coins zum Verkaufen' });
      }

      const grossEur = cryptoAmount * price;
      // v0.3.23: Spot Fee = 0.25%
      const fee = parseFloat((grossEur * (SPOT_FEE_RATE || 0.0025)).toFixed(2));
      const netEur = parseFloat((grossEur - fee).toFixed(2));
      const newBalance = parseFloat((Number(profile.balance) + netEur).toFixed(2));
      const newAmount = Number(asset.amount) - cryptoAmount;

      // Balance aktualisieren
      await db.updateBalance(profile.id, newBalance);

      // Asset aktualisieren oder löschen wenn 0
      if (newAmount <= 0.000001) {
        await db.supabase
          .from('assets')
          .delete()
          .eq('profile_id', profile.id)
          .eq('symbol', symbol);
      } else {
        await db.supabase
          .from('assets')
          .update({ amount: newAmount })
          .eq('profile_id', profile.id)
          .eq('symbol', symbol);
      }

      // Volumen tracken
      await db.addVolume(profile.id, grossEur);

      // Fee Pool
      if (db.addToFeePool) await db.addToFeePool(fee);

      // Transaktion loggen
      await db.logTransaction(profile.id, 'sell', symbol, cryptoAmount, price, fee, grossEur);

      tradeResult = { 
        success: true, 
        action: 'sell', 
        crypto_amount: cryptoAmount, 
        euro_received: netEur,
        total_eur: netEur,
        fee,
        balance: newBalance 
      };

      if (req.bot) {
        req.bot.api.sendMessage(
          profile.telegram_id, 
          `🔴 <b>SPOT-VERKAUF</b>\n\n${cryptoAmount.toFixed(4)} ${symbol} verkauft für ${netEur.toLocaleString('de-DE')}€\nGebühr: ${fee.toFixed(2)}€`, 
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    }
    
    // Achievement Check
    if (tradeResult && db.checkAndGrantAchievements) {
      const unlocked = await db.checkAndGrantAchievements(profile.id);
      tradeResult.new_achievements = unlocked;
    }

    // v0.3.30: Copy Trading — Kopierte Trades ausführen
    if (tradeResult && db.executeCopyTrades) {
      try {
        // Berechne den prozentualen Anteil des Trades am Gesamtvermögen
        const totalBalance = Number(profile.balance) + Number(amount_eur || 0);
        const tradePercentage = action === 'buy' 
          ? Number(amount_eur) / totalBalance
          : Number(amount_crypto) * price / (Number(profile.balance) + Number(amount_crypto) * price);
        
        const copyResults = await db.executeCopyTrades(profile.id, symbol, action, tradePercentage, price);
        
        if (copyResults.length > 0 && req.bot) {
          req.bot.api.sendMessage(profile.telegram_id,
            `📋 ${copyResults.length} Kopierer haben deinen ${action === 'buy' ? 'Kauf' : 'Verkauf'} nachgemacht.`,
            { parse_mode: 'HTML' }
          ).catch(() => {});
        }
      } catch (copyErr) {
        console.error('Copy Trade Error (non-fatal):', copyErr.message);
      }
    }

    res.json(tradeResult || { success: true });

  } catch (err) {
    console.error('Trade Error:', err);
    res.status(500).json({ error: 'Transaktion fehlgeschlagen' });
  }
});

module.exports = router;
