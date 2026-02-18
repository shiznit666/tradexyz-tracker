/**
 * UI Components for trade.xyz Tracker — v2.0 Premium
 */

/**
 * Create a market card element
 */
function createMarketCard(asset, price, meta) {
  const symbol = asset.replace('xyz:', '');
  const category = HyperliquidAPI.getAssetCategory(asset);
  const leverage = meta?.maxLeverage || 10;

  const card = document.createElement('div');
  card.className = 'market-card';
  card.dataset.asset = asset;
  card.dataset.category = category;

  const categoryBadgeLabel = {
    equities: 'Stock',
    commodities: 'Commodity',
    forex: 'Forex',
    index: 'Index'
  }[category] || category;

  card.innerHTML = `
    <div class="market-header">
      <div class="market-icon">${symbol.slice(0, 3)}</div>
      <div>
        <div class="market-name">${symbol}</div>
        <div class="market-symbol text-secondary">${getCategoryLabel(category)}</div>
      </div>
    </div>
    <div class="market-price" data-price="${price}">${HyperliquidAPI.formatPrice(price)}</div>
    <div class="market-footer">
      <span class="market-change neutral" data-change="0">—</span>
      <span class="market-leverage">${leverage}x</span>
      <span class="market-category-badge ${category}">${categoryBadgeLabel}</span>
    </div>
  `;

  card.addEventListener('click', () => {
    showMarketDetail(asset);
  });

  return card;
}

/**
 * Get category label (with icon)
 */
function getCategoryLabel(category) {
  const icons = {
    equities:    '📈',
    commodities: '🏆',
    forex:       '💱',
    index:       '📊'
  };
  const labels = {
    equities:    window.i18n ? i18n.t('equities')    : 'Stock',
    commodities: window.i18n ? i18n.t('commodities') : 'Commodity',
    forex:       'Forex',
    index:       'Index'
  };
  return `${icons[category] || ''} ${labels[category] || category}`;
}

/**
 * Create a trade item for the live feed
 */
function createTradeItem(trade) {
  const asset = trade.coin || trade.symbol;
  const symbol = asset.replace('xyz:', '');
  const isBuy = trade.side === 'B' || trade.side === 'buy';
  const time = trade.time ? new Date(trade.time) : new Date();

  const item = document.createElement('div');
  item.className = `trade-item ${isBuy ? 'buy-row' : 'sell-row'}`;

  const buyLabel  = window.i18n ? i18n.t('buy')  : 'Buy';
  const sellLabel = window.i18n ? i18n.t('sell') : 'Sell';

  item.innerHTML = `
    <div class="trade-time">${HyperliquidAPI.formatTime(time)}</div>
    <div class="trade-asset">
      <div class="trade-asset-icon">${symbol.slice(0, 2)}</div>
      <span class="trade-asset-name">${symbol}</span>
    </div>
    <div class="trade-price">$${HyperliquidAPI.formatPrice(trade.px)}</div>
    <div class="trade-size">${parseFloat(trade.sz).toFixed(4)}</div>
    <div class="trade-side ${isBuy ? 'buy' : 'sell'}">${isBuy ? buyLabel : sellLabel}</div>
  `;

  return item;
}

/**
 * Create fill row for user fills table
 */
function createFillRow(fill) {
  const asset = fill.coin || '';
  const symbol = asset.replace('xyz:', '');
  const isBuy = fill.side === 'B' || fill.side === 'buy';
  const time = fill.time ? new Date(fill.time) : new Date();

  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${HyperliquidAPI.formatDate(time)} ${HyperliquidAPI.formatTime(time)}</td>
    <td>${symbol}</td>
    <td class="${isBuy ? 'text-success' : 'text-danger'}">${isBuy ? 'BUY' : 'SELL'}</td>
    <td>$${HyperliquidAPI.formatPrice(fill.px)}</td>
    <td>${parseFloat(fill.sz).toFixed(4)}</td>
    <td>$${HyperliquidAPI.formatPrice(fill.px * fill.sz)}</td>
  `;

  return row;
}

/**
 * Show loading spinner
 */
function showLoading(container) {
  container.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
    </div>
  `;
}

/**
 * Show empty state
 */
function showEmptyState(container, message = 'No data available') {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📭</div>
      <p>${message}</p>
    </div>
  `;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(isConnected) {
  const dot  = document.querySelector('.status-dot');
  const text = document.getElementById('connectionText');

  if (dot)  dot.classList.toggle('connected', isConnected);
  if (text) text.textContent = isConnected
    ? (window.i18n ? i18n.t('connected')    : 'Live')
    : (window.i18n ? i18n.t('disconnected') : 'Disconnected');
}

/**
 * Format price with change animation
 */
function updatePriceElement(element, newPrice, oldPrice) {
  element.textContent = `$${HyperliquidAPI.formatPrice(newPrice)}`;
  element.dataset.price = newPrice;

  if (oldPrice) {
    element.classList.remove('price-up', 'price-down');
    if (newPrice > oldPrice)      element.classList.add('price-up');
    else if (newPrice < oldPrice) element.classList.add('price-down');
  }
}

/**
 * Show market detail (placeholder)
 */
function showMarketDetail(asset) {
  showToast(`${asset.replace('xyz:', '')} — Coming soon!`);
}

/**
 * Animate count-up for a numeric element
 */
function animateCountUp(element, targetValue, duration = 800) {
  const start = performance.now();
  const isNumeric = !isNaN(parseFloat(targetValue));
  if (!isNumeric) return; // Skip non-numeric values like "74K+" or "Yes"

  const target = parseFloat(targetValue);
  const startVal = 0;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startVal + (target - startVal) * eased);
    element.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
    else element.textContent = target.toLocaleString();
  }

  requestAnimationFrame(update);
}

/**
 * Initialize ticker bar with market data
 */
function initTickerBar(markets) {
  const track = document.getElementById('tickerTrack');
  if (!track || !markets || Object.keys(markets).length === 0) return;

  const items = Object.entries(markets)
    .filter(([, m]) => !m.isDelisted)
    .slice(0, 20)
    .map(([asset, m]) => {
      const symbol = asset.replace('xyz:', '');
      const price = m.price || 0;
      const change = m.change24h || 0;
      const isUp = change >= 0;
      return `
        <div class="ticker-item">
          <span class="ticker-symbol">${symbol}</span>
          <span class="ticker-price">$${HyperliquidAPI.formatPrice(price)}</span>
          <span class="ticker-change ${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${change.toFixed(2)}%</span>
        </div>
      `;
    }).join('');

  // Duplicate for seamless loop
  track.innerHTML = items + items;
}

// Export
window.Components = {
  createMarketCard,
  createTradeItem,
  createFillRow,
  showLoading,
  showEmptyState,
  showToast,
  updateConnectionStatus,
  updatePriceElement,
  showMarketDetail,
  getCategoryLabel,
  animateCountUp,
  initTickerBar
};
