/**
 * Main Application - trade.xyz Transaction Tracker
 */

// Application state
const state = {
    markets: {},
    prices: {},
    meta: null,
    trades: [],
    userFills: [],
    currentCategory: 'all',
    searchQuery: '',
    walletAddress: ''
};

// Maximum trades to keep in feed
const MAX_TRADES = 100;

/**
 * Initialize the application
 */
async function init() {
    console.log('Initializing trade.xyz Tracker...');

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    await loadMarketData();

    // Connect WebSocket for real-time data
    connectWebSocket();

    // Start price refresh interval
    startPriceRefresh();

    console.log('Application initialized!');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.toLowerCase();
            filterMarkets();
        });
    }

    // Category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            state.currentCategory = e.target.dataset.category;
            filterMarkets();
        });
    });

    // Wallet lookup form
    const walletForm = document.getElementById('walletForm');
    if (walletForm) {
        walletForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('walletInput');
            if (input && input.value) {
                await lookupWallet(input.value.trim());
            }
        });
    }
}

/**
 * Load initial market data
 */
async function loadMarketData() {
    const marketsGrid = document.getElementById('marketsGrid');
    if (marketsGrid) {
        Components.showLoading(marketsGrid);
    }

    try {
        // Fetch meta and prices in parallel
        const [meta, prices] = await Promise.all([
            HyperliquidAPI.getMarketMeta(),
            HyperliquidAPI.getAllMids()
        ]);

        state.meta = meta;
        state.prices = prices;

        // Update dynamic market categories from API data
        if (meta && meta.universe) {
            HyperliquidAPI.updateMarketCategories(meta.universe);

            meta.universe.forEach(market => {
                if (!market.isDelisted) {
                    state.markets[market.name] = {
                        ...market,
                        price: prices[market.name] || 0
                    };
                }
            });
        }

        // Render markets
        renderMarkets();
        updateStats();

    } catch (error) {
        console.error('Failed to load market data:', error);
        if (marketsGrid) {
            Components.showEmptyState(marketsGrid, 'Erreur de chargement des données');
        }
        Components.showToast('Erreur de connexion à l\'API', 'error');
    }
}

/**
 * Render markets grid
 */
function renderMarkets() {
    const marketsGrid = document.getElementById('marketsGrid');
    if (!marketsGrid) return;

    marketsGrid.innerHTML = '';

    const markets = Object.entries(state.markets)
        .filter(([name, market]) => !market.isDelisted)
        .sort((a, b) => {
            // Sort by category priority, then alphabetically
            const catOrder = { index: 0, equities: 1, commodities: 2, forex: 3 };
            const catA = HyperliquidAPI.getAssetCategory(a[0]);
            const catB = HyperliquidAPI.getAssetCategory(b[0]);

            if (catOrder[catA] !== catOrder[catB]) {
                return (catOrder[catA] || 99) - (catOrder[catB] || 99);
            }
            return a[0].localeCompare(b[0]);
        });

    markets.forEach(([name, market]) => {
        const card = Components.createMarketCard(
            name,
            state.prices[name] || 0,
            market
        );
        marketsGrid.appendChild(card);
    });

    filterMarkets();
}

/**
 * Filter markets based on category and search
 */
function filterMarkets() {
    const cards = document.querySelectorAll('.market-card');

    cards.forEach(card => {
        const asset = card.dataset.asset;
        const category = card.dataset.category;
        const symbol = asset.replace('xyz:', '').toLowerCase();

        const matchesCategory = state.currentCategory === 'all' || category === state.currentCategory;
        const matchesSearch = !state.searchQuery || symbol.includes(state.searchQuery);

        card.style.display = matchesCategory && matchesSearch ? 'block' : 'none';
    });
}

/**
 * Update stats display
 */
function updateStats() {
    const activeMarkets = Object.values(state.markets).filter(m => !m.isDelisted).length;

    // Update stat values if elements exist
    const statElements = {
        'statMarkets': activeMarkets,
        'statTrades': state.trades.length,
        'statConnected': wsManager.getStatus() ? 'Oui' : 'Non'
    };

    Object.entries(statElements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    });
}

/**
 * Connect WebSocket and setup handlers
 */
function connectWebSocket() {
    // Connection status
    wsManager.onConnect(() => {
        Components.updateConnectionStatus(true);
        Components.showToast('Connecté en temps réel', 'success');

        // Subscribe to all xyz trades
        wsManager.subscribeAllTrades();
    });

    wsManager.onDisconnect(() => {
        Components.updateConnectionStatus(false);
    });

    // Handle incoming trades
    wsManager.onTrade((trades) => {
        if (Array.isArray(trades)) {
            trades.forEach(trade => addTrade(trade));
        } else {
            addTrade(trades);
        }
    });

    wsManager.onError((error) => {
        console.error('WebSocket error:', error);
    });

    // Connect
    wsManager.connect();
}

/**
 * Add trade to feed
 */
function addTrade(trade) {
    // Only show xyz trades
    if (!trade.coin || !trade.coin.startsWith('xyz:')) return;

    // Add to beginning of array
    state.trades.unshift(trade);

    // Keep only MAX_TRADES
    if (state.trades.length > MAX_TRADES) {
        state.trades = state.trades.slice(0, MAX_TRADES);
    }

    // Update UI
    const tradesFeed = document.getElementById('tradesFeed');
    if (tradesFeed) {
        const item = Components.createTradeItem(trade);
        tradesFeed.insertBefore(item, tradesFeed.firstChild);

        // Remove excess items
        while (tradesFeed.children.length > MAX_TRADES) {
            tradesFeed.removeChild(tradesFeed.lastChild);
        }
    }

    // Update price in market card
    const card = document.querySelector(`.market-card[data-asset="${trade.coin}"]`);
    if (card) {
        const priceEl = card.querySelector('.market-price');
        if (priceEl) {
            const oldPrice = parseFloat(priceEl.dataset.price);
            Components.updatePriceElement(priceEl, trade.px, oldPrice);
        }
    }

    updateStats();
}

/**
 * Start price refresh interval
 */
function startPriceRefresh() {
    // Refresh prices every 10 seconds
    setInterval(async () => {
        try {
            const prices = await HyperliquidAPI.getAllMids();

            Object.entries(prices).forEach(([asset, price]) => {
                const oldPrice = state.prices[asset];
                state.prices[asset] = price;

                // Update card
                const card = document.querySelector(`.market-card[data-asset="${asset}"]`);
                if (card) {
                    const priceEl = card.querySelector('.market-price');
                    if (priceEl) {
                        Components.updatePriceElement(priceEl, price, oldPrice);
                    }
                }
            });
        } catch (error) {
            console.error('Price refresh failed:', error);
        }
    }, 10000);
}

/**
 * Lookup wallet fills
 */
async function lookupWallet(address) {
    const fillsContainer = document.getElementById('userFills');

    if (!HyperliquidAPI.isValidAddress(address)) {
        Components.showToast('Adresse wallet invalide', 'error');
        return;
    }

    state.walletAddress = address;

    if (fillsContainer) {
        Components.showLoading(fillsContainer);
    }

    try {
        // Fetch fills and account state in parallel
        const [fills, accountState] = await Promise.all([
            HyperliquidAPI.getUserFills(address),
            HyperliquidAPI.getUserState(address)
        ]);

        // Filter to only xyz fills
        state.userFills = (fills || []).filter(f => f.coin && f.coin.startsWith('xyz:'));

        // Calculate PNL from fills
        const pnlData = HyperliquidAPI.calculatePNLFromFills(state.userFills);

        // Store for rendering
        state.pnlData = pnlData;
        state.accountState = accountState;

        renderUserFills();

        if (state.userFills.length === 0) {
            Components.showToast('Aucune transaction trouvée pour ce wallet', 'info');
        } else {
            Components.showToast(`${state.userFills.length} transactions trouvées`, 'success');
        }

    } catch (error) {
        console.error('Failed to fetch user fills:', error);
        if (fillsContainer) {
            Components.showEmptyState(fillsContainer, 'Erreur de chargement des transactions');
        }
        Components.showToast('Erreur lors de la recherche', 'error');
    }
}

/**
 * Render user fills table with PNL summary
 */
function renderUserFills() {
    const container = document.getElementById('userFills');
    if (!container) return;

    if (state.userFills.length === 0) {
        Components.showEmptyState(container, 'Aucune transaction pour les marchés HIP-3');
        return;
    }

    const pnl = state.pnlData;
    const totalPnl = pnl.totalRealizedPnl;
    const isProfitable = totalPnl >= 0;

    // Group and sort by time (most recent first)
    const sorted = [...state.userFills].sort((a, b) => b.time - a.time);

    // Build PNL by asset summary
    const pnlByAssetHTML = Object.entries(pnl.byAsset)
        .filter(([_, data]) => data.trades > 0)
        .sort((a, b) => b[1].realizedPnl - a[1].realizedPnl)
        .map(([asset, data]) => {
            const symbol = asset.replace('xyz:', '');
            const isProfit = data.realizedPnl >= 0;
            return `
                <div class="pnl-asset-item">
                    <span class="pnl-asset-name">${symbol}</span>
                    <span class="pnl-asset-value ${isProfit ? 'text-success' : 'text-danger'}">
                        ${isProfit ? '+' : ''}$${data.realizedPnl.toFixed(2)}
                    </span>
                    <span class="pnl-asset-trades text-secondary">${data.trades} trades</span>
                </div>
            `;
        }).join('');

    container.innerHTML = `
        <!-- PNL Summary Card -->
        <div class="pnl-summary-card">
            <div class="pnl-summary-header">
                <h3>📊 Performance HIP-3</h3>
                <span class="wallet-address">${HyperliquidAPI.truncateAddress(state.walletAddress)}</span>
            </div>
            
            <div class="pnl-stats-grid">
                <div class="pnl-stat-item pnl-main">
                    <div class="pnl-stat-label">PNL Réalisé</div>
                    <div class="pnl-stat-value ${isProfitable ? 'text-success' : 'text-danger'}">
                        ${isProfitable ? '+' : ''}$${totalPnl.toFixed(2)}
                    </div>
                </div>
                <div class="pnl-stat-item">
                    <div class="pnl-stat-label">Volume Total</div>
                    <div class="pnl-stat-value">$${HyperliquidAPI.formatNumber(pnl.totalVolume)}</div>
                </div>
                <div class="pnl-stat-item">
                    <div class="pnl-stat-label">Nb. Trades</div>
                    <div class="pnl-stat-value">${pnl.totalTrades}</div>
                </div>
                <div class="pnl-stat-item">
                    <div class="pnl-stat-label">Actifs Tradés</div>
                    <div class="pnl-stat-value">${Object.keys(pnl.byAsset).length}</div>
                </div>
            </div>
            
            ${pnlByAssetHTML ? `
            <div class="pnl-by-asset">
                <h4>PNL par Actif</h4>
                <div class="pnl-asset-list">
                    ${pnlByAssetHTML}
                </div>
            </div>
            ` : ''}
        </div>
        
        <!-- Transactions Table -->
        <h4 style="margin-top: 1.5rem; margin-bottom: 1rem;">📜 Historique des Transactions</h4>
        <table class="fills-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Marché</th>
                    <th>Type</th>
                    <th>Prix</th>
                    <th>Quantité</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody id="fillsTableBody">
            </tbody>
        </table>
    `;

    const tbody = document.getElementById('fillsTableBody');
    sorted.slice(0, 50).forEach(fill => {
        tbody.appendChild(Components.createFillRow(fill));
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Export for debugging
window.AppState = state;

