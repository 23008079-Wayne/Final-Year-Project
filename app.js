/*
  STOCKAI TERMINAL – SERVER ENTRY POINT

  What this file does:
  - Express setup (EJS, static, session, flash)
  - Route wiring (GET/POST/DELETE) into controllers
  - Boot-time admin creation (optional)

  Notes:
  - This assumes Node 18+ (global fetch available). If not, install node-fetch.
  - Controllers are placed inside /controllers as you requested.
*/

"use strict";

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const bcrypt = require("bcrypt");
require("dotenv").config();

// Database
const db = require("./db");

// Existing controllers you already have
const authController = require("./controllers/authController");
const profileController = require("./controllers/profileController");
const adminController = require("./controllers/adminController");


const quoteController = require("./controllers/quoteController");
const apiController = require("./controllers/apiController");
const marketController = require("./controllers/marketController");
const portfolioController = require("./controllers/portfolioController");
const paperTradingController = require("./controllers/paperTradingController");
const watchlistController = require("./controllers/watchlistController");
const alertsController = require("./controllers/alertsController");
const { getCalendarEvents } = require("./controllers/economicCalendarController");
const newsController = require("./controllers/newsController");
const sentimentController = require("./controllers/sentimentController");


// Middleware
const { checkAuthenticated, checkAdmin } = require("./middleware/auth");
const upload = require("./middleware/upload");

const app = express();

/* Basic setup */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* Session + Flash */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "superSecretStockPortal",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax"
      // secure: true // enable when HTTPS
    }
  })
);

app.use(flash());

/* Content Security Policy - Allow PayPal and Stripe and TradingView*/
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://www.paypal.com https://js.stripe.com https://cdn.jsdelivr.net https://s3.tradingview.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data: https://fonts.gstatic.com; " +
    "connect-src 'self' https:; " +
    "frame-src 'self' https://www.paypal.com https://js.stripe.com https://s.tradingview.com https://www.tradingview.com; " +
    "frame-ancestors 'self';"
  );
  next();
});


/* Debug logging */
app.use((req, res, next) => {
  console.log(`HIT: ${req.method} ${req.url}`);
  next();
});

/* Globals for views */
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currentUser = req.session.user || null;
  next();
});

/* Check required env */
if (!process.env.FINNHUB_API_KEY) {
  console.error("FINNHUB_API_KEY is missing.");
  console.error("Add it to .env -> FINNHUB_API_KEY=your_key_here");
}

/*
  Boot-time helper: ensure one admin exists
  (Keeps your system usable even after fresh DB import)
*/
async function ensureAdminExists() {
  try {
    const [admins] = await db
      .promise()
      .query("SELECT userId FROM users WHERE roleId = 2 LIMIT 1");

    if (admins.length > 0) return;

    const hashed = await bcrypt.hash("Admin123!", 10);

    const [result] = await db
      .promise()
      .query(
        "INSERT INTO users (username, email, password, roleId) VALUES (?,?,?,2)",
        ["admin", "admin@stock.com", hashed]
      );

    await db
      .promise()
      .query(
        "INSERT INTO user_profiles (userId, fullName, bio) VALUES (?,?,?)",
        [result.insertId, "System Admin", "Auto-created admin"]
      );

    console.log("Default admin created: username=admin, password=Admin123!");
  } catch (err) {
    console.error("Error ensuring admin exists:", err?.message || err);
  }
}
ensureAdminExists();

/*
  Inject shared “quote tools” into controllers that need it.
  This avoids creating a “services” folder while still keeping controllers clean.
*/
apiController.init({ quoteController });
marketController.init({ quoteController });
portfolioController.init({ quoteController });



/* API routes */
app.get("/api/health", apiController.health);
app.get("/api/ticker", apiController.ticker);
app.get("/api/page-quotes", apiController.pageQuotes);
app.get("/api/news/:symbol", newsController.getNews);

/* Pages */
app.get("/", marketController.home);
app.get("/market", marketController.market);
app.get("/chart/:symbol", marketController.chart);

/* Portfolio (synced to logged-in user) */
app.get("/portfolio", checkAuthenticated, portfolioController.page);
app.get("/api/portfolio-live", checkAuthenticated, portfolioController.live);
app.get("/api/portfolio-history", checkAuthenticated, portfolioController.history);

app.get("/paper-trading", checkAuthenticated, paperTradingController.page);
app.post("/api/paper-trades", checkAuthenticated, paperTradingController.createTrade);
app.delete("/api/paper-holdings/:symbol", checkAuthenticated, paperTradingController.deleteHolding);
app.get("/api/paper-summary", checkAuthenticated, paperTradingController.summary);



// Holdings CRUD (Portfolio)
app.get("/api/holdings", checkAuthenticated, portfolioController.listHoldings);
app.post("/api/holdings", checkAuthenticated, portfolioController.createHolding);
app.put("/api/holdings/:symbol", checkAuthenticated, portfolioController.updateHolding);
app.delete("/api/holdings/:symbol", checkAuthenticated, portfolioController.deleteHolding);


/* News & Sentiment routes */
app.get("/api/news/:symbol", newsController.getNews);
app.post("/api/analyze-sentiment", sentimentController.analyzeText);
app.get("/api/analyze-sentiment", sentimentController.getMarketInsights);

/* Watchlist routes */
app.get("/watchlist", checkAuthenticated, watchlistController.getWatchlist);
app.post("/watchlist", checkAuthenticated, watchlistController.addToWatchlist);
app.delete("/watchlist/:symbol", checkAuthenticated, watchlistController.removeFromWatchlist);

// Watchlist JSON API endpoints
app.get("/api/watchlist", checkAuthenticated, watchlistController.getWatchlistApi);
app.post("/api/watchlist", checkAuthenticated, watchlistController.addToWatchlistApi);
app.put("/api/watchlist/:symbol", checkAuthenticated, watchlistController.updateWatchlistApi);
app.delete("/api/watchlist/:symbol", checkAuthenticated, watchlistController.removeFromWatchlistApi);

// Stock quote endpoint (PUBLIC - used by watchlist validation and price updates)
app.get("/api/quote/:symbol", quoteController.getQuote);

// Price alerts (tab + standalone)
app.get("/alerts", checkAuthenticated, alertsController.page);
app.get("/api/alerts", checkAuthenticated, alertsController.listAlerts);
app.post("/api/alerts", checkAuthenticated, alertsController.createAlert);
app.put("/api/alerts/:alertId", checkAuthenticated, alertsController.updateAlert);
app.delete("/api/alerts/:alertId", checkAuthenticated, alertsController.deleteAlert);

// Economic calendar API (tab)
app.get("/api/economic-calendar", getCalendarEvents);
/* Trade route */
app.get("/trade", checkAuthenticated, (req, res) => {
  res.render("trade", { title: "Trade", currentUser: res.locals.currentUser });
});

/* Auth routes (your existing controller) */
app.get("/register", authController.showRegister);
app.post("/register", authController.register);

app.get("/login", authController.showLogin);
app.post("/login", authController.login);

app.get("/logout", authController.logout);

/* Profile routes (your existing controller) */
app.get("/profile", checkAuthenticated, profileController.showProfile);
app.get("/profile/risk", checkAuthenticated, profileController.showRiskProfile);
app.get("/account", checkAuthenticated, profileController.showAccount);

/* Top Up / Wallet routes */
app.get("/topup", checkAuthenticated, (req, res) => {
  res.render("topup", { 
    title: "Top Up Wallet", 
    currentUser: res.locals.currentUser,
    paypalClientId: process.env.PAYPAL_CLIENT_ID || 'AVvUV4gQNa6rz3oZAoNqkf2CXbJpbDvn0Km5z-LqZcFCQC6Z_j0w8K8Jqv5kXc7KqWxL0wJlZnZ8JZJ'
  });
});

app.post("/api/topup", checkAuthenticated, async (req, res) => {
  const { amount, paymentMethod, transactionId, paymentMethodId } = req.body;
  const userId = req.session.user.userId;
  
  // Validation
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid amount. Minimum is $10' });
  }

  const numAmount = parseFloat(amount);
  if (numAmount < 10 || numAmount > 50000) {
    return res.status(400).json({ error: 'Amount must be between $10 and $50,000' });
  }

  if (!paymentMethod || !['stripe', 'paypal'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }

  try {
    // Log the transaction attempt
    console.log(`Top-up attempt: User ${userId}, Amount $${numAmount}, Method: ${paymentMethod}`);

    // For PayPal: verify transaction ID exists and is valid
    if (paymentMethod === 'paypal' && !transactionId) {
      return res.status(400).json({ error: 'PayPal transaction ID is required' });
    }

    // For Stripe: verify payment method exists
    if (paymentMethod === 'stripe' && !paymentMethodId) {
      return res.status(400).json({ error: 'Stripe payment method is required' });
    }

    // Update account balance in database
    await new Promise((resolve, reject) => {
      db.query(
        'UPDATE accounts SET balance = balance + ? WHERE userId = ?',
        [numAmount, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Get updated balance
    const balanceResult = await new Promise((resolve, reject) => {
      db.query(
        'SELECT balance FROM accounts WHERE userId = ?',
        [userId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results?.[0]);
        }
      );
    });

    if (!balanceResult) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const newBalance = balanceResult.balance;

    // Log successful transaction
    console.log(`✓ Top-up successful: User ${userId}, Amount $${numAmount}, New Balance: $${newBalance}`);

    // Return success response
    res.json({ 
      success: true, 
      message: `Wallet topped up successfully! $${numAmount.toFixed(2)} added to your account.`,
      newBalance: newBalance
    });
  } catch (error) {
    console.error('Top up error:', error);
    res.status(500).json({ error: 'Error processing top up. Please try again.' });
  }
});

/* PayPal Integration - Server-side */
// Create PayPal order
app.post("/api/paypal/create-order", checkAuthenticated, async (req, res) => {
  const { amount } = req.body;
  const userId = req.session.user.userId;

  if (!amount || parseFloat(amount) < 10) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const numAmount = parseFloat(amount);

  try {
    // Get PayPal access token
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
    ).toString('base64');

    const tokenResponse = await fetch('https://api.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Failed to get PayPal token:', tokenResponse.status);
      console.error('PayPal error response:', errorText);
      console.error('Check your PAYPAL_CLIENT_ID and PAYPAL_SECRET in .env file');
      return res.status(500).json({ error: 'PayPal authentication failed (401). Invalid credentials in .env file.' });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Create order on PayPal
    const orderResponse = await fetch('https://api.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: numAmount.toFixed(2)
            },
            description: `Wallet Top-up: $${numAmount.toFixed(2)}`
          }
        ],
        application_context: {
          return_url: `${process.env.APP_URL || 'http://localhost:3000'}/api/paypal/capture-order`,
          cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/topup`
        }
      })
    });

    if (!orderResponse.ok) {
      console.error('Failed to create PayPal order:', orderResponse.status);
      return res.status(500).json({ error: 'Failed to create payment order' });
    }

    const order = await orderResponse.json();

    // Store order info in session for later verification
    req.session.paypalOrder = {
      orderId: order.id,
      amount: numAmount,
      userId: userId,
      timestamp: Date.now()
    };

    res.json({ 
      success: true, 
      orderId: order.id,
      approveUrl: order.links.find(link => link.rel === 'approve').href
    });
  } catch (error) {
    console.error('PayPal order creation error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Capture PayPal order
app.get("/api/paypal/capture-order", checkAuthenticated, async (req, res) => {
  const { token } = req.query;
  const userId = req.session.user.userId;

  if (!token) {
    return res.redirect('/topup?error=invalid_token');
  }

  try {
    // Get PayPal access token
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
    ).toString('base64');

    const tokenResponse = await fetch('https://api.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Capture the order
    const captureResponse = await fetch(
      `https://api.sandbox.paypal.com/v2/checkout/orders/${token}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!captureResponse.ok) {
      console.error('Failed to capture PayPal order:', captureResponse.status);
      return res.redirect('/topup?error=capture_failed');
    }

    const capture = await captureResponse.json();

    // Verify order matches session
    const sessionOrder = req.session.paypalOrder;
    if (!sessionOrder || sessionOrder.orderId !== token) {
      return res.redirect('/topup?error=order_mismatch');
    }

    // Update account balance
    await new Promise((resolve, reject) => {
      db.query(
        'UPDATE accounts SET balance = balance + ? WHERE userId = ?',
        [sessionOrder.amount, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`✓ PayPal payment captured: User ${userId}, Amount $${sessionOrder.amount}`);

    // Clean up session
    delete req.session.paypalOrder;

    // Redirect to account with success
    res.redirect('/account?topup=success&amount=' + sessionOrder.amount);
  } catch (error) {
    console.error('PayPal capture error:', error);
    res.redirect('/topup?error=capture_error');
  }
});

// Reset account balance to 0 (for existing accounts with old data)
app.post("/api/reset-balance", checkAuthenticated, async (req, res) => {
  const userId = req.session.user.userId;
  
  try {
    await new Promise((resolve, reject) => {
      db.query('UPDATE accounts SET balance = 0 WHERE userId = ?', [userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    res.json({ success: true, message: 'Balance reset to $0' });
  } catch (error) {
    console.error('Reset balance error:', error);
    res.status(500).json({ error: 'Error resetting balance' });
  }
});

/* Trade / Balance API routes */
app.get("/api/user-balance", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.userId;
    const result = await new Promise((resolve, reject) => {
      db.query('SELECT balance FROM accounts WHERE userId = ?', [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ balance: result[0].balance });
  } catch (error) {
    console.error('Balance fetch error:', error);
    res.status(500).json({ error: 'Error fetching balance' });
  }
});

app.get("/api/user-holdings", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.userId;
    const result = await new Promise((resolve, reject) => {
      db.query(
        'SELECT symbol, qty, avgPrice FROM user_holdings WHERE userId = ? AND qty > 0 ORDER BY symbol ASC',
        [userId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    res.json({ 
      holdings: result.map(r => ({
        symbol: r.symbol,
        qty: parseFloat(r.qty),
        avgPrice: parseFloat(r.avgPrice)
      }))
    });
  } catch (error) {
    console.error('Holdings fetch error:', error);
    res.status(500).json({ error: 'Error fetching holdings', holdings: [] });
  }
});

app.post("/api/cleanup-invalid-holdings", checkAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.userId;
    
    // Delete all holdings with zero or negative quantities
    await new Promise((resolve, reject) => {
      db.query(
        'DELETE FROM user_holdings WHERE userId = ? AND qty <= 0',
        [userId],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    });

    res.json({ 
      success: true,
      message: 'Invalid holdings cleaned up'
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Error cleaning up invalid holdings' });
  }
});

app.post("/api/execute-trade", checkAuthenticated, async (req, res) => {
  const { orderType, symbol, quantity, price, totalCost, action } = req.body;
  const userId = req.session.user.userId;

  if (!symbol || !quantity || !price || !totalCost) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check account balance and ID
    const accountResult = await new Promise((resolve, reject) => {
      db.query('SELECT accountId, balance FROM accounts WHERE userId = ?', [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (accountResult.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const accountId = accountResult[0].accountId;
    const currentBalance = accountResult[0].balance;

    // ===== BUY TRADE =====
    if (action === 'buy' || !action) {
      if (totalCost > currentBalance) {
        return res.status(400).json({ 
          error: `Insufficient funds. Required: $${totalCost.toFixed(2)}, Available: $${currentBalance.toFixed(2)}` 
        });
      }

      // Deduct balance from account
      const newBalance = currentBalance - totalCost;
      await new Promise((resolve, reject) => {
        db.query('UPDATE accounts SET balance = ? WHERE accountId = ?', [newBalance, accountId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Save transaction record
      await new Promise((resolve, reject) => {
        db.query(
          'INSERT INTO stock_transactions (userId, symbol, txType, qty, price, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [userId, symbol, 'BUY', quantity, price],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Update user holdings (current positions)
      // Get existing holding if any
      const existingHolding = await new Promise((resolve, reject) => {
        db.query(
          'SELECT qty, avgPrice FROM user_holdings WHERE userId = ? AND symbol = ? AND mode = "REAL"',
          [userId, symbol],
          (err, results) => {
            if (err) reject(err);
            else resolve(results);
          }
        );
      });

      if (existingHolding.length > 0) {
        // Update existing holding with new average price
        const currentQty = parseFloat(existingHolding[0].qty);
        const currentAvg = parseFloat(existingHolding[0].avgPrice);
        const newQty = currentQty + parseFloat(quantity);
        const newAvg = ((currentQty * currentAvg) + (parseFloat(quantity) * parseFloat(price))) / newQty;

        await new Promise((resolve, reject) => {
          db.query(
            'UPDATE user_holdings SET qty = ?, avgPrice = ? WHERE userId = ? AND symbol = ?',
            [newQty, newAvg, userId, symbol],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } else {
        // Insert new holding with explicit REAL mode
        await new Promise((resolve, reject) => {
          db.query(
            'INSERT INTO user_holdings (userId, symbol, qty, avgPrice, mode) VALUES (?, ?, ?, ?, "REAL")',
            [userId, symbol, quantity, price],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      res.json({ 
        success: true, 
        message: `Successfully bought ${quantity} shares of ${symbol}`,
        newBalance: newBalance,
        orderType: orderType,
        symbol: symbol,
        quantity: quantity,
        price: price,
        action: 'buy'
      });

    // ===== SELL TRADE =====
    } else if (action === 'sell') {
      // Check if user owns this stock
      const holdingResult = await new Promise((resolve, reject) => {
        db.query(
          'SELECT qty, avgPrice FROM user_holdings WHERE userId = ? AND symbol = ? AND mode = "REAL"',
          [userId, symbol],
          (err, results) => {
            if (err) reject(err);
            else resolve(results);
          }
        );
      });

      if (holdingResult.length === 0) {
        return res.status(400).json({ 
          error: `You do not own any shares of ${symbol}` 
        });
      }

      const ownedQty = parseFloat(holdingResult[0].qty);

      // Check if user has enough shares to sell
      if (quantity > ownedQty) {
        return res.status(400).json({ 
          error: `Insufficient shares to sell. You own ${ownedQty} shares of ${symbol}`,
          owned: ownedQty,
          requestedToSell: quantity
        });
      }

      // Add proceeds to balance
      const newBalance = currentBalance + totalCost;
      await new Promise((resolve, reject) => {
        db.query('UPDATE accounts SET balance = ? WHERE accountId = ?', [newBalance, accountId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Save transaction record
      await new Promise((resolve, reject) => {
        db.query(
          'INSERT INTO stock_transactions (userId, symbol, txType, qty, price, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [userId, symbol, 'SELL', quantity, price],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Update holdings (reduce quantity or delete if zero)
      const newQty = ownedQty - quantity;
      
      if (newQty <= 0) {
        // Remove holding if sold all shares
        await new Promise((resolve, reject) => {
          db.query(
            'DELETE FROM user_holdings WHERE userId = ? AND symbol = ? AND mode = "REAL"',
            [userId, symbol],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } else {
        // Update holding with remaining shares
        await new Promise((resolve, reject) => {
          db.query(
            'UPDATE user_holdings SET qty = ? WHERE userId = ? AND symbol = ? AND mode = "REAL"',
            [newQty, userId, symbol],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      res.json({ 
        success: true, 
        message: `Successfully sold ${quantity} shares of ${symbol}`,
        newBalance: newBalance,
        proceeds: totalCost,
        sharesRemaining: newQty > 0 ? newQty : 0,
        orderType: orderType,
        symbol: symbol,
        quantity: quantity,
        price: price,
        action: 'sell'
      });

    } else {
      return res.status(400).json({ error: 'Invalid action. Must be buy or sell' });
    }

  } catch (error) {
    console.error('Trade execution error:', error);
    res.status(500).json({ error: 'Error executing trade' });
  }
});

app.post("/profile/wallet/remove", checkAuthenticated, profileController.removeWalletAddress);
app.post("/profile", checkAuthenticated, upload.single("avatar"), profileController.updateProfile);
app.post("/profile/risk", checkAuthenticated, profileController.updateRiskProfile);
app.post("/profile/password", checkAuthenticated, profileController.updatePassword);

/* Admin routes (your existing controller) */
app.get("/admin/dashboard", checkAdmin, adminController.showDashboard);

app.get("/admin/users", checkAdmin, adminController.listUsers);
app.get("/admin/users/edit/:id", checkAdmin, adminController.showEditUser);
app.post("/admin/users/edit/:id", checkAdmin, adminController.updateUser);
app.post("/admin/users/delete/:id", checkAdmin, adminController.deleteUser);

app.post("/admin/users/freeze/:id", checkAdmin, adminController.freezeUser);
app.post("/admin/users/unfreeze/:id", checkAdmin, adminController.unfreezeUser);

/* Server */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Connected to MySQL database: stock_portal");
});
