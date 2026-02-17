module.exports = (db) => ({
  async getAssets(profileId) {
    const { data } = await db.supabase
      .from('assets')
      .select('*')
      .eq('profile_id', profileId);
    return data || [];
  },

  async getAsset(profileId, symbol) {
    const { data } = await db.supabase
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
      await db.supabase
        .from('assets')
        .update({ amount: newAmount, avg_buy: newAvg })
        .eq('id', existing.id);
    } else {
      await db.supabase
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
    const { data } = await db.supabase
      .from('current_prices')
      .select('price_eur')
      .eq('symbol', symbol)
      .maybeSingle();
    return data ? Number(data.price_eur) : null;
  },

  async getAllPrices() {
    const { data } = await db.supabase
      .from('current_prices')
      .select('*');
    return data || [];
  }
});
