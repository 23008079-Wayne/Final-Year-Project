const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY_HERE');
const db = require('../db');

// Mock stock prices (in real app, fetch from API)
const stockPrices = {
  'AAPL': 248.50,
  'GOOGL': 195.75,
  'MSFT': 445.30,
  'TSLA': 287.65,
  'JNJ': 185.20,
  'JPM': 225.40
};

// Get user portfolio from database
async function getPortfolio(req, res) {
  try {
    const userId = req.query.userId || req.user?.userId;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    // Get all holdings for this user
    const holdings = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM user_holdings WHERE userId = ?', [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results || []);
      });
    });

    const holdingsWithValues = {};
    let totalValue = 0;

    for (const holding of holdings) {
      const currentPrice = stockPrices[holding.symbol] || 0;
      const value = holding.qty * currentPrice;
      holdingsWithValues[holding.symbol] = {
        qty: holding.qty,
        avgPrice: holding.avgPrice,
        currentPrice: currentPrice,
        value: value
      };
      totalValue += value;
    }

    // Get account cash balance
    const accountResult = await new Promise((resolve, reject) => {
      db.query('SELECT balance FROM accounts WHERE userId = ? LIMIT 1', [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results?.[0] || { balance: 10000 });
      });
    });

    const cash = accountResult.balance || 10000;

    res.json({
      userId,
      cash: cash,
      holdings: holdingsWithValues,
      totalValue: totalValue + cash,
      portfolioValue: totalValue,
      transactions: holdings
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: error.message });
  }
}

// Get transaction history
async function getTransactions(req, res) {
  try {
    const userId = req.query.userId || req.user?.userId;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const transactions = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM stock_transactions WHERE userId = ? ORDER BY created_at DESC', [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results || []);
      });
    });

    res.json({
      userId,
      transactions: transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
}

// Get stock price
function getStockPrice(req, res) {
  const { symbol } = req.params;
  
  if (!stockPrices[symbol]) {
    return res.status(404).json({ error: "Stock not found" });
  }

  res.json({
    symbol: symbol,
    price: stockPrices[symbol],
    timestamp: new Date().toISOString()
  });
}

// Get live stock price from Finnhub API with API key
async function getLiveStockPrice(req, res) {
  const { symbol } = req.params;
  
  if (!symbol) {
    return res.status(400).json({ error: "Symbol is required" });
  }

  try {
    const axios = require('axios');
    const symbol_upper = symbol.toUpperCase();
    const finnhubKey = process.env.FINNHUB_API_KEY;
    
    if (!finnhubKey) {
      console.warn('⚠️  FINNHUB_API_KEY not set in .env file');
    }
    
    // Use Finnhub API with API key
    try {
      const response = await axios.get(`https://finnhub.io/api/v1/quote`, {
        params: {
          symbol: symbol_upper,
          token: finnhubKey
        },
        timeout: 5000
      });
      
      if (response.data?.c && response.data.c > 0) {
        return res.json({
          symbol: symbol_upper,
          price: response.data.c,
          name: symbol_upper,
          currency: 'USD',
          timestamp: new Date().toISOString(),
          source: 'finnhub'
        });
      }
    } catch (finnhubError) {
      console.error(`Finnhub API error for ${symbol_upper}:`, finnhubError.message);
    }
    
    // Fallback to hardcoded price if available
    if (stockPrices[symbol_upper]) {
      return res.json({
        symbol: symbol_upper,
        price: stockPrices[symbol_upper],
        name: symbol_upper,
        currency: 'USD',
        timestamp: new Date().toISOString(),
        source: 'cached'
      });
    }
    
    res.status(404).json({ error: "Stock not found", symbol: symbol_upper });
  } catch (error) {
    const errorMessage = error.message || error.toString();
    console.error(`Error fetching live price for ${symbol}:`, errorMessage);
    
    // Final fallback: return cached price if available
    if (stockPrices[symbol.toUpperCase()]) {
      return res.json({
        symbol: symbol.toUpperCase(),
        price: stockPrices[symbol.toUpperCase()],
        currency: 'USD',
        timestamp: new Date().toISOString(),
        source: 'cached'
      });
    }
    
    res.status(500).json({ 
      error: "Unable to fetch stock price. Using cached price if available.",
      symbol: symbol
    });
  }
}

// Comprehensive list of common stocks for autocomplete
const commonStocks = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'JPM', name: 'JPMorgan Chase' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'PG', name: 'Procter & Gamble' },
  { symbol: 'MCD', name: 'McDonald\'s Corporation' },
  { symbol: 'DIS', name: 'The Walt Disney Company' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'SPOT', name: 'Spotify Technology' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'QCOM', name: 'Qualcomm Inc.' },
  { symbol: 'F', name: 'Ford Motor Company' },
  { symbol: 'GM', name: 'General Motors' },
  { symbol: 'UBER', name: 'Uber Technologies' },
  { symbol: 'LYFT', name: 'Lyft Inc.' },
  { symbol: 'COIN', name: 'Coinbase Global' }
];

// Search for stocks by query (symbol or name)
async function searchStocks(req, res) {
  const { query } = req.query;
  
  if (!query || query.length < 1) {
    return res.json({ results: commonStocks.slice(0, 10) });
  }

  try {
    const axios = require('axios');
    const query_upper = query.toUpperCase();
    const finnhubKey = process.env.FINNHUB_API_KEY;
    
    // Filter common stocks first (instant autocomplete)
    const autocompleteResults = commonStocks
      .filter(stock => 
        stock.symbol.startsWith(query_upper) || 
        stock.name.toUpperCase().includes(query_upper)
      )
      .slice(0, 8);
    
    // Try to get prices for results using Finnhub
    const resultsWithPrices = await Promise.all(
      autocompleteResults.map(async (stock) => {
        try {
          const priceResponse = await axios.get(`https://finnhub.io/api/v1/quote`, {
            params: { 
              symbol: stock.symbol,
              token: finnhubKey
            },
            timeout: 3000
          });
          
          const price = priceResponse.data?.c || stockPrices[stock.symbol] || 'Loading...';
          return {
            symbol: stock.symbol,
            name: stock.name,
            price: price
          };
        } catch (err) {
          return {
            symbol: stock.symbol,
            name: stock.name,
            price: stockPrices[stock.symbol] || 'N/A'
          };
        }
      })
    );
    
    res.json({ results: resultsWithPrices });
  } catch (error) {
    console.error(`Error in searchStocks:`, error.message);
    // Return common stocks on error
    const filtered = commonStocks
      .filter(s => s.symbol.includes(query.toUpperCase()) || s.name.toUpperCase().includes(query.toUpperCase()))
      .slice(0, 8);
    
    res.json({ results: filtered.length > 0 ? filtered : commonStocks.slice(0, 5) });
  }
}

// Create checkout session for buying stock
async function createCheckoutSession(req, res) {
  const { symbol, shares, userId } = req.body;
  
  if (!symbol || !shares || shares <= 0) {
    return res.status(400).json({ error: "Invalid symbol or shares" });
  }

  const user = userId || 'default_user';
  
  if (!userPortfolio[user]) {
    userPortfolio[user] = {
      cash: 10000,
      holdings: {},
      transactions: []
    };
  }

  try {
    // Try to get live price first, fall back to hardcoded if fails
    let price = null;
    const finnhubKey = process.env.FINNHUB_API_KEY;
    
    try {
      const axios = require('axios');
      const quoteResponse = await axios.get(`https://finnhub.io/api/v1/quote`, {
        params: { 
          symbol: symbol.toUpperCase(),
          token: finnhubKey
        },
        timeout: 5000
      });

      if (quoteResponse.data.c && quoteResponse.data.c > 0) {
        price = quoteResponse.data.c;
      }
    } catch (error) {
      // Fall back to hardcoded prices
      price = stockPrices[symbol];
    }

    if (!price) {
      return res.status(404).json({ error: "Stock not found" });
    }

    const totalPrice = price * shares * 100; // Stripe uses cents

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${symbol} - ${shares} shares @ $${price.toFixed(2)}`,
              description: `Purchase ${shares} shares of ${symbol}`
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: shares,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/payment-success?session_id={CHECKOUT_SESSION_ID}&symbol=${symbol}&shares=${shares}&userId=${user}`,
      cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/payment-cancelled`,
      metadata: {
        symbol: symbol,
        shares: shares,
        userId: user,
        type: 'stock_purchase'
      }
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Process successful payment and update portfolio in database
async function processPayment(req, res) {
  try {
    const { sessionId, symbol, shares, userId } = req.body;
    const user = userId || req.user?.userId;
    
    if (!user) {
      return res.status(400).json({ error: "User ID required" });
    }

    // Retrieve stripe session to verify payment
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: "Payment not completed" });
    }

    const price = stockPrices[symbol.toUpperCase()];
    const totalCost = price * parseInt(shares);

    // Check if user account exists, if not create it
    const checkAccount = await new Promise((resolve, reject) => {
      db.query('SELECT accountId, balance FROM accounts WHERE userId = ? LIMIT 1', [user], (err, results) => {
        if (err) reject(err);
        else resolve(results?.[0]);
      });
    });

    let accountId = checkAccount?.accountId;
    let currentBalance = checkAccount?.balance || 10000;

    if (!accountId) {
      // Create account if it doesn't exist
      const accountNumber = `ACC-${Date.now()}-${user}`;
      await new Promise((resolve, reject) => {
        db.query('INSERT INTO accounts (userId, accountNumber, balance) VALUES (?, ?, ?)', 
          [user, accountNumber, 10000], 
          (err) => {
            if (err) reject(err);
            else resolve();
          });
      });

      accountId = accountNumber;
      currentBalance = 10000;
    }

    // Check if user has enough cash
    if (currentBalance < totalCost) {
      return res.status(400).json({ error: "Insufficient cash" });
    }

    // Get or create holding for this stock
    const holding = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM user_holdings WHERE userId = ? AND symbol = ?', 
        [user, symbol.toUpperCase()], 
        (err, results) => {
          if (err) reject(err);
          else resolve(results?.[0]);
        });
    });

    if (holding) {
      // Update existing holding - calculate new average price
      const oldValue = holding.qty * holding.avgPrice;
      const newValue = parseInt(shares) * price;
      const newAvgPrice = (oldValue + newValue) / (holding.qty + parseInt(shares));

      await new Promise((resolve, reject) => {
        db.query('UPDATE user_holdings SET qty = qty + ?, avgPrice = ? WHERE userId = ? AND symbol = ?', 
          [parseInt(shares), newAvgPrice, user, symbol.toUpperCase()], 
          (err) => {
            if (err) reject(err);
            else resolve();
          });
      });
    } else {
      // Create new holding
      await new Promise((resolve, reject) => {
        db.query('INSERT INTO user_holdings (userId, symbol, qty, avgPrice) VALUES (?, ?, ?, ?)', 
          [user, symbol.toUpperCase(), parseInt(shares), price], 
          (err) => {
            if (err) reject(err);
            else resolve();
          });
      });
    }

    // Record transaction in stock_transactions
    await new Promise((resolve, reject) => {
      db.query('INSERT INTO stock_transactions (userId, symbol, txType, qty, price, dataSource, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())', 
        [user, symbol.toUpperCase(), 'BUY', parseInt(shares), price, 'stripe'], 
        (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    // Deduct cash from account
    await new Promise((resolve, reject) => {
      db.query('UPDATE accounts SET balance = balance - ? WHERE userId = ?', 
        [totalCost, user], 
        (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    console.log(`✅ Purchased ${shares} shares of ${symbol.toUpperCase()} for $${totalCost.toFixed(2)} - User: ${user}`);

    res.json({
      success: true,
      message: `Successfully purchased ${shares} shares of ${symbol}`,
      portfolio: {
        symbol: symbol.toUpperCase(),
        shares: parseInt(shares),
        price: price,
        total: totalCost
      }
    });
  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Sell shares (update portfolio and record transaction)
async function sellShares(req, res) {
  try {
    const { symbol, shares, userId } = req.body;
    
    if (!symbol || !shares || shares <= 0) {
      return res.status(400).json({ error: "Invalid symbol or shares" });
    }

    const user = userId || req.user?.userId;
    
    if (!user) {
      return res.status(400).json({ error: "User ID required" });
    }

    const price = stockPrices[symbol.toUpperCase()];
    
    if (!price) {
      return res.status(404).json({ error: "Stock not found" });
    }

    // Get current holding
    const holding = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM user_holdings WHERE userId = ? AND symbol = ?', 
        [user, symbol.toUpperCase()], 
        (err, results) => {
          if (err) reject(err);
          else resolve(results?.[0]);
        });
    });

    if (!holding || holding.qty < parseInt(shares)) {
      return res.status(400).json({ error: "Insufficient shares to sell" });
    }

    const totalProceeds = price * parseInt(shares);

    // Update holding or delete if zero
    if (holding.qty - parseInt(shares) <= 0) {
      await new Promise((resolve, reject) => {
        db.query('DELETE FROM user_holdings WHERE userId = ? AND symbol = ?', 
          [user, symbol.toUpperCase()], 
          (err) => {
            if (err) reject(err);
            else resolve();
          });
      });
    } else {
      await new Promise((resolve, reject) => {
        db.query('UPDATE user_holdings SET qty = qty - ? WHERE userId = ? AND symbol = ?', 
          [parseInt(shares), user, symbol.toUpperCase()], 
          (err) => {
            if (err) reject(err);
            else resolve();
          });
      });
    }

    // Record transaction
    await new Promise((resolve, reject) => {
      db.query('INSERT INTO stock_transactions (userId, symbol, txType, qty, price, dataSource, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())', 
        [user, symbol.toUpperCase(), 'SELL', parseInt(shares), price, 'manual'], 
        (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    // Add cash to account
    await new Promise((resolve, reject) => {
      db.query('UPDATE accounts SET balance = balance + ? WHERE userId = ?', 
        [totalProceeds, user], 
        (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    console.log(`✅ Sold ${shares} shares of ${symbol.toUpperCase()} for $${totalProceeds.toFixed(2)} - User: ${user}`);

    res.json({
      success: true,
      message: `Successfully sold ${shares} shares of ${symbol}`,
      proceeds: totalProceeds,
      portfolio: {
        symbol: symbol.toUpperCase(),
        shares: parseInt(shares),
        price: price,
        total: totalProceeds
      }
    });
  } catch (error) {
    console.error('Sell error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getPortfolio,
  getTransactions,
  getStockPrice,
  getLiveStockPrice,
  searchStocks,
  createCheckoutSession,
  processPayment,
  sellShares
};