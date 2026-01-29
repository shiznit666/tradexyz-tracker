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
    walletAddress: '',
    uniqueTraders: new Set(),  // Track unique wallet addresses
    // HIP-3 Analytics State
    hip3Data: [],
    hip3Category: 'all',
    hip3Search: '',
    hip3Sort: { column: 'volume24h', direction: 'desc' }
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

    // Load HIP-3 analytics data
    await loadHip3Analytics();

    // Connect WebSocket for real-time data
    connectWebSocket();

    // Start price refresh interval
    startPriceRefresh();

    // Start HIP-3 data refresh (every 15 seconds)
    startHip3Refresh();

    // Initialize charts
    if (window.Charts) {
        Charts.init();
        Charts.renderChartLegend();
    }

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

    // Main navigation tabs
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.currentTarget.dataset.tab;
            switchTab(tabName);
        });
    });

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

    // Setup HIP-3 analytics listeners
    setupHip3Listeners();
}

/**
 * Switch between main tabs
 */
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // Re-initialize charts if switching to analytics tab
    if (tabName === 'analytics' && window.Charts) {
        // Small delay to ensure DOM is visible
        setTimeout(() => {
            Charts.init();
            Charts.renderChartLegend();
        }, 100);
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
    // Note: statUniqueTraders is NOT updated here - we keep the static "74K+" from Hyperzap data
    // The session-based unique traders count is shown in the trades feed and charts instead
    const statElements = {
        'statMarkets': activeMarkets,
        'statTrades': state.trades.length,
        'statConnected': wsManager.getStatus() ? i18n.t('yes') : i18n.t('no')
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
        Components.showToast(i18n.t('connectedRealtime'), 'success');

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

    // Track unique trader address
    if (trade.users && trade.users.length > 0) {
        trade.users.forEach(user => {
            if (user && user.length === 42) {  // Valid ETH address
                state.uniqueTraders.add(user.toLowerCase());
            }
        });
    }

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

// ============================================
// HIP-3 ANALYTICS FUNCTIONS
// ============================================

/**
 * Load HIP-3 analytics data from API
 */
async function loadHip3Analytics() {
    try {
        const metaAndCtxs = await HyperliquidAPI.getMetaAndAssetCtxs();
        state.hip3Data = HyperliquidAPI.processHip3Analytics(metaAndCtxs);

        // Update UI
        updateHip3Stats();
        renderHip3Table();

        // Update last update time
        const updateEl = document.getElementById('hip3LastUpdate');
        if (updateEl) {
            updateEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        }

        console.log(`Loaded ${state.hip3Data.length} HIP-3 markets`);
    } catch (error) {
        console.error('Failed to load HIP-3 analytics:', error);
        Components.showToast('Error loading HIP-3 data', 'error');
    }
}

/**
 * Update HIP-3 summary stats
 */
function updateHip3Stats() {
    const data = state.hip3Data;
    if (!data || data.length === 0) return;

    // Calculate totals
    const totalVolume = data.reduce((sum, m) => sum + (m.volume24h || 0), 0);
    const totalOI = data.reduce((sum, m) => sum + (m.openInterestUsd || 0), 0);

    // Find best/worst performers
    const sorted = [...data].sort((a, b) => b.change24h - a.change24h);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    // Update DOM
    const volumeEl = document.getElementById('hip3TotalVolume');
    const oiEl = document.getElementById('hip3TotalOI');
    const bestEl = document.getElementById('hip3BestPerformer');
    const worstEl = document.getElementById('hip3WorstPerformer');

    if (volumeEl) volumeEl.textContent = '$' + HyperliquidAPI.formatNumber(totalVolume);
    if (oiEl) oiEl.textContent = '$' + HyperliquidAPI.formatNumber(totalOI);
    if (bestEl) bestEl.textContent = `${best.name} ${best.change24hFormatted}`;
    if (worstEl) worstEl.textContent = `${worst.name} ${worst.change24hFormatted}`;
}

/**
 * Render HIP-3 analytics table
 */
function renderHip3Table() {
    const tbody = document.getElementById('hip3TableBody');
    if (!tbody) return;

    let filtered = filterHip3Data();
    filtered = sortHip3Data(filtered);

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="hip3-no-data">
                    No markets found matching your criteria
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(market => {
        const changeClass = market.change24h >= 0 ? 'hip3-positive' : 'hip3-negative';
        const fundingClass = market.funding >= 0 ? 'hip3-positive' : 'hip3-negative';
        const premiumClass = market.premium >= 0 ? 'hip3-positive' : 'hip3-negative';

        // Funding badge class for extreme values
        let fundingBadgeClass = '';
        if (Math.abs(market.funding) > 0.001) {
            fundingBadgeClass = market.funding > 0 ? 'hip3-funding extreme-positive' : 'hip3-funding extreme-negative';
        }

        return `
            <tr data-asset="${market.fullName}">
                <td>
                    <div class="hip3-asset-cell">
                        <div class="hip3-asset-icon ${market.category}">${market.name.slice(0, 2)}</div>
                        <div>
                            <div class="hip3-asset-name">${market.name}</div>
                            <div class="hip3-asset-category">${market.category}</div>
                        </div>
                    </div>
                </td>
                <td class="text-right hip3-price">$${HyperliquidAPI.formatPrice(market.markPrice)}</td>
                <td class="text-right ${changeClass}">${market.change24hFormatted}</td>
                <td class="text-right">
                    <span class="${fundingBadgeClass || fundingClass}">${market.fundingFormatted}</span>
                </td>
                <td class="text-right">${market.openInterestFormatted}</td>
                <td class="text-right">${market.volume24hFormatted}</td>
                <td class="text-right ${premiumClass}">${market.premiumFormatted}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Filter HIP-3 data based on category and search
 */
function filterHip3Data() {
    let data = [...state.hip3Data];

    // Filter by category
    if (state.hip3Category !== 'all') {
        data = data.filter(m => m.category === state.hip3Category);
    }

    // Filter by search
    if (state.hip3Search) {
        const query = state.hip3Search.toLowerCase();
        data = data.filter(m =>
            m.name.toLowerCase().includes(query) ||
            m.category.toLowerCase().includes(query)
        );
    }

    return data;
}

/**
 * Sort HIP-3 data
 */
function sortHip3Data(data) {
    const { column, direction } = state.hip3Sort;

    return data.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];

        // Handle string comparison
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        if (direction === 'asc') {
            return aVal > bVal ? 1 : -1;
        }
        return aVal < bVal ? 1 : -1;
    });
}

/**
 * Setup HIP-3 event listeners (called from setupEventListeners)
 */
function setupHip3Listeners() {
    // Category filters
    document.querySelectorAll('.hip3-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.hip3-filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.hip3Category = e.target.dataset.hip3Category;
            renderHip3Table();
        });
    });

    // Search input
    const searchInput = document.getElementById('hip3Search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.hip3Search = e.target.value;
            renderHip3Table();
        });
    }

    // Table header sorting
    document.querySelectorAll('.hip3-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;

            // Toggle direction if same column
            if (state.hip3Sort.column === column) {
                state.hip3Sort.direction = state.hip3Sort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.hip3Sort.column = column;
                state.hip3Sort.direction = 'desc';
            }

            // Update header styles
            document.querySelectorAll('.hip3-table th').forEach(h => h.classList.remove('sorted'));
            th.classList.add('sorted');

            renderHip3Table();
        });
    });
}

/**
 * Start HIP-3 data refresh interval
 */
function startHip3Refresh() {
    setInterval(async () => {
        await loadHip3Analytics();
    }, 15000); // Refresh every 15 seconds
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Export for debugging
window.AppState = state;

