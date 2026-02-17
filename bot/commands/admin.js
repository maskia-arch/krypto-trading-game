const { InlineKeyboard } = require('grammy');
const { db } = require('../core/database');
const { esc } = require('../core/utils');
const { ADMIN_ID, VERSION } = require('../core/config');

async function dashboard(ctx) {
  if (ctx.from.id !== ADMIN_ID) return;

  try {
    const stats = await db.getStats();
    const pool = await db.getFeePool();
    const { count: deleteRequests } = await db.supabase
      .from('deletion_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const kb = new InlineKeyboard()
      .text('👥 Alle User', 'admin_users')
      .text('💰 Fee Pool', 'admin_pool')
      .row()
      .text(`⚠️ Löschanträge (${deleteRequests || 0})`, 'admin_deletions')
      .row()
      .text('🏆 Season starten', 'admin_new_season')
      .text('🎁 Season auswerten', 'admin_end_season')
      .row()
      .text('📊 Preis-Check', 'admin_prices')
      .text('🔄 Preise fetchen', 'admin_fetch');

    return ctx.reply(
      `🔧 <b>ADMIN DASHBOARD</b> (v${VERSION})\n\n` +
      `👥 User: ${stats.userCount}\n` +
      `📝 Transaktionen: ${stats.txCount}\n` +
      `💰 Fee Pool: ${pool.toLocaleString('de-DE', { minimumFractionDigits: 2 })}€\n\n` +
      `Letzte Aktualisierung: ${new Date().toLocaleString('de-DE')}`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  } catch (err) {
    ctx.reply('❌ Fehler beim Laden der Admin-Stats.');
  }
}

async function userInfo(ctx) {
  if (ctx.from.id !== ADMIN_ID) return;
  
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('Benutzung: /user <telegram_id>');

  const tgId = Number(args[1]);
  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return ctx.reply('User nicht gefunden.');

    const assets = await db.getAssets(profile.id);
    const assetsText = assets
      .filter(a => Number(a.amount) > 0)
      .map(a => `  ${a.symbol}: ${Number(a.amount).toFixed(6)}`)
      .join('\n') || '  (keine)';

    const lastActive = profile.last_active 
      ? new Date(profile.last_active).toLocaleString('de-DE') 
      : 'Nie';

    return ctx.reply(
      `👤 <b>User Info</b>\n\n` +
      `Name: ${esc(profile.first_name)}\n` +
      `Username: @${profile.username || '-'}\n` +
      `ID: <code>${profile.telegram_id}</code>\n` +
      `Balance: ${Number(profile.balance).toLocaleString('de-DE')}€\n` +
      `Umsatz: ${Number(profile.total_volume).toLocaleString('de-DE')}€\n` +
      `Pro: ${profile.is_pro ? '✅' : '❌'}\n` +
      `Letzte Aktivität: ${lastActive}\n` +
      `Registriert: ${new Date(profile.created_at).toLocaleDateString('de-DE')}\n\n` +
      `📦 Assets:\n${assetsText}`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    ctx.reply('❌ Fehler beim Abrufen der User-Daten.');
  }
}

async function setBalance(ctx) {
  if (ctx.from.id !== ADMIN_ID) return;
  
  const args = ctx.message.text.split(' ');
  if (args.length < 3) return ctx.reply('Benutzung: /setbalance <id> <betrag>');

  const tgId = Number(args[1]);
  const amount = Number(args[2]);

  try {
    const profile = await db.getProfile(tgId);
    if (!profile) return ctx.reply('User nicht gefunden.');

    await db.updateBalance(profile.id, amount);
    return ctx.reply(`✅ Balance von ${esc(profile.first_name)} auf ${amount.toLocaleString('de-DE')}€ gesetzt.`);
  } catch (err) {
    ctx.reply('❌ Fehler beim Setzen der Balance.');
  }
}

async function broadcast(ctx) {
  if (ctx.from.id !== ADMIN_ID) return;

  const text = ctx.message.text.replace('/broadcast ', '').trim();
  if (!text || text === '/broadcast') return ctx.reply('Benutzung: /broadcast <nachricht>');

  try {
    const { data: users } = await db.supabase.from('profiles').select('telegram_id');
    let sent = 0;

    for (const u of users) {
      try {
        await ctx.api.sendMessage(u.telegram_id, `📢 <b>Ankündigung</b>\n\n${text}`, { parse_mode: 'HTML' });
        sent++;
      } catch (e) {}
    }
    return ctx.reply(`✅ Nachricht an ${sent}/${users.length} User gesendet.`);
  } catch (err) {
    ctx.reply('❌ Broadcast fehlgeschlagen.');
  }
}

module.exports = {
  dashboard,
  userInfo,
  setBalance,
  broadcast
};
