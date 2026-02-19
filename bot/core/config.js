const fs = require('fs');
const path = require('path');
require('dotenv').config();

let VERSION = '0.1';
try {
  VERSION = fs.readFileSync(path.join(__dirname, '..', '..', 'version.txt'), 'utf8').trim();
} catch (e) {}

const botConfig = {
  token: process.env.BOT_TOKEN,
  port: process.env.PORT || 3000,
};

const ADMIN_ID = Number(process.env.ADMIN_ID);
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://your-webapp.vercel.app';
const BOT_USERNAME = process.env.BOT_USERNAME || 'YourBot';
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
