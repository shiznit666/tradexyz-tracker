/**
 * Hyperliquid API Integration for trade.xyz
 * REST and WebSocket API wrapper
 * 
 * Markets are loaded dynamically from the API - no hardcoded lists!
 */

const API_BASE = 'https://api.hyperliquid.xyz';
const DEX_NAME = 'xyz';

// Dynamic market categories - populated from API
let MARKET_CATEGORIES = {
  equities: [],
  commodities: [],
  forex: [],
  index: [],
  other: []
};

// Known category mappings for auto-classification
const CATEGORY_KEYWORDS = {
  index: ['100', 'INDEX', 'IDX'],
  commodities: ['GOLD', 'SILVER', 'COPPER', 'CL', 'OIL', 'GAS', 'PLATINUM', 'PALLADIUM'],
  forex: ['EUR', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD', 'CNY', 'CNH']
};

// All known xyz markets (populated dynamically)
let ALL_XYZ_MARKETS = new Set();

/**
 * Auto-classify an asset into a category based on name
 */
function classifyAsset(symbol) {
  const cleanSymbol = symbol.replace(`${DEX_NAME}:`, '').toUpperCase();

  // Check index first
  for (const keyword of CATEGORY_KEYWORDS.index) {
    if (cleanSymbol.includes(keyword)) return 'index';
  }

  // Check commodities
  for (const keyword of CATEGORY_KEYWORDS.commodities) {
    if (cleanSymbol === keyword || cleanSymbol.includes(keyword)) return 'commodities';
  }

  // Check forex
  for (const keyword of CATEGORY_KEYWORDS.forex) {
    if (cleanSymbol === keyword) return 'forex';
  }

  // Default to equities (stocks)
  return 'equities';
}

/**
 * Update market categories from API data
 */
function updateMarketCategories(markets) {
  // Reset categories
  MARKET_CATEGORIES = {
    equities: [],
    commodities: [],
    forex: [],
    index: [],
    other: []
  };

  ALL_XYZ_MARKETS.clear();

  markets.forEach(market => {
    if (market.isDelisted) return;

    const name = market.name;
    const cleanName = name.replace(`${DEX_NAME}:`, '');

    ALL_XYZ_MARKETS.add(name);

    const category = classifyAsset(name);
    if (MARKET_CATEGORIES[category]) {
      MARKET_CATEGORIES[category].push(cleanName);
    }
  });

  console.log('Updated market categories:', MARKET_CATEGORIES);
  console.log('Total xyz markets:', ALL_XYZ_MARKETS.size);
}

// Get full asset name with dex prefix
function getFullAssetName(symbol) {
  return `${DEX_NAME}:${symbol}`;
}

// Get category for an asset
function getAssetCategory(symbol) {
  const cleanSymbol = symbol.replace(`${DEX_NAME}:`, '');
  for (const [category, assets] of Object.entries(MARKET_CATEGORIES)) {
    if (assets.includes(cleanSymbol)) {
      return category;
    }
  }
  // Try auto-classification for new assets
  return classifyAsset(symbol);
}

// Get friendly category name
function getCategoryName(category) {
  const names = {
    equities: 'Équités',
    commodities: 'Matières Premières',
    forex: 'Forex',
    index: 'Indices',
    all: 'Tout',
    other: 'Autre'
  };
  return names[category] || category;
}

/**
 * Get all xyz market names for WebSocket subscriptions
 */
function getAllXyzMarkets() {
  return Array.from(ALL_XYZ_MARKETS);
}

/**
 * Make a POST request to the Hyperliquid info API
 */
async function apiRequest(body) {
  try {
    const response = await fetch(`${API_BASE}/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

/**
 * Get market metadata for xyz DEX
 */
async function getMarketMeta() {
  return await apiRequest({
    type: 'meta',
    dex: DEX_NAME
  });
}

/**
 * Get all current mid prices
 */
async function getAllMids() {
  return await apiRequest({
    type: 'allMids',
    dex: DEX_NAME
  });
}

/**
 * Get user's trade fills
 */
async function getUserFills(userAddress, aggregateByTime = true) {
  return await apiRequest({
    type: 'userFills',
    user: userAddress,
    aggregateByTime
  });
}

/**
 * Get user's fills by time range
 */
async function getUserFillsByTime(userAddress, startTime, endTime = null) {
  const body = {
    type: 'userFillsByTime',
    user: userAddress,
    startTime: startTime,
    aggregateByTime: true
  };

  if (endTime) {
    body.endTime = endTime;
  }

  return await apiRequest(body);
}

/**
 * Get user's open orders
 */
async function getUserOpenOrders(userAddress) {
  return await apiRequest({
    type: 'openOrders',
    user: userAddress,
    dex: DEX_NAME
  });
}

/**
 * Get user's clearinghouse state (account value, positions, PNL)
 */
async function getUserState(userAddress) {
  return await apiRequest({
    type: 'clearinghouseState',
    user: userAddress
  });
}

/**
 * Calculate PNL from user fills
 * Returns realized PNL by analyzing buy/sell fills
 */
function calculatePNLFromFills(fills) {
  const pnlByAsset = {};
  let totalRealizedPnl = 0;
  let totalVolume = 0;
  let totalTrades = 0;

  // Filter to xyz fills only
  const xyzFills = fills.filter(f => f.coin && f.coin.startsWith('xyz:'));

  xyzFills.forEach(fill => {
    const asset = fill.coin;
    const price = parseFloat(fill.px);
    const size = parseFloat(fill.sz);
    const isBuy = fill.side === 'B' || fill.side === 'buy';
    const value = price * size;

    if (!pnlByAsset[asset]) {
      pnlByAsset[asset] = {
        buys: [],
        sells: [],
        realizedPnl: 0,
        volume: 0,
        trades: 0
      };
    }

    pnlByAsset[asset].volume += value;
    pnlByAsset[asset].trades += 1;
    totalVolume += value;
    totalTrades += 1;

    if (isBuy) {
      pnlByAsset[asset].buys.push({ price, size, value });
    } else {
      pnlByAsset[asset].sells.push({ price, size, value });
    }
  });

  // Calculate realized PNL using FIFO method
  Object.keys(pnlByAsset).forEach(asset => {
    const data = pnlByAsset[asset];
    const buys = [...data.buys];
    const sells = [...data.sells];

    let realizedPnl = 0;

    sells.forEach(sell => {
      let remainingSellSize = sell.size;

      while (remainingSellSize > 0 && buys.length > 0) {
        const buy = buys[0];
        const matchSize = Math.min(remainingSellSize, buy.size);

        // PNL = (sell price - buy price) * matched size
        realizedPnl += (sell.price - buy.price) * matchSize;

        remainingSellSize -= matchSize;
        buy.size -= matchSize;

        if (buy.size <= 0) {
          buys.shift();
        }
      }
    });

    pnlByAsset[asset].realizedPnl = realizedPnl;
    totalRealizedPnl += realizedPnl;
  });

  return {
    byAsset: pnlByAsset,
    totalRealizedPnl,
    totalVolume,
    totalTrades
  };
}

/**
 * Get L2 order book snapshot
 */
async function getL2Book(coin) {
  return await apiRequest({
    type: 'l2Book',
    coin: getFullAssetName(coin)
  });
}

/**
 * Get candle snapshot for charts
 */
async function getCandles(coin, interval = '1h', startTime = null) {
  const body = {
    type: 'candleSnapshot',
    req: {
      coin: getFullAssetName(coin),
      interval: interval,
      startTime: startTime || Date.now() - 24 * 60 * 60 * 1000 // Default 24h
    }
  };

  return await apiRequest(body);
}

/**
 * Format price for display
 */
function formatPrice(price, decimals = 2) {
  const num = parseFloat(price);
  if (isNaN(num)) return '—';

  if (num >= 1000) {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  return num.toFixed(decimals);
}

/**
 * Format large numbers
 */
function formatNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

/**
 * Format timestamp
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Format date
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Validate Ethereum address
 */
function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Truncate address for display
 */
function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get full market metadata with asset contexts (prices, funding, OI, etc.)
 * This is the enhanced API call that returns HIP-3 analytics data
 */
async function getMetaAndAssetCtxs() {
  return await apiRequest({
    type: 'metaAndAssetCtxs',
    dex: DEX_NAME
  });
}

/**
 * Get perp funding history for a coin
 */
async function getFundingHistory(coin, startTime = null) {
  const body = {
    type: 'fundingHistory',
    coin: getFullAssetName(coin),
    startTime: startTime || Date.now() - 7 * 24 * 60 * 60 * 1000 // Default 7 days
  };
  return await apiRequest(body);
}

/**
 * Format funding rate as percentage (annualized hourly rate)
 */
function formatFundingRate(funding) {
  const rate = parseFloat(funding);
  if (isNaN(rate)) return '—';
  // Funding is hourly rate, display as percentage
  const pct = rate * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(4)}%`;
}

/**
 * Format premium as percentage
 */
function formatPremium(premium) {
  const prem = parseFloat(premium);
  if (isNaN(prem)) return '—';
  const pct = prem * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(3)}%`;
}

/**
 * Format 24h change as percentage
 */
function format24hChange(currentPrice, prevDayPrice) {
  const curr = parseFloat(currentPrice);
  const prev = parseFloat(prevDayPrice);
  if (isNaN(curr) || isNaN(prev) || prev === 0) return { value: 0, formatted: '—' };

  const change = ((curr - prev) / prev) * 100;
  const sign = change >= 0 ? '+' : '';
  return {
    value: change,
    formatted: `${sign}${change.toFixed(2)}%`
  };
}

/**
 * Format open interest in USD
 */
function formatOpenInterest(oi, price) {
  const openInterest = parseFloat(oi);
  const markPrice = parseFloat(price);
  if (isNaN(openInterest) || isNaN(markPrice)) return '—';

  const oiUsd = openInterest * markPrice;
  return '$' + formatNumber(oiUsd);
}

/**
 * Process raw API data into HIP-3 analytics format
 */
function processHip3Analytics(metaAndCtxs) {
  if (!metaAndCtxs || !Array.isArray(metaAndCtxs) || metaAndCtxs.length < 2) {
    return [];
  }

  const universe = metaAndCtxs[0]?.universe || [];
  const assetCtxs = metaAndCtxs[1] || [];

  const analytics = [];

  for (let i = 0; i < universe.length; i++) {
    const market = universe[i];
    const ctx = assetCtxs[i];

    if (!market || !ctx || market.isDelisted) continue;

    const name = market.name;
    const markPrice = parseFloat(ctx.markPx || 0);
    const prevDayPrice = parseFloat(ctx.prevDayPx || markPrice);
    const funding = parseFloat(ctx.funding || 0);
    const openInterest = parseFloat(ctx.openInterest || 0);
    const premium = parseFloat(ctx.premium || 0);
    const dayVolume = parseFloat(ctx.dayNtlVlm || 0);

    const change24h = format24hChange(markPrice, prevDayPrice);

    analytics.push({
      name: name.replace(`${DEX_NAME}:`, ''),
      fullName: name,
      category: classifyAsset(name),
      markPrice,
      prevDayPrice,
      change24h: change24h.value,
      change24hFormatted: change24h.formatted,
      funding,
      fundingFormatted: formatFundingRate(funding),
      openInterest,
      openInterestUsd: openInterest * markPrice,
      openInterestFormatted: formatOpenInterest(openInterest, markPrice),
      premium,
      premiumFormatted: formatPremium(premium),
      volume24h: dayVolume,
      volume24hFormatted: '$' + formatNumber(dayVolume),
      maxLeverage: market.maxLeverage || 10
    });
  }

  // Sort by volume (highest first)
  analytics.sort((a, b) => b.volume24h - a.volume24h);

  return analytics;
}

// Export functions
window.HyperliquidAPI = {
  getMarketMeta,
  getAllMids,
  getMetaAndAssetCtxs,
  getFundingHistory,
  getUserFills,
  getUserFillsByTime,
  getUserOpenOrders,
  getUserState,
  calculatePNLFromFills,
  getL2Book,
  getCandles,
  getFullAssetName,
  getAssetCategory,
  getCategoryName,
  updateMarketCategories,
  getAllXyzMarkets,
  classifyAsset,
  formatPrice,
  formatNumber,
  formatTime,
  formatDate,
  formatFundingRate,
  formatPremium,
  format24hChange,
  formatOpenInterest,
  processHip3Analytics,
  isValidAddress,
  truncateAddress,
  MARKET_CATEGORIES,
  DEX_NAME
};

