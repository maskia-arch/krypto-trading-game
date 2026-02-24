const fs = require('fs');
const path = require('path');
require('dotenv').config();

let VERSION = '0.3.0'; 
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

// v0.3.23: Getrennte Fee-Rates
const SPOT_FEE_RATE = 0.0025;      // 0.25% pro Spot-Trade (Kauf & Verkauf)
const LEVERAGE_FEE_RATE = 0.001;    // 0.1% pro Hebel-Trade (Eröffnung & Schließung)
const FEE_RATE = SPOT_FEE_RATE;     // Abwärtskompatibel

const TRADING_LIMITS = {
  FREE: {
    MAX_POSITIONS: 1,
    MARGIN_LIMIT_FACTOR: 0.50,
    MAX_LEVERAGE: 10,
    STANDARD_LEVERAGES: [2, 3, 5, 10],
    ZOCKER_LEVERAGES: [],
    ZOCKER_ENABLED: false
  },
  FREE_MONDAY: {
    MAX_POSITIONS: 1,
    MARGIN_LIMIT_FACTOR: 0.50,
    MAX_LEVERAGE: 50,
    STANDARD_LEVERAGES: [2, 3, 5, 10],
    ZOCKER_LEVERAGES: [20, 50],
    ZOCKER_ENABLED: true
  },
  PRO: {
    MAX_POSITIONS: 3,
    MARGIN_LIMIT_FACTOR: 0.90,
    MAX_LEVERAGE: 50,
    STANDARD_LEVERAGES: [2, 3, 5, 10],
    ZOCKER_LEVERAGES: [20, 50],
    ZOCKER_ENABLED: true
  }
};

// v0.3.24: Timezone-korrekte Tagabfrage (Europe/Berlin)
function isMondayBerlin() {
  const berlinDay = new Intl.DateTimeFormat('en-US', { 
    weekday: 'short', 
    timeZone: 'Europe/Berlin' 
  }).format(new Date());
  return berlinDay === 'Mon';
}

function getBerlinHour() {
  return Number(new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', hour12: false,
    timeZone: 'Europe/Berlin'
  }).format(new Date()));
}

module.exports = {
  VERSION,
  botConfig,
  ADMIN_ID,
  WEBAPP_URL,
  APP_LINK,
  BONUS_CLAIM_URL,
  supabaseConfig,
  COINS,
  FEE_RATE,
  SPOT_FEE_RATE,
  LEVERAGE_FEE_RATE,
  TRADING_LIMITS,
  isMondayBerlin,
  getBerlinHour
};
