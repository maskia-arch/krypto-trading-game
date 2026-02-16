function parseTelegramUser(req) {
  const tgId = req.headers['x-telegram-id'] || req.query.telegram_id;
  return tgId ? Number(tgId) : null;
}

module.exports = { parseTelegramUser };
