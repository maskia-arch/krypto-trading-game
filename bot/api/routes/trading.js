const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { COINS, FEE_RATE } = require('../../core/config');

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
    const isMonday = new Date().getDay() === 1;
    const isPro = req.permissions.isPro;

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

// 3. Hebel-Trade eröffnen (inkl. Pro-Features)
router.post('/leverage/open', async (req, res) => {
  const { symbol, direction, collateral, leverage, stop_loss, take_profit, limit_price, trailing_stop } = req.body;

  try {
    const profile = await db.getProfile(req.tgId);
    const price = await db.getCurrentPrice(symbol);
    if (!price) return res.status(500).json({ error: 'Kurs nicht verfügbar' });

    const isPro = req.permissions.isPro;
    
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

      const fee = parseFloat((euroAmount * (FEE_RATE || 0.005)).toFixed(2));
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
      const fee = parseFloat((grossEur * (FEE_RATE || 0.005)).toFixed(2));
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

    res.json(tradeResult || { success: true });

  } catch (err) {
    console.error('Trade Error:', err);
    res.status(500).json({ error: 'Transaktion fehlgeschlagen' });
  }
});

module.exports = router;
