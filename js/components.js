/**
 * UI Components for trade.xyz Tracker
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

    card.innerHTML = `
    <div class="market-header">
      <div class="market-icon">${symbol.slice(0, 2)}</div>
      <div>
        <div class="market-name">${symbol}</div>
        <div class="market-symbol text-secondary">${getCategoryLabel(category)}</div>
      </div>
    </div>
    <div class="market-price" data-price="${price}">${HyperliquidAPI.formatPrice(price)}</div>
    <div>
      <span class="market-change neutral" data-change="0">—</span>
      <span class="market-leverage">${leverage}x</span>
    </div>
  `;

    card.addEventListener('click', () => {
        showMarketDetail(asset);
    });

    return card;
}

/**
 * Get category label
 */
function getCategoryLabel(category) {
    const labels = {
        equities: '📈 Action',
        commodities: '🏆 Commodité',
        forex: '💱 Forex',
        index: '📊 Index'
    };
    return labels[category] || category;
}

/**
 * Create a trade item for the feed
 */
function createTradeItem(trade) {
    const asset = trade.coin || trade.symbol;
    const symbol = asset.replace('xyz:', '');
    const isBuy = trade.side === 'B' || trade.side === 'buy';
    const time = trade.time ? new Date(trade.time) : new Date();

    const item = document.createElement('div');
    item.className = 'trade-item';

    item.innerHTML = `
    <div class="trade-time">${HyperliquidAPI.formatTime(time)}</div>
    <div class="trade-asset">
      <div class="trade-asset-icon">${symbol.slice(0, 2)}</div>
      <span>${symbol}</span>
    </div>
    <div class="trade-price">$${HyperliquidAPI.formatPrice(trade.px)}</div>
    <div class="trade-size">${parseFloat(trade.sz).toFixed(4)}</div>
    <div class="trade-side ${isBuy ? 'buy' : 'sell'}">${isBuy ? 'Achat' : 'Vente'}</div>
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
    <td class="${isBuy ? 'text-success' : 'text-danger'}">${isBuy ? 'ACHAT' : 'VENTE'}</td>
    <td>$${HyperliquidAPI.formatPrice(fill.px)}</td>
    <td>${parseFloat(fill.sz).toFixed(4)}</td>
    <td>$${HyperliquidAPI.formatPrice(fill.px * fill.sz)}</td>
  `;

    return row;
}

/**
 * Create stat card
 */
function createStatCard(value, label, icon = '') {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
    <div class="stat-value text-gradient">${icon}${value}</div>
    <div class="stat-label">${label}</div>
  `;
    return card;
}

/**
 * Create category tab
 */
function createCategoryTab(category, label, isActive = false) {
    const tab = document.createElement('button');
    tab.className = `category-tab${isActive ? ' active' : ''}`;
    tab.dataset.category = category;
    tab.textContent = label;
    return tab;
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
function showEmptyState(container, message = 'Aucune donnée disponible') {
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

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(isConnected) {
    const dot = document.querySelector('.status-dot');
    const text = document.querySelector('.connection-status span:last-child');

    if (dot) {
        dot.classList.toggle('connected', isConnected);
    }
    if (text) {
        text.textContent = isConnected ? 'En direct' : 'Déconnecté';
    }
}

/**
 * Format price with change animation
 */
function updatePriceElement(element, newPrice, oldPrice) {
    element.textContent = `$${HyperliquidAPI.formatPrice(newPrice)}`;
    element.dataset.price = newPrice;

    if (oldPrice) {
        const isUp = newPrice > oldPrice;
        const isDown = newPrice < oldPrice;

        element.classList.remove('price-up', 'price-down');

        if (isUp) {
            element.classList.add('price-up');
        } else if (isDown) {
            element.classList.add('price-down');
        }
    }
}

/**
 * Show market detail modal
 */
function showMarketDetail(asset) {
    // For now, just log - could implement modal later
    console.log('Show detail for:', asset);
    showToast(`Détails de ${asset.replace('xyz:', '')} - Coming soon!`);
}

// Export components
window.Components = {
    createMarketCard,
    createTradeItem,
    createFillRow,
    createStatCard,
    createCategoryTab,
    showLoading,
    showEmptyState,
    showToast,
    updateConnectionStatus,
    updatePriceElement,
    showMarketDetail,
    getCategoryLabel
};
