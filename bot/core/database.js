const { createClient } = require('@supabase/supabase-js');
const { supabaseConfig } = require('./config');

const supabase = createClient(supabaseConfig.url, supabaseConfig.key);

const db = {
  supabase,

  async getProfile(telegramId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();
    
    if (data) {
      await supabase
        .from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('id', data.id);
    }
    return data;
  },

  async isUsernameTaken(username) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    return !!data;
  },

  async createProfile(telegramId, username, firstName) {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        telegram_id: telegramId,
        username: username || null,
        first_name: firstName || 'Trader',
        balance: 10000.00,
        feedback_sent: false,
        story_bonus_claimed: false,
        last_active: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateUsername(profileId, newUsername, isPro) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username_changes, is_pro')
      .eq('id', profileId)
      .single();

    const canChange = isPro ? true : (profile.username_changes < 1);
    if (!canChange) throw new Error('Namensänderung bereits verbraucht.');

    const taken = await this.isUsernameTaken(newUsername);
    if (taken) throw new Error('Dieser Username ist bereits vergeben.');

    const { error } = await supabase
      .from('profiles')
      .update({ 
        username: newUsername, 
        username_changes: profile.username_changes + 1,
        last_name_change: new Date().toISOString()
      })
      .eq('id', profileId);
    
    if (error) throw error;
    return true;
  },

  async requestAccountDeletion(profileId) {
    await supabase.from('deletion_requests').insert({
      profile_id: profileId,
      status: 'pending',
      requested_at: new Date().toISOString()
    });
  },

  async deleteUserCompletely(profileId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_id')
      .eq('id', profileId)
      .single();

    await supabase.from('assets').delete().eq('profile_id', profileId);
    await supabase.from('transactions').delete().eq('profile_id', profileId);
    await supabase.from('real_estate').delete().eq('profile_id', profileId);
    await supabase.from('collectibles').delete().eq('profile_id', profileId);
    await supabase.from('pro_requests').delete().eq('profile_id', profileId);
    await supabase.from('deletion_requests').delete().eq('profile_id', profileId);
    
    const { error } = await supabase.from('profiles').delete().eq('id', profileId);
    
    return { success: !error, telegramId: profile?.telegram_id };
  },

  async updateBalance(profileId, newBalance) {
    await supabase
      .from('profiles')
      .update({ balance: newBalance, last_active: new Date().toISOString() })
      .eq('id', profileId);
  },

  async addVolume(profileId, amount) {
    const { data: p } = await supabase
      .from('profiles')
      .select('total_volume')
      .eq('id', profileId)
      .single();
    await supabase
      .from('profiles')
      .update({ 
        total_volume: Number(p.total_volume || 0) + amount,
        last_active: new Date().toISOString()
      })
      .eq('id', profileId);
  },

  async getAssets(profileId) {
    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('profile_id', profileId);
    return data || [];
  },

  async getAsset(profileId, symbol) {
    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('profile_id', profileId)
      .eq('symbol', symbol)
      .maybeSingle();
    return data;
  },

  async upsertAsset(profileId, symbol, amount, avgBuy) {
    const existing = await db.getAsset(profileId, symbol);
    if (existing) {
      const newAmount = Number(existing.amount) + amount;
      const newAvg = amount > 0
        ? ((Number(existing.amount) * Number(existing.avg_buy)) + (amount * avgBuy)) / newAmount
        : existing.avg_buy;
      await supabase
        .from('assets')
        .update({ amount: newAmount, avg_buy: newAvg })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('assets')
        .insert({
          profile_id: profileId,
          symbol,
          amount,
          avg_buy: avgBuy,
          first_buy: new Date().toISOString()
        });
    }
  },

  async getCurrentPrice(symbol) {
    const { data } = await supabase
      .from('current_prices')
      .select('price_eur')
      .eq('symbol', symbol)
      .maybeSingle();
    return data ? Number(data.price_eur) : null;
  },

  async getAllPrices() {
    const { data } = await supabase
      .from('current_prices')
      .select('*');
    return data || [];
  },

  async logTransaction(profileId, type, symbol, amount, priceEur, feeEur, totalEur) {
    await supabase.from('transactions').insert({
      profile_id: profileId,
      type, symbol, amount,
      price_eur: priceEur,
      fee_eur: feeEur,
      total_eur: totalEur
    });
  },

  async addToFeePool(amount) {
    const { data } = await supabase.from('fee_pool').select('total_eur').eq('id', 1).maybeSingle();
    const currentPool = data ? Number(data.total_eur) : 0;
    await supabase
      .from('fee_pool')
      .update({ total_eur: currentPool + amount })
      .eq('id', 1);
  },

  async getFeePool() {
    const { data } = await supabase.from('fee_pool').select('total_eur').eq('id', 1).maybeSingle();
    return Number(data?.total_eur || 0);
  },

  async getLeaderboard(limit = 20) {
    const [ { data: profiles }, { data: assets }, { data: prices } ] = await Promise.all([
      supabase.from('profiles').select('id, username, first_name, balance, total_volume, telegram_id'),
      supabase.from('assets').select('profile_id, symbol, amount'),
      supabase.from('current_prices').select('symbol, price_eur')
    ]);

    const priceMap = {};
    (prices || []).forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    const userAssets = {};
    (assets || []).forEach(a => {
      if (!userAssets[a.profile_id]) userAssets[a.profile_id] = [];
      userAssets[a.profile_id].push(a);
    });

    const leaders = (profiles || []).map(p => {
      let cryptoValue = 0;
      if (userAssets[p.id]) {
        userAssets[p.id].forEach(asset => {
          const currentPrice = priceMap[asset.symbol] || 0;
          cryptoValue += Number(asset.amount) * currentPrice;
        });
      }
      return {
        ...p,
        net_worth: Number(p.balance) + cryptoValue
      };
    });

    leaders.sort((a, b) => b.net_worth - a.net_worth);
    return leaders.slice(0, limit);
  },

  async getActiveSeason() {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
    return data;
  },

  async createProRequest(profileId) {
    await supabase.from('pro_requests').insert({ profile_id: profileId });
  },

  async approveProRequestForUser(profileId) {
    const proUntil = new Date();
    proUntil.setDate(proUntil.getDate() + 30);
    const { error } = await supabase
      .from('profiles')
      .update({ is_pro: true, pro_until: proUntil.toISOString() })
      .eq('id', profileId);
    
    if (!error) {
      await supabase.from('pro_requests').update({ status: 'approved' }).eq('profile_id', profileId);
      return true;
    }
    return false;
  },

  async getRealEstateTypes() {
    const { data } = await supabase.from('real_estate_types').select('*').order('price_eur');
    return data || [];
  },

  async getUserRealEstate(profileId) {
    const { data } = await supabase
      .from('real_estate')
      .select('*, real_estate_types(*)')
      .eq('profile_id', profileId);
    return data || [];
  },

  async collectRent(profileId) {
    const properties = await db.getUserRealEstate(profileId);
    let totalRent = 0;
    const now = new Date();

    for (const prop of properties) {
      const last = new Date(prop.last_collect);
      const hoursElapsed = (now - last) / 1000 / 60 / 60;
      if (hoursElapsed >= 24) {
        const days = Math.floor(hoursElapsed / 24);
        const rent = days * Number(prop.real_estate_types.daily_rent);
        totalRent += rent;
        await supabase.from('real_estate')
          .update({ last_collect: now.toISOString() })
          .eq('id', prop.id);
      }
    }

    if (totalRent > 0) {
      const { data: p } = await supabase.from('profiles')
        .select('balance').eq('id', profileId).single();
      await supabase.from('profiles')
        .update({ balance: Number(p.balance) + totalRent })
        .eq('id', profileId);
      await db.logTransaction(profileId, 'rent', null, null, null, 0, totalRent);
    }
    return totalRent;
  },

  async processBailout(profileId) {
    const { data: p } = await supabase
      .from('profiles')
      .select('balance, bailout_count, bailout_last')
      .eq('id', profileId)
      .single();

    if (Number(p.balance) > 50) return { ok: false, msg: 'Du bist nicht bankrott!' };

    const count = p.bailout_count || 0;

    if (count < 3) {
      const newBal = Number(p.balance) + 1000;
      await supabase.from('profiles').update({
        balance: newBal,
        bailout_count: count + 1,
        bailout_last: new Date().toISOString()
      }).eq('id', profileId);
      await db.logTransaction(profileId, 'bailout', null, null, null, 0, 1000);
      return { ok: true, msg: `💰 Onkel hat dir 1.000€ geschickt! (${2 - count} Rettungen übrig)` };
    } else {
      if (p.bailout_last) {
        const last = new Date(p.bailout_last);
        const diff = (Date.now() - last.getTime()) / 1000 / 60;
        if (diff < 30) {
          const wait = Math.ceil(30 - diff);
          return { ok: false, msg: `⏳ Onkel braucht noch ${wait} Minuten...` };
        }
      }
      const newBal = Math.min(Number(p.balance) + 50, 500);
      await supabase.from('profiles').update({
        balance: newBal,
        bailout_last: new Date().toISOString()
      }).eq('id', profileId);
      await db.logTransaction(profileId, 'bailout', null, null, null, 0, 50);
      return { ok: true, msg: `💸 Onkel schickt dir 50€ Taschengeld. (Max 500€)` };
    }
  },

  async getStats() {
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
    return { userCount: userCount || 0, txCount: txCount || 0 };
  }
};

module.exports = { db };
