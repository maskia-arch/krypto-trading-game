const fs = require('fs');
const path = require('path');
require('dotenv').config();

let VERSION = '0.2.2'; 
try {
  const versionPath = path.resolve(__dirname, '../../version.txt');
  if (fs.existsSync(versionPath)) {
    VERSION = fs.readFileSync(versionPath, 'utf8').trim();
  }
} catch (e) {
  console.error("Fehler beim Lesen der version.txt:", e.message);
}

const botConfig = {
  token: process.env.BOT_TOKEN,
  port: process.env.PORT || 3000,
};

const ADMIN_ID = Number(process.env.ADMIN_ID);
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://your-webapp.vercel.app';
const BOT_USERNAME = process.env.BOT_USERNAME || 'ValueTradeGameBot';
const APP_SHORTNAME = process.env.APP_SHORTNAME || 'app';

const APP_LINK = `https://t.me/${BOT_USERNAME}/${APP_SHORTNAME}`;
const BONUS_CLAIM_URL = `${APP_LINK}?startapp=claim_bonus`;

const supabaseConfig = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_KEY,
  bucketAvatars: 'avatars',
};

const COINS = {
  BTC: { name: 'Bitcoin',  gecko: 'bitcoin',  emoji: '₿' },
  ETH: { name: 'Ethereum', gecko: 'ethereum', emoji: 'Ξ' },
  LTC: { name: 'Litecoin', gecko: 'litecoin', emoji: 'Ł' }
};

const FEE_RATE = 0.005;

module.exports = {
  VERSION,
  botConfig,
  ADMIN_ID,
  WEBAPP_URL,
  APP_LINK,
  BONUS_CLAIM_URL,
  supabaseConfig,
  COINS,
  FEE_RATE
};
