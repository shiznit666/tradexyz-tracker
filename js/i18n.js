/**
 * Internationalization (i18n) for trade.xyz Tracker
 * Supports English (en) and French (fr)
 */

const translations = {
    en: {
        // Header
        pageTitle: "Live Transactions",
        pageSubtitle: "Track all transactions on trade.xyz HIP-3 markets in real-time",
        searchPlaceholder: "Search a market (AAPL, GOLD, EUR...)",
        connected: "Live",
        disconnected: "Disconnected",

        // Stats
        activeMarkets: "Active Markets",
        recentTrades: "Recent Trades",
        hip3Pairs: "HIP-3 Pairs",
        webSocket: "WebSocket",
        yes: "Yes",
        no: "No",

        // Categories
        all: "All",
        equities: "Stocks",
        commodities: "Commodities",
        forex: "Forex",
        index: "Index",

        // Market Cards
        marketsTitle: "HIP-3 MARKETS",
        action: "Stock",
        commodity: "Commodity",

        // Trades Feed
        liveTradesTitle: "LIVE TRADES",
        waitingConnection: "Waiting for WebSocket connection...",
        buy: "Buy",
        sell: "Sell",

        // Wallet Lookup
        walletSearchTitle: "WALLET LOOKUP",
        walletSearchDesc: "Enter an Ethereum wallet address to view transaction history on HIP-3 markets",
        walletPlaceholder: "0x... (wallet address)",
        search: "Search",

        // PNL
        performance: "HIP-3 Performance",
        realizedPnl: "Realized PNL",
        totalVolume: "Total Volume",
        numTrades: "Trades",
        assetsTraded: "Assets Traded",
        pnlByAsset: "PNL by Asset",
        trades: "trades",
        transactionHistory: "Transaction History",

        // Table Headers
        date: "Date",
        market: "Market",
        type: "Type",
        price: "Price",
        quantity: "Quantity",
        total: "Total",

        // Footer
        footerText: "Real-time data via Hyperliquid API • HIP-3 markets on trade.xyz",
        disclaimer: "⚠️ This site is not affiliated with trade.xyz. For informational purposes only.",
        joinHyperliquid: "Join Hyperliquid",
        buyMeCoffee: "Buy me a coffee",
        addressCopied: "Address copied to clipboard!",
        madeWith: "Made with",
        by: "by",

        // Toasts
        connectedRealtime: "Connected in real-time",
        invalidWallet: "Invalid wallet address",
        noTransactions: "No transactions found for this wallet",
        transactionsFound: "transactions found",
        searchError: "Search error",
        apiError: "API connection error",
        noHip3Transactions: "No transactions for HIP-3 markets"
    },

    fr: {
        // Header
        pageTitle: "Transactions En Direct",
        pageSubtitle: "Suivez toutes les transactions sur les marchés HIP-3 de trade.xyz en temps réel",
        searchPlaceholder: "Rechercher un marché (AAPL, GOLD, EUR...)",
        connected: "En direct",
        disconnected: "Déconnecté",

        // Stats
        activeMarkets: "Marchés Actifs",
        recentTrades: "Trades Récents",
        hip3Pairs: "Paires HIP-3",
        webSocket: "WebSocket",
        yes: "Oui",
        no: "Non",

        // Categories
        all: "Tous",
        equities: "Actions",
        commodities: "Commodités",
        forex: "Forex",
        index: "Index",

        // Market Cards
        marketsTitle: "MARCHÉS HIP-3",
        action: "Action",
        commodity: "Commodité",

        // Trades Feed
        liveTradesTitle: "TRADES EN DIRECT",
        waitingConnection: "En attente de connexion WebSocket...",
        buy: "Achat",
        sell: "Vente",

        // Wallet Lookup
        walletSearchTitle: "RECHERCHE DE WALLET",
        walletSearchDesc: "Entrez une adresse wallet Ethereum pour voir l'historique des transactions sur les marchés HIP-3",
        walletPlaceholder: "0x... (adresse wallet)",
        search: "Rechercher",

        // PNL
        performance: "Performance HIP-3",
        realizedPnl: "PNL Réalisé",
        totalVolume: "Volume Total",
        numTrades: "Nb. Trades",
        assetsTraded: "Actifs Tradés",
        pnlByAsset: "PNL par Actif",
        trades: "trades",
        transactionHistory: "Historique des Transactions",

        // Table Headers
        date: "Date",
        market: "Marché",
        type: "Type",
        price: "Prix",
        quantity: "Quantité",
        total: "Total",

        // Footer
        footerText: "Données en temps réel via l'API Hyperliquid • Marchés HIP-3 sur trade.xyz",
        disclaimer: "⚠️ Ce site n'est pas affilié à trade.xyz. À des fins informatives seulement.",
        joinHyperliquid: "Rejoindre Hyperliquid",
        buyMeCoffee: "Offrez-moi un café",
        addressCopied: "Adresse copiée !",
        madeWith: "Fait avec",
        by: "par",

        // Toasts
        connectedRealtime: "Connecté en temps réel",
        invalidWallet: "Adresse wallet invalide",
        noTransactions: "Aucune transaction trouvée pour ce wallet",
        transactionsFound: "transactions trouvées",
        searchError: "Erreur lors de la recherche",
        apiError: "Erreur de connexion à l'API",
        noHip3Transactions: "Aucune transaction pour les marchés HIP-3"
    }
};

// Current language (default: English)
let currentLang = localStorage.getItem('lang') || 'en';

/**
 * Get translation for a key
 */
function t(key) {
    return translations[currentLang][key] || translations['en'][key] || key;
}

/**
 * Set language and update UI
 */
function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('lang', lang);
        updateAllTranslations();
        updateLanguageButtons();
    }
}

/**
 * Get current language
 */
function getCurrentLanguage() {
    return currentLang;
}

/**
 * Update all translatable elements in the DOM
 */
function updateAllTranslations() {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        // Skip connection text - it will be updated separately based on actual status
        if (el.id === 'connectionText') return;
        el.textContent = t(key);
    });

    // Update all elements with data-i18n-placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        el.placeholder = t(key);
    });

    // Update page title
    document.title = `trade.xyz Tracker | ${t('pageTitle')}`;

    // Update category tabs
    updateCategoryTabs();

    // Update connection status with actual WebSocket state
    if (window.wsManager && window.Components) {
        Components.updateConnectionStatus(wsManager.getStatus());
    }

    // Update stats with translated text
    if (window.wsManager) {
        const statConnected = document.getElementById('statConnected');
        if (statConnected) {
            statConnected.textContent = wsManager.getStatus() ? t('yes') : t('no');
        }
    }
}

/**
 * Update category tab labels
 */
function updateCategoryTabs() {
    const tabMappings = {
        'all': 'all',
        'equities': 'equities',
        'commodities': 'commodities',
        'forex': 'forex',
        'index': 'index'
    };

    document.querySelectorAll('.category-tab').forEach(tab => {
        const category = tab.dataset.category;
        if (tabMappings[category]) {
            const emoji = tab.textContent.split(' ')[0]; // Keep emoji
            tab.textContent = `${emoji} ${t(tabMappings[category])}`;
        }
    });
}

/**
 * Update language button states
 */
function updateLanguageButtons() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
}

// Export for global access
window.i18n = {
    t,
    setLanguage,
    getCurrentLanguage,
    updateAllTranslations
};
