/****************************************************
 * STOCKAI TERMINAL – SERVER ENTRY POINT
 * --------------------------------------------------
 * Purpose:
 * - Serve stock market dashboard pages (EJS)
 * - Fetch live prices with A+B+Fallback:
 *    A) Finnhub (primary)
 *    B) Yahoo Finance (backup)
 *    Fallback) last-known cached quote (stale but not blank)
 * - User authentication & portfolio management
 * - Admin controls & stock management (without stockController)
 *
 * MAS Alignment:
 * - Transparency (clear data sources + caching)
 * - Explainability (commented logic)
 * - Human-in-the-loop (no auto trading)
 ****************************************************/

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const bcrypt = require("bcrypt");
require("dotenv").config();

// Backup provider (B) for quotes
const yahooFinance = require("yahoo-finance2").default;

// Database
const db = require("./db");

// Controllers (keep these if files exist)
const authController = require("./controllers/authController");
const profileController = require("./controllers/profileController");
const adminController = require("./controllers/adminController");

// Middleware
const { checkAuthenticated, checkAdmin } = require("./middleware/auth");
const upload = require("./middleware/upload");

const app = express();

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Session & Flash
app.use(
  session({
    secret: process.env.SESSION_SECRET || "superSecretStockPortal",
    resave: false,
    saveUninitialized: false
  })
);

app.use(flash());

// Debug logging
app.use((req, res, next) => {
  console.log(`HIT: ${req.method} ${req.url}`);
  next();
});

// Globals for views
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currentUser = req.session.user || null;
  next();
});

/****************************************************
 * CONFIGURATION & SECURITY
 ****************************************************/
const API_KEY = process.env.FINNHUB_API_KEY;

if (!API_KEY) {
  console.error(" FINNHUB_API_KEY is missing.");
  console.error(" Add it to .env → FINNHUB_API_KEY=your_key_here");
}

/****************************************************
 * ENSURE ADMIN USER EXISTS
 ****************************************************/
async function ensureAdminExists() {
  try {
    const [admins] = await db
      .promise()
      .query("SELECT * FROM users WHERE roleId = 2 LIMIT 1");

    if (admins.length > 0) {
      console.log(" Admin already exists.");
      return;
    }

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

    console.log(" Default admin created: username=admin, password=Admin123!");
  } catch (err) {
    console.error("Error ensuring admin exists:", err);
  }
}
ensureAdminExists();

/****************************************************
 * WATCHLIST UNIVERSE (toggle here)
 ****************************************************/
const ALL_STOCKS = [
  "AAPL", "TSLA", "MSFT", "NVDA", "AMZN",
  "GOOGL", "META", "NFLX", "BABA", "INTC",
  "AMD", "ORCL", "ADBE", "PYPL", "CRM",
  "UBER", "SHOP", "DIS", "SBUX", "NKE"
];

/****************************************************
 *  DEMO PORTFOLIO HOLDINGS (single source of truth)
 ****************************************************/
const PORTFOLIO_HOLDINGS = [
  { symbol: "AAPL", qty: 15, avg: 162.1 },
  { symbol: "TSLA", qty: 5, avg: 190.3 },
  { symbol: "NVDA", qty: 4, avg: 450.88 },
  { symbol: "AMZN", qty: 10, avg: 98.32 }
];

/****************************************************
 * SAFE FETCH UTILITIES
 ****************************************************/
const fetchWithTimeout = (url, timeout = 8000) =>
  Promise.race([
    fetch(url, { headers: { Accept: "application/json" } }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeout)
    )
  ]);

async function fetchJsonWithTimeout(url, timeout = 8000) {
  const res = await fetchWithTimeout(url, timeout);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} from ${url} → ${text.slice(0, 160)}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Non-JSON response from ${url} → ${text.slice(0, 160)}`);
  }

  return res.json();
}

/****************************************************
 * STOOQ (historical fallback only)
 ****************************************************/
async function fetchStooqDailySeries(symbol, days = 30) {
  const stooqSymbol = `${String(symbol).toLowerCase()}.us`;
  const url = `https://stooq.com/q/d/l/?s=${stooqSymbol}&i=d`;

  const res = await fetchWithTimeout(url);
  const csvText = await res.text();

  const lines = csvText.trim().split("\n");
  if (lines.length <= 1) return { labels: [], prices: [] };

  const rows = lines.slice(1);
  const last = rows.slice(-days);

  const labels = [];
  const prices = [];

  for (const row of last) {
    const parts = row.split(",");
    const date = parts[0];
    const close = Number(parts[4]);
    if (date && Number.isFinite(close)) {
      labels.push(date);
      prices.push(close);
    }
  }

  return { labels, prices };
}

/****************************************************
 *  A + B + FALLBACK QUOTE SYSTEM
 ****************************************************/
const QUOTE_TTL_MS = 15 * 1000; // 15s
const quoteBySymbol = new Map();

let finnhubBlockedUntil = 0;
const FINNHUB_COOLDOWN_MS = 60 * 1000; // 60s after a 429

async function fetchYahooQuote(symbol) {
  const sym = String(symbol).toUpperCase();

  const data = await Promise.race([
    yahooFinance.quote(sym),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Yahoo timeout")), 5000)
    )
  ]);

  const c = Number(data?.regularMarketPrice);
  const d = Number(data?.regularMarketChange);
  const dp = Number(data?.regularMarketChangePercent);

  return {
    c: Number.isFinite(c) ? c : null,
    d: Number.isFinite(d) ? d : null,
    dp: Number.isFinite(dp) ? dp : null
  };
}

async function fetchFinnhubQuote(symbol) {
  const sym = String(symbol).toUpperCase();
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${API_KEY}`;
  return fetchJsonWithTimeout(url, 8000);
}

async function getQuoteABCached(symbol) {
  const sym = String(symbol || "").toUpperCase();
  const now = Date.now();

  const hit = quoteBySymbol.get(sym);
  if (hit && (now - hit.ts) < QUOTE_TTL_MS) {
    return { quote: hit.data, stale: false, source: hit.source };
  }

  const store = (data, source, stale = false) => {
    const c = Number(data?.c);
    if (Number.isFinite(c)) {
      quoteBySymbol.set(sym, { ts: now, data, source });
    }
    return { quote: data, stale, source };
  };

  const inCooldown = now < finnhubBlockedUntil;

  if (!inCooldown) {
    try {
      const q = await fetchFinnhubQuote(sym);
      const c = Number(q?.c);
      if (Number.isFinite(c)) {
        return store(q, "finnhub", false);
      }
    } catch (err) {
      if (String(err.message).includes("HTTP 429")) {
        finnhubBlockedUntil = now + FINNHUB_COOLDOWN_MS;
      }
    }
  }

  try {
    const y = await fetchYahooQuote(sym);
    const c = Number(y?.c);
    if (Number.isFinite(c)) {
      return store(y, "yahoo", false);
    }
  } catch {}

  if (hit?.data) {
    return { quote: hit.data, stale: true, source: "cache" };
  }

  return { quote: { c: null, d: null, dp: null }, stale: true, source: "cache" };
}

/****************************************************
 *  QUICK HEALTH CHECK
 ****************************************************/
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/****************************************************
 *  API: ticker
 ****************************************************/
const TICKER_SYMBOLS = ["AAPL", "MSFT", "AMZN", "TSLA", "NVDA", "GOOGL", "META", "NFLX"];

app.get("/api/ticker", async (req, res) => {
  try {
    const rows = [];
    for (const s of TICKER_SYMBOLS) {
      const { quote, stale, source } = await getQuoteABCached(s);
      const c = Number(quote?.c);
      rows.push({
        symbol: s,
        c: Number.isFinite(c) ? c : null,
        d: Number.isFinite(Number(quote?.d)) ? Number(quote.d) : null,
        dp: Number.isFinite(Number(quote?.dp)) ? Number(quote.dp) : null,
        ok: Number.isFinite(c),
        stale,
        source
      });
    }

    res.json({
      updatedAt: new Date().toISOString(),
      ttlMs: QUOTE_TTL_MS,
      finnhubCooldown: Date.now() < finnhubBlockedUntil,
      symbols: rows
    });
  } catch {
    res.status(500).json({ error: "Ticker unavailable" });
  }
});

/****************************************************
 *  API: page quotes
 ****************************************************/
app.get("/api/page-quotes", async (req, res) => {
  try {
    const raw = String(req.query.symbols || "");
    const list = raw
      .split(",")
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20);

    const out = {};
    for (const s of list) {
      const { quote, stale, source } = await getQuoteABCached(s);
      out[s] = { quote, stale, source };
    }

    res.json({
      updatedAt: new Date().toISOString(),
      ttlMs: QUOTE_TTL_MS,
      symbols: out
    });
  } catch {
    res.status(500).json({ error: "Page quotes unavailable" });
  }
});

/****************************************************
 *  API: single quote
 ****************************************************/
app.get("/api/quote/:symbol", async (req, res) => {
  try {
    const symbol = String(req.params.symbol || "").toUpperCase();
    const { quote, stale, source } = await getQuoteABCached(symbol);
    res.json({ ...quote, stale, source });
  } catch {
    res.status(500).json({ error: "Live quote unavailable" });
  }
});

/****************************************************
 *  HOME (ONLY ONE / ROUTE)
 ****************************************************/
app.get("/", async (req, res) => {
  if (!req.session.user) {
    return res.render("homepage", { title: "Marketmind - Stock Management Platform" });
  }

  const page = parseInt(req.query.page) || 1;
  const perPage = 6;

  const start = (page - 1) * perPage;
  const end = start + perPage;

  const symbols = ALL_STOCKS.slice(start, end);
  const totalPages = Math.ceil(ALL_STOCKS.length / perPage);

  try {
    const results = [];

    for (const symbol of symbols) {
      let quoteObj = { c: null, d: null, dp: null };
      try {
        const { quote } = await getQuoteABCached(symbol);
        quoteObj = quote;
      } catch {}

      let graph = { labels: [], prices: [] };

      // Finnhub candles first
      try {
        const to = Math.floor(Date.now() / 1000);
        const from = to - 30 * 24 * 60 * 60;

        const candle = await fetchJsonWithTimeout(
          `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${API_KEY}`
        );

        if (candle.s === "ok" && Array.isArray(candle.c) && Array.isArray(candle.t)) {
          graph.labels = candle.t.map(ts => new Date(ts * 1000).toISOString().split("T")[0]);
          graph.prices = candle.c.map(Number).filter(n => Number.isFinite(n));
        }
      } catch {}

      // Stooq fallback
      if (graph.prices.length === 0) {
        try {
          const stooqSeries = await fetchStooqDailySeries(symbol, 30);
          graph.labels = stooqSeries.labels;
          graph.prices = stooqSeries.prices;
        } catch {}
      }

      // Last fallback so UI doesn't break
      if (graph.prices.length === 0) {
        const p = Number(quoteObj?.c) || 0;
        graph.labels = ["1", "2", "3"];
        graph.prices = [p, p, p];
      }

      results.push({ symbol, quote: quoteObj, graph });
    }

    res.render("home", { results, page, totalPages, title: "Marketmind" });
  } catch (err) {
    console.error("HOME ERROR:", err);
    res.render("home", { results: [], page: 1, totalPages: 0, title: "Marketmind" });
  }
});

/****************************************************
 * FULL CHART PAGE (TradingView)
 ****************************************************/
app.get("/chart/:symbol", (req, res) => {
  res.render("chart", { symbol: req.params.symbol.toUpperCase() });
});

/****************************************************
 * PORTFOLIO (demo page)
 ****************************************************/
app.get("/portfolio", (req, res) => {
  res.render("portfolio", {
    portfolio: {
      totalValue: 0,
      dailyChange: -132.4,
      dailyPercent: -0.52,
      holdings: PORTFOLIO_HOLDINGS
    }
  });
});

/****************************************************
 *  PORTFOLIO LIVE API (NEVER CRASH + ALWAYS JSON)
 ****************************************************/
app.get("/api/portfolio-live", async (req, res) => {
  console.log("HIT: GET /api/portfolio-live");

  const holdings = PORTFOLIO_HOLDINGS;

  try {
    let totalValue = 0;
    const allocation = [];

    for (const h of holdings) {
      try {
        const { quote, stale, source } = await getQuoteABCached(h.symbol);

        const livePrice = Number(quote?.c);
        const safeLivePrice = Number.isFinite(livePrice) ? livePrice : null;

        // If live price not available, fallback to avg cost (charts still show)
        const fallbackPrice = Number.isFinite(Number(h.avg)) ? Number(h.avg) : 0;
        const priceToUse = safeLivePrice ?? fallbackPrice;

        const qty = Number(h.qty || 0);
        const value = priceToUse * qty;

        totalValue += value;

        allocation.push({
          symbol: String(h.symbol).toUpperCase(),
          value: Math.round(value * 100) / 100,
          price: Math.round(priceToUse * 100) / 100,
          source: safeLivePrice ? source : "avg-fallback",
          stale: safeLivePrice ? !!stale : true
        });
      } catch (innerErr) {
        console.error(`PORTFOLIO-LIVE error on ${h.symbol}:`, innerErr?.message || innerErr);
        allocation.push({ symbol: String(h.symbol).toUpperCase(), value: 0, price: 0, source: "error", stale: true });
      }
    }

    res.json({
      totalValue: Math.round(totalValue * 100) / 100,
      allocation
    });
  } catch (err) {
    console.error("PORTFOLIO LIVE ERROR:", err?.message || err);

    // Still return JSON so frontend won't show Offline forever
    res.status(200).json({
      totalValue: 0,
      allocation: holdings.map(h => ({ symbol: String(h.symbol).toUpperCase(), value: 0, price: 0, source: "error", stale: true })),
      error: "portfolio-live unavailable"
    });
  }
});

/****************************************************
 *  PORTFOLIO 30-DAY HISTORY API (real performance chart)
 * Uses Stooq daily closes for each holding and sums portfolio value per day.
 ****************************************************/
let portfolioHistoryCache = { ts: 0, data: null };
const PORTFOLIO_HISTORY_TTL_MS = 5 * 60 * 1000; // 5 minutes

app.get("/api/portfolio-history", async (req, res) => {
  try {
    const now = Date.now();
    if (portfolioHistoryCache.data && (now - portfolioHistoryCache.ts) < PORTFOLIO_HISTORY_TTL_MS) {
      return res.json(portfolioHistoryCache.data);
    }

    const holdings = PORTFOLIO_HOLDINGS;

    const seriesBySymbol = {};
    for (const h of holdings) {
      const s = String(h.symbol).toUpperCase();
      seriesBySymbol[s] = await fetchStooqDailySeries(s, 30);
    }

    const baseSym = String(holdings[0]?.symbol || "AAPL").toUpperCase();
    const baseLabels = seriesBySymbol[baseSym]?.labels || [];

    const values = [];
    for (const date of baseLabels) {
      let total = 0;

      for (const h of holdings) {
        const sym = String(h.symbol).toUpperCase();
        const labels = seriesBySymbol[sym]?.labels || [];
        const prices = seriesBySymbol[sym]?.prices || [];

        const idx = labels.indexOf(date);
        const px = idx >= 0 ? Number(prices[idx]) : NaN;

        total += (Number.isFinite(px) ? px : 0) * Number(h.qty || 0);
      }

      values.push(Math.round(total * 100) / 100);
    }

    const payload = { labels: baseLabels, values };
    portfolioHistoryCache = { ts: now, data: payload };

    res.json(payload);
  } catch (err) {
    console.error("PORTFOLIO HISTORY ERROR:", err?.message || err);
    res.status(500).json({ error: "portfolio-history unavailable" });
  }
});

/****************************************************
 *  MARKET PAGE
 ****************************************************/
let candleBlockedUntil = 0;
const CANDLE_COOLDOWN_MS = 5 * 60 * 1000;

app.get("/market", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = 6;

  const symbol = String(req.query.symbol || ALL_STOCKS[0] || "AAPL").toUpperCase();

  const start = (page - 1) * perPage;
  const end = start + perPage;

  const symbols = ALL_STOCKS.slice(start, end);
  const totalPages = Math.ceil(ALL_STOCKS.length / perPage);

  try {
    const results = [];
    const nowMs = Date.now();
    const candleInCooldown = nowMs < candleBlockedUntil;

    for (const s of symbols) {
      let quoteObj = { c: null, d: null, dp: null, stale: true, source: "cache" };
      try {
        const { quote, stale, source } = await getQuoteABCached(s);
        quoteObj = { ...quote, stale, source };
      } catch {}

      let graph = { labels: [], prices: [] };

      if (!candleInCooldown) {
        try {
          const to = Math.floor(Date.now() / 1000);
          const from = to - 30 * 24 * 60 * 60;

          const candle = await fetchJsonWithTimeout(
            `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(s)}&resolution=D&from=${from}&to=${to}&token=${API_KEY}`
          );

          if (candle.s === "ok" && Array.isArray(candle.c) && Array.isArray(candle.t)) {
            graph.labels = candle.t.map(ts =>
              new Date(ts * 1000).toISOString().split("T")[0]
            );
            graph.prices = candle.c.map(Number).filter(n => Number.isFinite(n));
          }
        } catch (err) {
          const msg = String(err?.message || "");
          if (msg.includes("HTTP 403") || msg.includes("HTTP 429")) {
            candleBlockedUntil = Date.now() + CANDLE_COOLDOWN_MS;
          }
        }
      }

      if (graph.prices.length === 0) {
        try {
          const stooqSeries = await fetchStooqDailySeries(s, 30);
          graph.labels = stooqSeries.labels;
          graph.prices = stooqSeries.prices;
        } catch {}
      }

      if (graph.prices.length === 0) {
        const p = Number(quoteObj?.c);
        const seed = Number.isFinite(p) ? p : 0;
        graph.labels = ["1", "2", "3"];
        graph.prices = [seed, seed, seed];
      }

      results.push({ symbol: s, quote: quoteObj, graph });
    }

    res.render("market", {
      results,
      page,
      totalPages,
      watchlist: ALL_STOCKS,
      symbol
    });
  } catch (err) {
    console.error("MARKET ERROR:", err);
    res.status(500).send("Error loading market page");
  }
});

/****************************************************
 * AUTH ROUTES
 ****************************************************/
app.get("/register", authController.showRegister);
app.post("/register", authController.register);

app.get("/login", authController.showLogin);
app.post("/login", authController.login);

app.get("/logout", authController.logout);

/****************************************************
 * PROFILE ROUTES
 ****************************************************/
app.get("/profile", checkAuthenticated, profileController.showProfile);
app.get("/profile/risk", checkAuthenticated, profileController.showRiskProfile);
app.get("/account", checkAuthenticated, profileController.showAccount);

app.post("/profile/wallet/remove", checkAuthenticated, profileController.removeWalletAddress);

app.post("/profile", checkAuthenticated, upload.single("avatar"), profileController.updateProfile);
app.post("/profile/risk", checkAuthenticated, profileController.updateRiskProfile);
app.post("/profile/password", checkAuthenticated, profileController.updatePassword);

/****************************************************
 * ADMIN ROUTES
 ****************************************************/
app.get("/admin/dashboard", checkAdmin, adminController.showDashboard);

app.get("/admin/users", checkAdmin, adminController.listUsers);
app.get("/admin/users/edit/:id", checkAdmin, adminController.showEditUser);
app.post("/admin/users/edit/:id", checkAdmin, adminController.updateUser);
app.post("/admin/users/delete/:id", checkAdmin, adminController.deleteUser);

app.post("/admin/users/freeze/:id", checkAdmin, adminController.freezeUser);
app.post("/admin/users/unfreeze/:id", checkAdmin, adminController.unfreezeUser);

/****************************************************
 * SERVER
 ****************************************************/
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
  console.log(" Connected to MySQL database: stock_portal");
});
