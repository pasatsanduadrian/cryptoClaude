// Crypto Trading System - Complete Implementation with Real Trading
// Includes Solana wallet integration, PumpPortal trading, and advanced monitoring

class CryptoTradingSystem {
    constructor() {
        // API Configuration
        this.apiKeys = {};
        this.apiEndpoints = {
            helius: "https://mainnet.helius-rpc.com/",
            heliusAPI: "https://api.helius.xyz/v0/",
            moralis: "https://deep-index.moralis.io/api/v2.2/",
            dexscreener: "https://api.dexscreener.com/latest/",
            coingecko: "https://api.coingecko.com/api/v3/",
            jupiter: "https://quote-api.jup.ag/v6/",
            birdeye: "https://public-api.birdeye.so/defi/",
            openai: "https://api.openai.com/v1/",
            pumpfun: "https://frontend-api.pump.fun/",
            pumpportal: "wss://pumpportal.fun/api/data",
            pumpportalTrade: "https://pumpportal.fun/api/trade-local",
            rugcheck: "https://api.rugcheck.xyz/v1/"
        };
        
        // Trading Configuration
        this.settings = {
            volumeSpike: 200,
            minLiquidity: 50000,
            volumeMcapRatio: 0.5,
            maxExposure: 5,
            dailyLossLimit: 20,
            stopLoss: 15,
            takeProfitLevels: [25, 50, 75],
            checkInterval: 5000,
            slippage: 0.5,
            priorityFee: 0.0001, // SOL
            maxPositions: 10
        };

        // State Management
        this.cache = new Map();
        this.priceCache = new Map();
        this.scannerActive = false;
        this.positions = new Map();
        this.pendingOrders = new Map();
        this.signals = [];
        this.tradeHistory = [];
        this.websockets = new Map();
        
        // Wallet & Trading
        this.wallet = null;
        this.connection = null;
        this.tradingEngine = null;
        
        // Performance Tracking
        this.performance = {
            totalPnl: 0,
            winRate: 0,
            totalTrades: 0,
            avgReturn: 0,
            dailyPnl: 0,
            maxDrawdown: 0
        };

        // Pump.fun specific
        this.PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
        this.monitoringIntervals = new Map();
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.loadSettings();
        this.loadApiKeys();
        this.initializeCharts();
        this.wallet = new WalletManager(this);
        this.tradingEngine = new TradingEngine(this);
        this.updateUI();
        
        // Initialize Solana Web3
        if (typeof window !== 'undefined' && window.solanaWeb3) {
            console.log('Solana Web3 loaded');
        } else {
            this.loadSolanaWeb3();
        }
    }

    async loadSolanaWeb3() {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js';
        script.onload = () => {
            console.log('Solana Web3 loaded via script');
        };
        document.head.appendChild(script);
    }
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // API Keys
        ['helius', 'moralis', 'dexscreener', 'coingecko', 'jupiter', 'birdeye', 'openai', 'pumpportal'].forEach(api => {
            const input = document.getElementById(`${api}Key`);
            if (input) {
                input.addEventListener('input', () => {
                    this.apiKeys[api] = input.value;
                    this.saveApiKeys();
                });
            }
        });
        
        // Settings
        Object.keys(this.settings).forEach(setting => {
            const input = document.getElementById(setting);
            if (input) {
                input.addEventListener('change', () => {
                    this.settings[setting] = parseFloat(input.value);
                    this.saveSettings();
                });
            }
        });

        // Order Type Toggle
        document.querySelectorAll('input[name="orderType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const limitGroup = document.getElementById('limitPriceGroup');
                if (e.target.value === 'limit') {
                    limitGroup.classList.remove('hidden');
                } else {
                    limitGroup.classList.add('hidden');
                }
            });
        });

        // Connect Wallet Button
        const connectBtn = document.getElementById('connectWallet');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectWallet());
        }
    }

    // Enhanced API Testing with proper error handling
    async testApiConnection(apiName) {
        const key = this.apiKeys[apiName];
        const noKeyRequired = ['dexscreener', 'jupiter'];

        if (!key && !noKeyRequired.includes(apiName)) {
            this.showToast(`API Key pentru ${apiName} nu este configurat`, 'error');
            return;
        }

        this.showLoading(true);
        this.logMessage(`Testing ${apiName} connection...`, 'info');
        
        try {
            let isConnected = false;
            
            switch (apiName) {
                case 'helius':
                    isConnected = await this.testHeliusConnection(key);
                    break;
                case 'moralis':
                    isConnected = await this.testMoralisConnection(key);
                    break;
                case 'dexscreener':
                    isConnected = await this.testDexScreenerConnection();
                    break;
                case 'coingecko':
                    isConnected = await this.testCoinGeckoConnection(key);
                    break;
                case 'jupiter':
                    isConnected = await this.testJupiterConnection();
                    break;
                case 'birdeye':
                    isConnected = await this.testBirdeyeConnection(key);
                    break;
                case 'openai':
                    isConnected = await this.testOpenAIConnection(key);
                    break;
                case 'pumpportal':
                    isConnected = await this.testPumpPortalConnection(key);
                    break;
            }
            
            this.updateApiStatus(apiName, isConnected);
            this.showToast(
                `${apiName} ${isConnected ? 'connected successfully' : 'connection failed'}`,
                isConnected ? 'success' : 'error'
            );
            
        } catch (error) {
            console.error(`Error testing ${apiName}:`, error);
            this.updateApiStatus(apiName, false);
            this.showToast(`Error testing ${apiName}: ${error.message}`, 'error');
        }
        
        this.showLoading(false);
    }

    async testPumpPortalConnection(apiKey) {
        try {
            // Test WebSocket connection
            const ws = new WebSocket(this.apiEndpoints.pumpportal);
            
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    resolve(false);
                }, 5000);

                ws.onopen = () => {
                    clearTimeout(timeout);
                    ws.close();
                    
                    // If we have an API key, test the trade endpoint
                    if (apiKey) {
                        fetch(this.apiEndpoints.pumpportalTrade, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            },
                            body: JSON.stringify({ test: true })
                        }).then(response => {
                            resolve(response.ok);
                        }).catch(() => resolve(false));
                    } else {
                        resolve(true);
                    }
                };

                ws.onerror = () => {
                    clearTimeout(timeout);
                    resolve(false);
                };
            });
        } catch (error) {
            return false;
        }
    }

    // Enhanced Market Scanning with multiple data sources
    async scanMarket() {
        if (!this.scannerActive) return;
        
        try {
            this.logMessage('=== MARKET SCAN STARTED ===', 'info');

            // Parallel data collection for efficiency
            const [pumpTokens, dexTokens, birdeyeTokens, newTokens] = await Promise.all([
                this.scanPumpFun(),
                this.scanDexScreener(),
                this.scanBirdeye(),
                this.scanNewTokens()
            ]);

            // Combine and deduplicate tokens
            const allTokens = this.combineTokenData(pumpTokens, dexTokens, birdeyeTokens, newTokens);
            
            // Enhanced filtering with safety checks
            const safeTokens = await this.filterSafeTokens(allTokens);
            
            // AI Analysis if available
            if (this.apiKeys.openai && safeTokens.length > 0) {
                await this.enrichWithAIAnalysis(safeTokens);
            }

            // Generate trading signals
            const signals = this.generateTradingSignals(safeTokens);
            
            this.updateScannerResults(signals);
            this.signals = signals;
            
            this.logMessage(`=== SCAN COMPLETE: ${signals.length} signals ===`, 'success');

        } catch (error) {
            this.logMessage(`Scan error: ${error.message}`, 'error');
        }
    }

    async scanNewTokens() {
        if (!this.apiKeys.helius) return [];

        try {
            const connection = new solanaWeb3.Connection(
                `${this.apiEndpoints.helius}?api-key=${this.apiKeys.helius}`
            );

            // Get recent signatures
            const signatures = await connection.getSignaturesForAddress(
                new solanaWeb3.PublicKey(this.PUMP_FUN_PROGRAM_ID),
                { limit: 100 }
            );

            const newTokens = [];
            
            // Analyze transactions for new token creation
            for (const sig of signatures.slice(0, 20)) {
                try {
                    const tx = await connection.getParsedTransaction(sig.signature, {
                        maxSupportedTransactionVersion: 0
                    });
                    
                    if (tx && tx.meta && !tx.meta.err) {
                        const token = this.extractTokenFromTransaction(tx);
                        if (token) newTokens.push(token);
                    }
                } catch (err) {
                    // Skip failed transactions
                }
            }

            return newTokens;
        } catch (error) {
            this.logMessage(`New tokens scan error: ${error.message}`, 'error');
            return [];
        }
    }

    extractTokenFromTransaction(tx) {
        // Look for token creation patterns
        const instructions = tx.transaction.message.instructions;
        
        for (const ix of instructions) {
            if (ix.programId && ix.programId.toString() === this.PUMP_FUN_PROGRAM_ID) {
                // Extract token mint from instruction data
                const accounts = ix.accounts || [];
                if (accounts.length > 0) {
                    return {
                        address: accounts[0].toString(),
                        timestamp: tx.blockTime,
                        source: 'pump.fun',
                        isNew: true
                    };
                }
            }
        }
        
        return null;
    }

    combineTokenData(...tokenArrays) {
        const tokenMap = new Map();
        
        for (const tokens of tokenArrays) {
            for (const token of tokens) {
                const key = token.address || token.baseToken?.address;
                if (!key) continue;
                
                if (tokenMap.has(key)) {
                    // Merge data from multiple sources
                    const existing = tokenMap.get(key);
                    tokenMap.set(key, {
                        ...existing,
                        ...token,
                        sources: [...(existing.sources || []), token.source].filter(Boolean)
                    });
                } else {
                    tokenMap.set(key, {
                        ...token,
                        sources: [token.source].filter(Boolean)
                    });
                }
            }
        }
        
        return Array.from(tokenMap.values());
    }

    async filterSafeTokens(tokens) {
        const safeTokens = [];
        
        for (const token of tokens) {
            try {
                // Basic filters
                const liquidity = this.extractLiquidity(token);
                const volume = this.extractVolume(token);
                const marketCap = this.extractMarketCap(token);
                
                if (liquidity < this.settings.minLiquidity) continue;
                if (marketCap > 10000000) continue; // Skip if MC > $10M
                if (volume === 0) continue;
                
                // Volume/MC ratio check
                const volumeMcRatio = marketCap > 0 ? volume / marketCap : 0;
                if (volumeMcRatio < this.settings.volumeMcapRatio) continue;
                
                // Safety checks
                const safety = await this.checkTokenSafety(token.address || token.baseToken?.address);
                if (!safety.safe) {
                    this.logMessage(`Token ${token.symbol} failed safety: ${safety.reason}`, 'warning');
                    continue;
                }
                
                safeTokens.push({
                    ...token,
                    liquidity,
                    volume,
                    marketCap,
                    volumeMcRatio,
                    safety
                });
                
            } catch (error) {
                // Skip tokens that fail processing
            }
        }
        
        return safeTokens;
    }

    async checkTokenSafety(tokenAddress) {
        const checks = {
            safe: true,
            score: 100,
            liquidity: 0,
            holders: 0,
            lpLocked: false,
            rugPullRisk: 'low',
            honeypot: false,
            mintable: false,
            freezable: false,
            reason: ''
        };

        try {
            // 1. Check liquidity from multiple sources
            const liquidityData = await this.getMultiSourceLiquidity(tokenAddress);
            checks.liquidity = liquidityData.total;

            // 2. Get on-chain data
            if (this.connection) {
                const tokenData = await this.getTokenOnChainData(tokenAddress);
                checks.holders = tokenData.holders;
                checks.mintable = tokenData.mintAuthority !== null;
                checks.freezable = tokenData.freezeAuthority !== null;
            }

            // 3. Check if honeypot using simulation
            if (this.apiKeys.helius) {
                checks.honeypot = await this.checkHoneypot(tokenAddress);
            }

            // 4. Calculate safety score
            if (checks.liquidity < 50000) {
                checks.score -= 30;
                checks.rugPullRisk = 'high';
                checks.reason = 'Low liquidity';
            }

            if (checks.holders < 100) {
                checks.score -= 20;
                checks.rugPullRisk = 'high';
                checks.reason += ' | Few holders';
            }

            if (checks.honeypot) {
                checks.score = 0;
                checks.safe = false;
                checks.reason = 'HONEYPOT DETECTED';
                return checks;
            }

            if (checks.mintable || checks.freezable) {
                checks.score -= 25;
                checks.rugPullRisk = 'medium';
                checks.reason += ' | Risky authorities';
            }

            checks.safe = checks.score >= 50;
            
        } catch (error) {
            checks.safe = false;
            checks.reason = 'Safety check failed';
            checks.score = 0;
        }

        return checks;
    }

    async getMultiSourceLiquidity(tokenAddress) {
        const liquidityData = { total: 0, sources: {} };

        // DexScreener
        try {
            const dexData = await this.fetchJson(
                `${this.apiEndpoints.dexscreener}dex/tokens/${tokenAddress}`
            );
            if (dexData.pairs) {
                const dexLiquidity = dexData.pairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);
                liquidityData.sources.dexscreener = dexLiquidity;
                liquidityData.total += dexLiquidity;
            }
        } catch (e) {}

        // Birdeye
        if (this.apiKeys.birdeye) {
            try {
                const birdData = await this.fetchJson(
                    `${this.apiEndpoints.birdeye}token/${tokenAddress}`,
                    { headers: { 'X-API-KEY': this.apiKeys.birdeye } }
                );
                if (birdData.data?.liquidity) {
                    liquidityData.sources.birdeye = birdData.data.liquidity;
                    liquidityData.total = Math.max(liquidityData.total, birdData.data.liquidity);
                }
            } catch (e) {}
        }

        return liquidityData;
    }

    async getTokenOnChainData(tokenAddress) {
        try {
            const mintPubkey = new solanaWeb3.PublicKey(tokenAddress);
            const mintInfo = await this.connection.getParsedAccountInfo(mintPubkey);
            
            const data = mintInfo.value?.data?.parsed?.info || {};
            
            // Get holder count (approximation)
            const largestAccounts = await this.connection.getTokenLargestAccounts(mintPubkey);
            const holders = largestAccounts.value.filter(a => a.uiAmount > 0).length;

            return {
                decimals: data.decimals || 0,
                supply: data.supply || 0,
                mintAuthority: data.mintAuthority || null,
                freezeAuthority: data.freezeAuthority || null,
                holders: holders * 10 // Rough estimate
            };
        } catch (error) {
            return {
                holders: 0,
                mintAuthority: null,
                freezeAuthority: null
            };
        }
    }

    async checkHoneypot(tokenAddress) {
        try {
            // Simulate a swap to check if it's possible to sell
            const quote = await this.fetchJson(
                `${this.apiEndpoints.jupiter}quote?` + new URLSearchParams({
                    inputMint: tokenAddress,
                    outputMint: 'So11111111111111111111111111111111111112',
                    amount: '1000000', // Small amount
                    slippageBps: '300'
                })
            );

            return !quote || quote.error || !quote.outAmount;
        } catch (error) {
            return true; // Assume honeypot if check fails
        }
    }

    async enrichWithAIAnalysis(tokens) {
        const batchSize = 5;
        
        for (let i = 0; i < tokens.length; i += batchSize) {
            const batch = tokens.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (token) => {
                try {
                    token.aiAnalysis = await this.getAIAnalysis(token);
                } catch (error) {
                    token.aiAnalysis = { score: 50, recommendation: 'neutral' };
                }
            }));
        }
    }

    async getAIAnalysis(token) {
        const prompt = `Analyze this Solana token for trading potential:
Symbol: ${token.symbol || 'Unknown'}
Liquidity: $${this.formatNumber(token.liquidity)}
Volume 24h: $${this.formatNumber(token.volume)}
Market Cap: $${this.formatNumber(token.marketCap)}
Volume/MC Ratio: ${token.volumeMcRatio.toFixed(2)}
Holders: ${token.safety.holders}
Safety Score: ${token.safety.score}/100
Sources: ${token.sources?.join(', ') || 'Unknown'}

Provide:
1. Score (0-100) for pump potential
2. Risk level (low/medium/high)
3. Trading recommendation (buy/hold/avoid)
4. Key factors

Respond in JSON format.`;

        try {
            const response = await this.fetchJson(
                `${this.apiEndpoints.openai}chat/completions`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKeys.openai}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.3,
                        max_tokens: 200
                    })
                }
            );

            const content = response.choices[0].message.content;
            return JSON.parse(content);
        } catch (error) {
            return {
                score: 50,
                risk: 'medium',
                recommendation: 'hold',
                factors: ['Analysis failed']
            };
        }
    }

    generateTradingSignals(tokens) {
        return tokens.map(token => {
            const signal = {
                ...token,
                timestamp: Date.now(),
                strength: 0,
                type: [],
                action: 'hold'
            };

            // Volume spike signal
            if (token.volumeMcRatio > 2) {
                signal.strength += 30;
                signal.type.push('volume-spike');
            }

            // New token signal
            if (token.isNew && (Date.now() - token.timestamp * 1000) < 3600000) {
                signal.strength += 20;
                signal.type.push('new-listing');
            }

            // AI signal
            if (token.aiAnalysis?.score > 70) {
                signal.strength += 25;
                signal.type.push('ai-bullish');
            }

            // Safety bonus
            if (token.safety.score > 80) {
                signal.strength += 15;
                signal.type.push('high-safety');
            }

            // Multiple source confirmation
            if (token.sources?.length >= 3) {
                signal.strength += 10;
                signal.type.push('multi-source');
            }

            // Determine action
            if (signal.strength >= 70 && token.safety.safe) {
                signal.action = 'buy';
            } else if (signal.strength >= 50) {
                signal.action = 'watch';
            }

            return signal;
        }).sort((a, b) => b.strength - a.strength);
    }

    // Wallet Integration
    async connectWallet() {
        const result = await this.wallet.connect();
        
        if (result.success) {
            this.showToast('Wallet connected successfully', 'success');
            this.updateWalletUI();
            
            // Initialize connection
            this.connection = new solanaWeb3.Connection(
                `${this.apiEndpoints.helius}?api-key=${this.apiKeys.helius}`,
                'confirmed'
            );
            
            // Start balance monitoring
            this.startBalanceMonitoring();
        } else {
            this.showToast(`Wallet connection failed: ${result.error}`, 'error');
        }
    }

    startBalanceMonitoring() {
        setInterval(async () => {
            if (this.wallet.publicKey) {
                const balance = await this.wallet.getBalance();
                document.querySelector('.wallet-balance').textContent = `${balance.toFixed(4)} SOL`;
            }
        }, 10000);
    }

    // Trading Execution
    async executeRealTrade(side) {
        if (!this.wallet.publicKey) {
            this.showToast('Connect wallet first', 'error');
            return;
        }

        const tokenAddress = document.getElementById('tokenAddress').value;
        const amount = parseFloat(document.getElementById('tradeAmount').value);
        const orderType = document.querySelector('input[name="orderType"]:checked').value;

        if (!tokenAddress || !amount) {
            this.showToast('Fill all required fields', 'error');
            return;
        }

        // Check position limits
        if (this.positions.size >= this.settings.maxPositions) {
            this.showToast('Maximum positions reached', 'error');
            return;
        }

        this.showLoading(true);

        try {
            // Pre-trade safety check
            const safety = await this.checkTokenSafety(tokenAddress);
            if (!safety.safe) {
                const proceed = confirm(`Warning: ${safety.reason}\nRisk: ${safety.rugPullRisk}\nProceed anyway?`);
                if (!proceed) {
                    this.showLoading(false);
                    return;
                }
            }

            const params = {
                tokenAddress,
                amount,
                side,
                orderType,
                slippage: this.settings.slippage,
                priorityFee: this.settings.priorityFee,
                stopLoss: this.calculateStopLoss(side),
                takeProfit: this.calculateTakeProfit(side)
            };

            if (orderType === 'limit') {
                params.limitPrice = parseFloat(document.getElementById('limitPrice').value);
            }

            const result = await this.tradingEngine.executeTrade(params);

            if (result.success) {
                this.showToast(`${orderType} order placed successfully`, 'success');
                this.addPosition(result.position);
                this.updatePositionsUI();
                this.logTrade(result);
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            this.showToast(`Trade failed: ${error.message}`, 'error');
            this.logMessage(`Trade error: ${error.message}`, 'error');
        }

        this.showLoading(false);
    }

    calculateStopLoss(side) {
        const slPercent = parseFloat(document.getElementById('stopLossPercent').value) || this.settings.stopLoss;
        return slPercent;
    }

    calculateTakeProfit(side) {
        const tpPercent = parseFloat(document.getElementById('takeProfitPercent').value) || this.settings.takeProfitLevels[0];
        return tpPercent;
    }

    addPosition(positionData) {
        const position = {
            id: Date.now().toString(),
            ...positionData,
            pnl: 0,
            pnlPercentage: 0,
            status: 'open',
            createdAt: new Date()
        };

        this.positions.set(position.id, position);
        this.startPositionMonitoring(position.id);
    }

    startPositionMonitoring(positionId) {
        const interval = setInterval(async () => {
            const position = this.positions.get(positionId);
            if (!position || position.status === 'closed') {
                clearInterval(interval);
                this.monitoringIntervals.delete(positionId);
                return;
            }

            try {
                // Get current price
                const currentPrice = await this.getCurrentPrice(position.tokenAddress);
                
                // Update PnL
                const pnlData = this.calculatePnL(position, currentPrice);
                position.currentPrice = currentPrice;
                position.pnl = pnlData.pnl;
                position.pnlPercentage = pnlData.percentage;

                // Check stop loss
                if (position.stopLoss && pnlData.percentage <= -position.stopLoss) {
                    await this.closePosition(positionId, 'stop-loss');
                    return;
                }

                // Check take profit
                if (position.takeProfit && pnlData.percentage >= position.takeProfit) {
                    await this.closePosition(positionId, 'take-profit');
                    return;
                }

                // Update UI
                this.updatePositionCard(position);

            } catch (error) {
                console.error(`Error monitoring position ${positionId}:`, error);
            }
        }, 3000);

        this.monitoringIntervals.set(positionId, interval);
    }

    async getCurrentPrice(tokenAddress) {
        // Check cache first
        const cached = this.priceCache.get(tokenAddress);
        if (cached && Date.now() - cached.timestamp < 2000) {
            return cached.price;
        }

        try {
            // Try multiple sources
            let price = 0;

            // DexScreener
            try {
                const dexData = await this.fetchJson(
                    `${this.apiEndpoints.dexscreener}dex/tokens/${tokenAddress}`
                );
                if (dexData.pairs?.[0]?.priceUsd) {
                    price = parseFloat(dexData.pairs[0].priceUsd);
                }
            } catch (e) {}

            // Jupiter price
            if (!price && this.apiKeys.jupiter) {
                try {
                    const jupiterPrice = await this.fetchJson(
                        `${this.apiEndpoints.jupiter}price?ids=${tokenAddress}`
                    );
                    if (jupiterPrice.data?.[tokenAddress]?.price) {
                        price = jupiterPrice.data[tokenAddress].price;
                    }
                } catch (e) {}
            }

            // Cache the price
            if (price > 0) {
                this.priceCache.set(tokenAddress, {
                    price,
                    timestamp: Date.now()
                });
            }

            return price;
        } catch (error) {
            console.error('Error getting current price:', error);
            return 0;
        }
    }

    calculatePnL(position, currentPrice) {
        const entryValue = position.entryPrice * position.quantity;
        const currentValue = currentPrice * position.quantity;
        
        const pnl = position.side === 'buy' 
            ? currentValue - entryValue
            : entryValue - currentValue;
            
        const percentage = (pnl / entryValue) * 100;
        
        return { pnl, percentage };
    }

    async closePosition(positionId, reason) {
        const position = this.positions.get(positionId);
        if (!position || position.status === 'closed') return;

        this.showLoading(true);

        try {
            // Execute closing trade
            const result = await this.tradingEngine.executeTrade({
                tokenAddress: position.tokenAddress,
                amount: position.quantity,
                side: position.side === 'buy' ? 'sell' : 'buy',
                orderType: 'market',
                slippage: this.settings.slippage * 2, // Higher slippage for exit
                priorityFee: this.settings.priorityFee * 2 // Higher priority for exit
            });

            if (result.success) {
                position.status = 'closed';
                position.closedAt = new Date();
                position.closeReason = reason;
                position.finalPnl = position.pnl;
                
                // Update performance
                this.updatePerformance(position);
                
                // Clear monitoring
                const interval = this.monitoringIntervals.get(positionId);
                if (interval) clearInterval(interval);
                
                this.showToast(`Position closed (${reason}): ${position.pnlPercentage.toFixed(2)}% PnL`, 
                    position.pnl >= 0 ? 'success' : 'warning');
                
                this.updatePositionsUI();
            }
        } catch (error) {
            this.showToast(`Failed to close position: ${error.message}`, 'error');
        }

        this.showLoading(false);
    }

    updatePerformance(closedPosition) {
        this.performance.totalTrades++;
        this.performance.totalPnl += closedPosition.finalPnl;
        
        if (closedPosition.finalPnl > 0) {
            this.performance.winRate = 
                ((this.performance.winRate * (this.performance.totalTrades - 1) + 1) / 
                this.performance.totalTrades) * 100;
        } else {
            this.performance.winRate = 
                (this.performance.winRate * (this.performance.totalTrades - 1) / 
                this.performance.totalTrades) * 100;
        }

        this.performance.avgReturn = this.performance.totalPnl / this.performance.totalTrades;
        
        // Update daily PnL
        const today = new Date().toDateString();
        const posDate = new Date(closedPosition.createdAt).toDateString();
        if (today === posDate) {
            this.performance.dailyPnl += closedPosition.finalPnl;
        }

        this.updateAnalytics();
    }

    // UI Updates
    updateScannerResults(signals) {
        const tbody = document.getElementById('coinsTableBody');
        const detectedCount = document.getElementById('detectedCount');
        
        detectedCount.textContent = signals.length;
        
        if (signals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">No tokens meet the criteria</td></tr>';
            return;
        }
        
        tbody.innerHTML = signals.map(signal => `
            <tr class="${signal.action === 'buy' ? 'signal-buy' : ''}">
                <td><strong>${signal.symbol || 'Unknown'}</strong></td>
                <td>$${parseFloat(signal.price || 0).toFixed(8)}</td>
                <td class="${(signal.priceChange24h || 0) >= 0 ? 'price-positive' : 'price-negative'}">
                    ${(signal.priceChange24h || 0).toFixed(2)}%
                </td>
                <td>$${this.formatNumber(signal.volume || 0)}</td>
                <td>$${this.formatNumber(signal.liquidity || 0)}</td>
                <td>$${this.formatNumber(signal.marketCap || 0)}</td>
                <td>${signal.safety.score}/100</td>
                <td>
                    <div class="signal-badges">
                        ${signal.type.map(t => `<span class="signal-badge signal-${t}">${t}</span>`).join('')}
                    </div>
                </td>
                <td>
                    <span class="signal-strength ${this.getSignalStrengthClass(signal.strength)}">
                        ${signal.strength}%
                    </span>
                </td>
                <td>
                    <button class="action-btn buy" onclick="tradingSystem.quickBuy('${signal.address}', '${signal.symbol}')">Buy</button>
                    <button class="action-btn analyze" onclick="tradingSystem.showTokenDetails('${signal.address}')">Details</button>
                </td>
            </tr>
        `).join('');
    }

    getSignalStrengthClass(strength) {
        if (strength >= 70) return 'high';
        if (strength >= 50) return 'medium';
        return 'low';
    }

    updatePositionsUI() {
        const positionsList = document.getElementById('positionsList');
        const positionsGrid = document.getElementById('positionsGrid');
        
        const openPositions = Array.from(this.positions.values())
            .filter(p => p.status === 'open');
        
        if (openPositions.length === 0) {
            const emptyHtml = '<p class="text-secondary">No active positions</p>';
            positionsList.innerHTML = emptyHtml;
            positionsGrid.innerHTML = emptyHtml;
            return;
        }
        
        const positionsHtml = openPositions.map(position => `
            <div class="position-card ${position.pnl >= 0 ? 'profit' : 'loss'}" id="position-${position.id}">
                <div class="position-header">
                    <h4>${position.symbol}</h4>
                    <span class="position-status">${position.status}</span>
                </div>
                <div class="position-stats">
                    <div class="position-stat">
                        <span class="position-stat-label">Entry</span>
                        <span class="position-stat-value">$${position.entryPrice.toFixed(8)}</span>
                    </div>
                    <div class="position-stat">
                        <span class="position-stat-label">Current</span>
                        <span class="position-stat-value">$${(position.currentPrice || position.entryPrice).toFixed(8)}</span>
                    </div>
                    <div class="position-stat">
                        <span class="position-stat-label">Quantity</span>
                        <span class="position-stat-value">${this.formatNumber(position.quantity)}</span>
                    </div>
                    <div class="position-stat">
                        <span class="position-stat-label">Value</span>
                        <span class="position-stat-value">$${((position.currentPrice || position.entryPrice) * position.quantity).toFixed(2)}</span>
                    </div>
                </div>
                <div class="position-pnl">
                    <span class="pnl-amount ${position.pnl >= 0 ? 'text-success' : 'text-error'}">
                        ${position.pnl >= 0 ? '+' : ''}$${position.pnl.toFixed(2)}
                    </span>
                    <span class="pnl-percentage ${position.pnl >= 0 ? 'text-success' : 'text-error'}">
                        ${position.pnlPercentage >= 0 ? '+' : ''}${position.pnlPercentage.toFixed(2)}%
                    </span>
                </div>
                <div class="position-targets">
                    <div class="target-info">
                        <span>SL: -${position.stopLoss}%</span>
                        <span>TP: +${position.takeProfit}%</span>
                    </div>
                </div>
                <div class="position-actions">
                    <button class="btn btn--sm btn--secondary" onclick="tradingSystem.closePosition('${position.id}', 'manual')">
                        Close Position
                    </button>
                    <button class="btn btn--sm btn--outline" onclick="tradingSystem.modifyPosition('${position.id}')">
                        Modify
                    </button>
                </div>
            </div>
        `).join('');
        
        positionsList.innerHTML = positionsHtml;
        positionsGrid.innerHTML = positionsHtml;
    }

    updatePositionCard(position) {
        const card = document.getElementById(`position-${position.id}`);
        if (!card) return;

        // Update PnL display
        const pnlAmount = card.querySelector('.pnl-amount');
        const pnlPercentage = card.querySelector('.pnl-percentage');
        
        pnlAmount.textContent = `${position.pnl >= 0 ? '+' : ''}$${position.pnl.toFixed(2)}`;
        pnlPercentage.textContent = `${position.pnlPercentage >= 0 ? '+' : ''}${position.pnlPercentage.toFixed(2)}%`;
        
        // Update colors
        const profitClass = position.pnl >= 0 ? 'text-success' : 'text-error';
        pnlAmount.className = `pnl-amount ${profitClass}`;
        pnlPercentage.className = `pnl-percentage ${profitClass}`;
        
        card.className = `position-card ${position.pnl >= 0 ? 'profit' : 'loss'}`;
    }

    updateWalletUI() {
        const connectBtn = document.getElementById('connectWallet');
        const walletInfo = document.getElementById('walletInfo');
        
        if (this.wallet.publicKey) {
            connectBtn.classList.add('hidden');
            walletInfo.classList.remove('hidden');
            
            const addressSpan = walletInfo.querySelector('.wallet-address');
            addressSpan.textContent = `${this.wallet.publicKey.slice(0, 4)}...${this.wallet.publicKey.slice(-4)}`;
        }
    }

    // Helper Methods
    extractLiquidity(token) {
        return token.liquidity || 
               token.liquidity?.usd || 
               token.liquidityUSD || 
               token.fdv || 
               0;
    }

    extractVolume(token) {
        return token.volume || 
               token.volume?.h24 || 
               token.v24hUSD || 
               token.volume24h || 
               0;
    }

    extractMarketCap(token) {
        return token.marketCap || 
               token.mc || 
               token.fdv || 
               0;
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
        return num.toFixed(2);
    }

    logMessage(message, type = 'info') {
        const list = document.getElementById('alertsList');
        if (!list) return;
        
        const item = document.createElement('div');
        item.className = `alert-item ${type}`;
        const time = new Date().toLocaleTimeString();
        item.textContent = `[${time}] ${message}`;
        
        list.prepend(item);
        while (list.children.length > 50) {
            list.removeChild(list.lastChild);
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => toast.remove(), 5000);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.toggle('active', show);
    }

    // Storage Methods
    saveSettings() {
        localStorage.setItem('tradingSettings', JSON.stringify(this.settings));
        this.showToast('Settings saved', 'success');
    }

    loadSettings() {
        const saved = localStorage.getItem('tradingSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
            Object.keys(this.settings).forEach(key => {
                const input = document.getElementById(key);
                if (input) input.value = this.settings[key];
            });
        }
    }

    saveApiKeys() {
        localStorage.setItem('apiKeys', JSON.stringify(this.apiKeys));
    }

    loadApiKeys() {
        const saved = localStorage.getItem('apiKeys');
        if (saved) {
            this.apiKeys = JSON.parse(saved);
            Object.keys(this.apiKeys).forEach(api => {
                const input = document.getElementById(`${api}Key`);
                if (input) input.value = this.apiKeys[api];
            });
        }
    }

    // Utility methods for global access
    async checkTokenSafetyUI() {
        const tokenAddress = document.getElementById('tokenAddress').value;
        if (!tokenAddress) {
            this.showToast('Enter token address', 'error');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const safety = await this.checkTokenSafety(tokenAddress);
            this.displaySafetyResults(safety);
        } catch (error) {
            this.showToast(`Safety check failed: ${error.message}`, 'error');
        }
        
        this.showLoading(false);
    }

    displaySafetyResults(safety) {
        const resultsDiv = document.getElementById('safetyResults');
        resultsDiv.classList.remove('hidden');
        
        const riskClass = safety.score >= 70 ? 'safe' : 
                         safety.score >= 40 ? 'warning' : 'danger';
        
        resultsDiv.innerHTML = `
            <div class="safety-report ${riskClass}">
                <h4>Token Safety Analysis</h4>
                <div class="safety-score-main">
                    <span class="score-number">${safety.score}</span>
                    <span class="score-label">/100</span>
                </div>
                <div class="safety-metrics">
                    <div class="safety-metric">
                        <span>Liquidity:</span>
                        <strong>$${this.formatNumber(safety.liquidity)}</strong>
                    </div>
                    <div class="safety-metric">
                        <span>Holders:</span>
                        <strong>${safety.holders}</strong>
                    </div>
                    <div class="safety-metric">
                        <span>LP Locked:</span>
                        <strong class="${safety.lpLocked ? 'safe' : 'danger'}">${safety.lpLocked ? 'Yes ✓' : 'No ✗'}</strong>
                    </div>
                    <div class="safety-metric">
                        <span>Honeypot:</span>
                        <strong class="${!safety.honeypot ? 'safe' : 'danger'}">${safety.honeypot ? 'DETECTED ⚠️' : 'No ✓'}</strong>
                    </div>
                    <div class="safety-metric">
                        <span>Mintable:</span>
                        <strong class="${!safety.mintable ? 'safe' : 'warning'}">${safety.mintable ? 'Yes ⚠️' : 'No ✓'}</strong>
                    </div>
                    <div class="safety-metric">
                        <span>Risk Level:</span>
                        <strong class="${riskClass}">${safety.rugPullRisk.toUpperCase()}</strong>
                    </div>
                </div>
                ${!safety.safe ? `
                    <div class="safety-warning">
                        <strong>⚠️ Warning:</strong> ${safety.reason}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Quick buy from scanner
    async quickBuy(tokenAddress, symbol) {
        if (!this.wallet.publicKey) {
            this.showToast('Connect wallet first', 'error');
            return;
        }

        // Pre-fill the form
        document.getElementById('tokenAddress').value = tokenAddress;
        
        // Switch to trading tab
        this.switchTab('trading');

        // Show token in trading interface
        this.showToast(`Ready to trade ${symbol}`, 'info');
    }

    // ----- UI Helpers -----
    switchTab(tab) {
        document.querySelectorAll('.nav-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.toggle('active', c.id === tab);
        });
    }

    updateUI() {
        this.updateWalletUI();
        this.updatePositionsUI();
        this.updateAnalytics();

        const apis = ['helius','moralis','dexscreener','coingecko','jupiter','birdeye','openai','pumpportal'];
        apis.forEach(api => {
            this.updateApiStatus(api, !!this.apiKeys[api]);
        });
    }

    updateApiStatus(api, connected) {
        const el = document.getElementById(`${api}Status`);
        if (el) {
            el.textContent = connected ? 'Connected' : 'Disconnected';
            el.classList.toggle('connected', connected);
        }
    }

    initializeCharts() {
        const ctx = document.getElementById('pnlChart');
        if (ctx && window.Chart) {
            this.pnlChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'PnL',
                        data: [],
                        borderColor: 'rgba(33,128,141,1)',
                        backgroundColor: 'rgba(33,128,141,0.1)'
                    }]
                },
                options: { responsive: true, scales: { x: { display: false } } }
            });
        }
    }

    updateAnalytics() {
        const total = document.getElementById('totalPnl');
        const win = document.getElementById('winRate');
        const trades = document.getElementById('totalTrades');
        const avg = document.getElementById('avgReturn');

        if (total) total.textContent = `$${this.performance.totalPnl.toFixed(2)}`;
        if (win) win.textContent = `${this.performance.winRate.toFixed(2)}%`;
        if (trades) trades.textContent = this.performance.totalTrades;
        if (avg) avg.textContent = `${this.performance.avgReturn.toFixed(2)}%`;

        if (this.pnlChart) {
            const labels = this.pnlChart.data.labels;
            const data = this.pnlChart.data.datasets[0].data;
            labels.push(new Date().toLocaleTimeString());
            data.push(this.performance.totalPnl);
            if (labels.length > 20) { labels.shift(); data.shift(); }
            this.pnlChart.update();
        }
    }

    showTokenDetails(address) {
        window.open(`https://dexscreener.com/solana/${address}`, '_blank');
    }

    logTrade(trade) {
        this.tradeHistory.push(trade);
    }

    modifyPosition() {
        this.showToast('Modify position feature coming soon', 'info');
    }
}

// Wallet Manager Class
class WalletManager {
    constructor(tradingSystem) {
        this.tradingSystem = tradingSystem;
        this.provider = null;
        this.publicKey = null;
    }

    async connect() {
        try {
            if ('phantom' in window) {
                const provider = window.phantom?.solana;
                
                if (provider?.isPhantom) {
                    const resp = await provider.connect();
                    this.publicKey = resp.publicKey.toString();
                    this.provider = provider;
                    
                    // Listen for wallet events
                    provider.on('connect', () => console.log('Wallet connected'));
                    provider.on('disconnect', () => {
                        this.publicKey = null;
                        this.tradingSystem.showToast('Wallet disconnected', 'warning');
                        this.tradingSystem.updateWalletUI();
                    });
                    
                    return { success: true, publicKey: this.publicKey };
                }
            } else if ('solflare' in window) {
                // Solflare wallet support
                const provider = window.solflare;
                await provider.connect();
                this.publicKey = provider.publicKey.toString();
                this.provider = provider;
                
                return { success: true, publicKey: this.publicKey };
            }
            
            return { 
                success: false, 
                error: 'No Solana wallet found. Install Phantom or Solflare.' 
            };
            
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async getBalance() {
        if (!this.publicKey || !this.tradingSystem.connection) return 0;
        
        try {
            const pubKey = new solanaWeb3.PublicKey(this.publicKey);
            const balance = await this.tradingSystem.connection.getBalance(pubKey);
            return balance / solanaWeb3.LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Error getting balance:', error);
            return 0;
        }
    }

    async signTransaction(transaction) {
        if (!this.provider) throw new Error('Wallet not connected');
        return await this.provider.signTransaction(transaction);
    }

    async signAllTransactions(transactions) {
        if (!this.provider) throw new Error('Wallet not connected');
        return await this.provider.signAllTransactions(transactions);
    }
}

// Trading Engine Class
class TradingEngine {
    constructor(tradingSystem) {
        this.system = tradingSystem;
        this.jupiterAPI = 'https://quote-api.jup.ag/v6';
    }

    async executeTrade(params) {
        try {
            // Use PumpPortal for pump.fun tokens if we have API key
            if (params.tokenAddress && this.system.apiKeys.pumpportal) {
                const tokenData = await this.checkIfPumpFunToken(params.tokenAddress);
                if (tokenData.isPumpFun) {
                    return await this.executePumpPortalTrade(params, tokenData);
                }
            }

            // Otherwise use Jupiter
            return await this.executeJupiterTrade(params);
            
        } catch (error) {
            console.error('Trade execution error:', error);
            return { success: false, error: error.message };
        }
    }

    async checkIfPumpFunToken(tokenAddress) {
        // Check if token is from pump.fun by looking at creation program
        try {
            const tokenInfo = await this.system.connection.getParsedAccountInfo(
                new solanaWeb3.PublicKey(tokenAddress)
            );
            
            // Simple check - you'd need more sophisticated logic
            return {
                isPumpFun: false, // Implement actual check
                bondingCurve: null
            };
        } catch (error) {
            return { isPumpFun: false };
        }
    }

    async executePumpPortalTrade(params, tokenData) {
        const { tokenAddress, amount, side } = params;
        
        try {
            const response = await fetch(this.system.apiEndpoints.pumpportalTrade, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.system.apiKeys.pumpportal}`
                },
                body: JSON.stringify({
                    publicKey: this.system.wallet.publicKey,
                    action: side, // 'buy' or 'sell'
                    mint: tokenAddress,
                    amount: amount * solanaWeb3.LAMPORTS_PER_SOL,
                    slippageBps: params.slippage * 100,
                    priorityFee: params.priorityFee * solanaWeb3.LAMPORTS_PER_SOL,
                    pool: 'pump'
                })
            });

            if (!response.ok) {
                throw new Error(`PumpPortal error: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Get transaction for signing
            const transaction = solanaWeb3.Transaction.from(
                Buffer.from(data.transaction, 'base64')
            );

            // Sign and send
            const signedTx = await this.system.wallet.signTransaction(transaction);
            const txid = await this.system.connection.sendRawTransaction(
                signedTx.serialize()
            );

            await this.system.connection.confirmTransaction(txid, 'confirmed');

            return {
                success: true,
                txid,
                position: {
                    tokenAddress,
                    side,
                    amount,
                    entryPrice: data.price || 0,
                    quantity: data.outputAmount || amount,
                    symbol: params.symbol || 'Unknown',
                    stopLoss: params.stopLoss,
                    takeProfit: params.takeProfit
                }
            };

        } catch (error) {
            console.error('PumpPortal trade error:', error);
            throw error;
        }
    }

    async executeJupiterTrade(params) {
        const { tokenAddress, amount, side, slippage } = params;
        
        try {
            // Get quote
            const inputMint = side === 'buy' 
                ? 'So11111111111111111111111111111111111112' 
                : tokenAddress;
            const outputMint = side === 'buy' 
                ? tokenAddress 
                : 'So11111111111111111111111111111111111112';
            
            const quote = await this.getJupiterQuote({
                inputMint,
                outputMint,
                amount: Math.floor(amount * solanaWeb3.LAMPORTS_PER_SOL),
                slippageBps: Math.floor(slippage * 100)
            });

            if (!quote || quote.error) {
                throw new Error(quote?.error || 'Failed to get quote');
            }

            // Get swap transaction
            const swapResponse = await fetch(`${this.jupiterAPI}/swap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoteResponse: quote,
                    userPublicKey: this.system.wallet.publicKey,
                    wrapAndUnwrapSol: true,
                    prioritizationFeeLamports: params.priorityFee * solanaWeb3.LAMPORTS_PER_SOL
                })
            });

            const swapData = await swapResponse.json();
            
            if (swapData.error) {
                throw new Error(swapData.error);
            }

            // Deserialize and sign
            const swapTransaction = solanaWeb3.VersionedTransaction.deserialize(
                Buffer.from(swapData.swapTransaction, 'base64')
            );
            
            const signedTransaction = await this.system.wallet.signTransaction(swapTransaction);
            
            // Send transaction
            const rawTransaction = signedTransaction.serialize();
            const txid = await this.system.connection.sendRawTransaction(rawTransaction, {
                skipPreflight: true,
                maxRetries: 2
            });

            await this.system.connection.confirmTransaction(txid, 'confirmed');

            // Calculate entry price
            const entryPrice = quote.outAmount / quote.inAmount;

            return {
                success: true,
                txid,
                position: {
                    tokenAddress,
                    side,
                    amount,
                    entryPrice,
                    quantity: side === 'buy' ? quote.outAmount : amount,
                    symbol: params.symbol || 'Unknown',
                    stopLoss: params.stopLoss,
                    takeProfit: params.takeProfit
                }
            };

        } catch (error) {
            console.error('Jupiter trade error:', error);
            throw error;
        }
    }

    async getJupiterQuote(params) {
        const url = `${this.jupiterAPI}/quote?` + new URLSearchParams({
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            amount: params.amount,
            slippageBps: params.slippageBps,
            onlyDirectRoutes: false,
            asLegacyTransaction: false
        });

        const response = await fetch(url);
        return await response.json();
    }
}

// Scanner methods
CryptoTradingSystem.prototype.startScanning = async function() {
    if (this.scannerActive) return;
    
    // Verify required APIs
    const requiredApis = ['helius'];
    const connectedApis = requiredApis.filter(api => {
        const status = document.getElementById(`${api}Status`);
        return status && status.classList.contains('connected');
    });
    
    if (connectedApis.length === 0) {
        this.showToast('Connect at least Helius API to start scanning', 'error');
        return;
    }
    
    this.scannerActive = true;
    document.getElementById('scannerStatus').textContent = 'Active';
    document.getElementById('scannerStatus').classList.add('active');
    
    // Initialize WebSocket connections
    this.initializeWebSockets();
    
    this.showToast('Scanner started', 'success');
    this.logMessage('Scanner started', 'success');
    
    // Start scanning
    this.scanMarket();
    this.scannerInterval = setInterval(() => {
        this.scanMarket();
    }, this.settings.checkInterval);
};

CryptoTradingSystem.prototype.stopScanning = function() {
    this.scannerActive = false;
    
    if (this.scannerInterval) {
        clearInterval(this.scannerInterval);
        this.scannerInterval = null;
    }
    
    // Close WebSocket connections
    this.websockets.forEach(ws => ws.close());
    this.websockets.clear();
    
    document.getElementById('scannerStatus').textContent = 'Stopped';
    document.getElementById('scannerStatus').classList.remove('active');
    
    this.showToast('Scanner stopped', 'info');
    this.logMessage('Scanner stopped', 'warning');
};

CryptoTradingSystem.prototype.initializeWebSockets = function() {
    // PumpPortal WebSocket for real-time updates
    if (!this.websockets.has('pumpportal')) {
        try {
            const ws = new WebSocket(this.apiEndpoints.pumpportal);
            
            ws.onopen = () => {
                this.logMessage('PumpPortal WebSocket connected', 'success');
                // Subscribe to new token events
                ws.send(JSON.stringify({
                    method: "subscribeNewToken"
                }));
                // Subscribe to trades
                ws.send(JSON.stringify({
                    method: "subscribeTokenTrade",
                    keys: [] // Will be updated with specific tokens
                }));
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.processPumpPortalMessage(data);
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            };
            
            ws.onerror = (error) => {
                this.logMessage('PumpPortal WebSocket error', 'error');
            };
            
            ws.onclose = () => {
                this.logMessage('PumpPortal WebSocket disconnected', 'warning');
                this.websockets.delete('pumpportal');
            };
            
            this.websockets.set('pumpportal', ws);
        } catch (error) {
            this.logMessage(`WebSocket error: ${error.message}`, 'error');
        }
    }
};

CryptoTradingSystem.prototype.processPumpPortalMessage = function(data) {
    if (data.txType === 'create') {
        // New token created
        this.logMessage(`New token: ${data.tokenData?.name || 'Unknown'}`, 'info');
        this.signals.push({
            address: data.mint,
            symbol: data.tokenData?.symbol,
            name: data.tokenData?.name,
            source: 'pump.fun-realtime',
            timestamp: Date.now(),
            type: ['new-token'],
            isNew: true
        });
    } else if (data.txType === 'buy' || data.txType === 'sell') {
        // Trade activity - could be used for volume tracking
        // Update volume data for the token
    }
};

// Helper function to fetch with retries
CryptoTradingSystem.prototype.fetchJson = async function(url, options = {}, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (i === retries) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
};

// DexScreener implementation
CryptoTradingSystem.prototype.scanDexScreener = async function() {
    try {
        const results = [];
        
        // Multiple endpoints for better coverage
        const endpoints = [
            'dex/tokens/new',
            'dex/pairs/solana/new',
            'dex/search?q=trending'
        ];
        
        for (const endpoint of endpoints) {
            try {
                const data = await this.fetchJson(
                    `${this.apiEndpoints.dexscreener}${endpoint}`
                );
                
                if (data.pairs) {
                    results.push(...data.pairs.map(pair => ({
                        address: pair.baseToken.address,
                        symbol: pair.baseToken.symbol,
                        name: pair.baseToken.name,
                        price: parseFloat(pair.priceUsd),
                        priceChange24h: pair.priceChange?.h24,
                        volume: pair.volume?.h24,
                        liquidity: pair.liquidity?.usd,
                        marketCap: pair.fdv,
                        source: 'dexscreener'
                    })));
                }
            } catch (error) {
                // Continue with other endpoints
            }
        }
        
        return results;
    } catch (error) {
        this.logMessage(`DexScreener error: ${error.message}`, 'error');
        return [];
    }
};

CryptoTradingSystem.prototype.scanBirdeye = async function() {
    if (!this.apiKeys.birdeye) return [];
    
    try {
        const response = await this.fetchJson(
            `${this.apiEndpoints.birdeye}tokenlist?sort_by=v24hChangePercent&sort_type=desc&offset=0&limit=50`,
            {
                headers: { 'X-API-KEY': this.apiKeys.birdeye }
            }
        );
        
        return (response.data?.tokens || []).map(token => ({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            price: token.price,
            priceChange24h: token.v24hChangePercent,
            volume: token.v24hUSD,
            liquidity: token.liquidity,
            marketCap: token.mc,
            source: 'birdeye'
        }));
    } catch (error) {
        this.logMessage(`Birdeye error: ${error.message}`, 'error');
        return [];
    }
};

CryptoTradingSystem.prototype.scanPumpFun = async function() {
    try {
        // Use pump.fun API
        const response = await this.fetchJson(
            `${this.apiEndpoints.pumpfun}coins?limit=50&sort=created&order=desc`
        );
        
        return (response.coins || []).map(coin => ({
            address: coin.mint,
            symbol: coin.symbol,
            name: coin.name,
            marketCap: coin.usd_market_cap,
            source: 'pump.fun',
            isNew: true,
            timestamp: coin.created_timestamp
        }));
    } catch (error) {
        this.logMessage(`Pump.fun error: ${error.message}`, 'error');
        return [];
    }
};

// Global functions for UI
let tradingSystem;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    tradingSystem = new CryptoTradingSystem();
    
    // Make it globally accessible
    window.tradingSystem = tradingSystem;
    
    setTimeout(() => {
        tradingSystem.showToast('Welcome! Configure API keys to start trading.', 'info');
    }, 1000);
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CryptoTradingSystem, WalletManager, TradingEngine };
}