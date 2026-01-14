/**
 * WebSocket Manager for Hyperliquid real-time data
 */

class WebSocketManager {
    constructor() {
        this.ws = null;
        this.wsUrl = 'wss://api.hyperliquid.xyz/ws';
        this.subscriptions = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnected = false;
        this.callbacks = {
            onConnect: [],
            onDisconnect: [],
            onTrade: [],
            onError: []
        };
    }

    /**
     * Connect to WebSocket
     */
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        console.log('Connecting to WebSocket...');

        try {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;

                // Resubscribe to all previous subscriptions
                this.subscriptions.forEach((_, sub) => {
                    this.send({
                        method: 'subscribe',
                        subscription: JSON.parse(sub)
                    });
                });

                this.callbacks.onConnect.forEach(cb => cb());
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                this.isConnected = false;
                this.callbacks.onDisconnect.forEach(cb => cb());

                // Attempt reconnection
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
                    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
                    setTimeout(() => this.connect(), delay);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.callbacks.onError.forEach(cb => cb(error));
            };

        } catch (error) {
            console.error('Failed to create WebSocket:', error);
        }
    }

    /**
     * Send message to WebSocket
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected, queuing message');
        }
    }

    /**
     * Handle incoming WebSocket message
     */
    handleMessage(data) {
        if (data.channel === 'subscriptionResponse') {
            console.log('Subscription confirmed:', data.data);
            return;
        }

        if (data.channel === 'trades') {
            this.callbacks.onTrade.forEach(cb => cb(data.data));
        }

        if (data.channel === 'allMids') {
            // Handle all mids updates if subscribed
            if (this.callbacks.onMids) {
                this.callbacks.onMids.forEach(cb => cb(data.data));
            }
        }

        if (data.channel === 'l2Book') {
            // Handle order book updates
            if (this.callbacks.onL2Book) {
                this.callbacks.onL2Book.forEach(cb => cb(data.data));
            }
        }
    }

    /**
     * Subscribe to trades for a specific coin
     */
    subscribeTrades(coin) {
        const subscription = { type: 'trades', coin: coin };
        const key = JSON.stringify(subscription);

        if (!this.subscriptions.has(key)) {
            this.subscriptions.set(key, true);
            this.send({
                method: 'subscribe',
                subscription: subscription
            });
        }
    }

    /**
     * Subscribe to all trades for xyz DEX (dynamically loaded from API)
     */
    subscribeAllTrades() {
        // Get markets dynamically from API (populated by loadMarketData)
        const coins = HyperliquidAPI.getAllXyzMarkets();

        if (coins.length === 0) {
            console.warn('No xyz markets loaded yet, using fallback');
            // Fallback to common markets if API hasn't loaded yet
            ['xyz:XYZ100', 'xyz:TSLA', 'xyz:NVDA', 'xyz:AAPL', 'xyz:GOLD'].forEach(coin => {
                this.subscribeTrades(coin);
            });
        } else {
            console.log(`Subscribing to ${coins.length} xyz markets`);
            coins.forEach(coin => this.subscribeTrades(coin));
        }
    }

    /**
     * Subscribe to allMids updates
     */
    subscribeAllMids() {
        const subscription = { type: 'allMids' };
        this.send({
            method: 'subscribe',
            subscription: subscription
        });
    }

    /**
     * Subscribe to L2 book updates for a coin
     */
    subscribeL2Book(coin) {
        const subscription = { type: 'l2Book', coin: coin };
        const key = JSON.stringify(subscription);

        if (!this.subscriptions.has(key)) {
            this.subscriptions.set(key, true);
            this.send({
                method: 'subscribe',
                subscription: subscription
            });
        }
    }

    /**
     * Unsubscribe from a subscription
     */
    unsubscribe(subscription) {
        const key = JSON.stringify(subscription);
        this.subscriptions.delete(key);
        this.send({
            method: 'unsubscribe',
            subscription: subscription
        });
    }

    /**
     * Register callback for connection
     */
    onConnect(callback) {
        this.callbacks.onConnect.push(callback);
    }

    /**
     * Register callback for disconnection
     */
    onDisconnect(callback) {
        this.callbacks.onDisconnect.push(callback);
    }

    /**
     * Register callback for trades
     */
    onTrade(callback) {
        this.callbacks.onTrade.push(callback);
    }

    /**
     * Register callback for errors
     */
    onError(callback) {
        this.callbacks.onError.push(callback);
    }

    /**
     * Get connection status
     */
    getStatus() {
        return this.isConnected;
    }

    /**
     * Disconnect WebSocket
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
        }
    }
}

// Create singleton instance
window.wsManager = new WebSocketManager();
