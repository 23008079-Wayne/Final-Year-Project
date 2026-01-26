/****************************************************
 * STOCKAI TERMINAL – SERVER ENTRY POINT
 * --------------------------------------------------
 * Purpose:
 * - Serve stock market dashboard pages (EJS)
 * - Fetch live prices with A+B+Fallback:
 *    A) Finnhub (primary)
 *    B) Yahoo Finance (backup)
 *    Fallback) last-known cached quote (stale but not blank)
 *
 * MAS Alignment:
 * - Transparency (clear data sources + caching)
 * - Explainability (commented logic)
 * - Human-in-the-loop (no auto trading)
 ****************************************************/

const express = require("express");
require("dotenv").config();

// Backup provider (B) for quotes
const yahooFinance = require("yahoo-finance2").default;

const app = express();
app.set("view engine", "ejs");

/****************************************************
 * CONFIGURATION & SECURITY
 ****************************************************/
const API_KEY = process.env.FINNHUB_API_KEY;

if (!API_KEY) {
  console.error("❌ FINNHUB_API_KEY is missing.");
  console.error("✅ Add it to .env → FINNHUB_API_KEY=your_key_here");
}

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
  const stooqSymbol = `${symbol.toLowerCase()}.us`;
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
 * ✅ A + B + FALLBACK QUOTE SYSTEM
 * --------------------------------------------------
 * A) Finnhub primary
 * B) Yahoo Finance backup
 * Fallback) last cached quote (stale)
 *
 * Why this stops "Unavailable":
 * - Even if Finnhub rate-limits (429), we keep showing:
 *   1) Yahoo quote, OR
 *   2) last known cached quote (stale)
 ****************************************************/

// How long we consider a quote "fresh"
const QUOTE_TTL_MS = 15 * 1000; // 15s

// Cache per symbol: { ts, data, source, stale }
const quoteBySymbol = new Map();

// If Finnhub rate-limits, we avoid calling it for a short cooldown
let finnhubBlockedUntil = 0;
const FINNHUB_COOLDOWN_MS = 60 * 1000; // 60s after a 429

// ---- B) Yahoo backup quote ----
async function fetchYahooQuote(symbol) {
  // yahoo-finance2 returns a big object; we map to Finnhub-like shape
  const sym = String(symbol).toUpperCase();

  // Timeout wrapper so Yahoo can’t hang your server
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
    dp: Number.isFinite(dp) ? dp : null,
    // Keeping extra fields is fine, but not necessary
  };
}

// ---- A) Finnhub primary quote ----
async function fetchFinnhubQuote(symbol) {
  const sym = String(symbol).toUpperCase();
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${API_KEY}`;
  return fetchJsonWithTimeout(url, 8000);
}

/**
 * getQuoteABCached(symbol)
 * ------------------------
 * Returns:
 * {
 *   quote: { c, d, dp, ... }  // Finnhub-like fields
 *   stale: boolean           // true if fallback used
 *   source: "finnhub" | "yahoo" | "cache"
 * }
 */
async function getQuoteABCached(symbol) {
  const sym = String(symbol || "").toUpperCase();
  const now = Date.now();

  // 1) Return fresh cache if available
  const hit = quoteBySymbol.get(sym);
  if (hit && (now - hit.ts) < QUOTE_TTL_MS) {
    return { quote: hit.data, stale: false, source: hit.source };
  }

  // Helper: store cache safely
  const store = (data, source, stale = false) => {
    // Only store if c looks numeric (prevents poisoning cache with null)
    const c = Number(data?.c);
    if (Number.isFinite(c)) {
      quoteBySymbol.set(sym, { ts: now, data, source });
    }
    return { quote: data, stale, source };
  };

  // 2) A) Try Finnhub first (unless we are in cooldown)
  const inCooldown = now < finnhubBlockedUntil;

  if (!inCooldown) {
    try {
      const q = await fetchFinnhubQuote(sym);

      // Finnhub quote usually has numeric c
      const c = Number(q?.c);
      if (Number.isFinite(c)) {
        return store(q, "finnhub", false);
      }

      // If Finnhub responded but weird, fall through to Yahoo/cache
    } catch (err) {
      // If 429, enter cooldown to stop hammering Finnhub
      if (String(err.message).includes("HTTP 429")) {
        finnhubBlockedUntil = now + FINNHUB_COOLDOWN_MS;
      }
      // Fall through to Yahoo/cache
    }
  }

  // 3) B) Try Yahoo backup
  try {
    const y = await fetchYahooQuote(sym);
    const c = Number(y?.c);
    if (Number.isFinite(c)) {
      return store(y, "yahoo", false);
    }
  } catch {
    // Fall through to cache
  }

  // 4) Fallback: return stale cache if we have it (prevents "Unavailable")
  if (hit?.data) {
    return { quote: hit.data, stale: true, source: "cache" };
  }

  // 5) Last resort: return a stable empty quote object (UI won’t crash)
  return { quote: { c: null, d: null, dp: null }, stale: true, source: "cache" };
}

/****************************************************
 * ✅ ONE ENDPOINT for ticker (browser calls 1 API only)
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
 * ✅ ONE ENDPOINT for current page cards (batch)
 * Example:
 *   /api/page-quotes?symbols=AAPL,TSLA,MSFT
 ****************************************************/
app.get("/api/page-quotes", async (req, res) => {
  try {
    const raw = String(req.query.symbols || "");
    const list = raw
      .split(",")
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20); // safety limit

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
 * MAIN MARKET DASHBOARD (NO SORTING)
 ****************************************************/
app.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = 6;

  const start = (page - 1) * perPage;
  const end = start + perPage;

  const symbols = ALL_STOCKS.slice(start, end);
  const totalPages = Math.ceil(ALL_STOCKS.length / perPage);

  try {
    const results = [];

    for (const symbol of symbols) {
      // 1) Quote (A+B+fallback) — safe for free tier
      let quoteObj = { c: null, d: null, dp: null };
      try {
        const { quote } = await getQuoteABCached(symbol);
        quoteObj = quote;
      } catch {}

      // 2) 30-day trend (Finnhub candles → fallback Stooq)
      let graph = { labels: [], prices: [] };

      // A) Finnhub candles (often blocked on free tier)
      try {
        const to = Math.floor(Date.now() / 1000);
        const from = to - 30 * 24 * 60 * 60;

        const candle = await fetchJsonWithTimeout(
          `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${API_KEY}`
        );

        if (candle.s === "ok" && Array.isArray(candle.c) && Array.isArray(candle.t)) {
          graph.labels = candle.t.map(ts =>
            new Date(ts * 1000).toISOString().split("T")[0]
          );
          graph.prices = candle.c.map(Number).filter(n => Number.isFinite(n));
        }
      } catch {
        // silent fallback
      }

      // B) Stooq fallback
      if (graph.prices.length === 0) {
        try {
          const stooqSeries = await fetchStooqDailySeries(symbol, 30);
          graph.labels = stooqSeries.labels;
          graph.prices = stooqSeries.prices;
        } catch {}
      }

      // Final fallback for charts (prevents blank sparkline)
      if (graph.prices.length === 0) {
        const p = Number(quoteObj?.c) || 0;
        graph.labels = ["1", "2", "3"];
        graph.prices = [p, p, p];
      }

      results.push({ symbol, quote: quoteObj, graph });
    }

    res.render("home", { results, page, totalPages });
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.send("Error loading stock data");
  }
});

/****************************************************
 * FULL CHART PAGE (TradingView)
 ****************************************************/
app.get("/chart/:symbol", (req, res) => {
  res.render("chart", { symbol: req.params.symbol.toUpperCase() });
});

/****************************************************
 * SINGLE QUOTE API (still exists, but now A+B+fallback)
 * NOTE:
 * - Keep it for other pages, but DO NOT poll it per card anymore
 ****************************************************/
app.get("/api/quote/:symbol", async (req, res) => {
  try {
    const symbol = String(req.params.symbol || "").toUpperCase();
    const { quote, stale, source } = await getQuoteABCached(symbol);
    res.json({ ...quote, stale, source });
  } catch (err) {
    res.status(500).json({ error: "Live quote unavailable" });
  }
});

/****************************************************
 * PORTFOLIO (unchanged demo)
 ****************************************************/
app.get("/portfolio", (req, res) => {
  res.render("portfolio", {
    portfolio: {
      totalValue: 0,
      dailyChange: -132.4,
      dailyPercent: -0.52,
      holdings: [
        { symbol: "AAPL", qty: 15, avg: 162.1 },
        { symbol: "TSLA", qty: 5, avg: 190.3 },
        { symbol: "NVDA", qty: 4, avg: 450.88 },
        { symbol: "AMZN", qty: 10, avg: 98.32 }
      ]
    }
  });
});

/****************************************************
 * ✅ NEW: MARKET PAGE (separate from homepage)
 * Route: /market
 * View : market.ejs
 *
 * MAS notes:
 * - View-only market monitoring (no trade execution)
 * - Clear data source + fallback behaviour
 ****************************************************/

// Candle cooldown (prevents repeated 403/429 spam on free tier)
let candleBlockedUntil = 0;
const CANDLE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

app.get("/market", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = 6; // ✅ 6 cards per page

  // ✅ Selected symbol (for your left watchlist "active" highlight + main chart if you have it)
  // If user didn't choose one, use the first stock in your universe.
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
      /***********************
       * 1) Quote (A + B + fallback)
       ***********************/
      let quoteObj = { c: null, d: null, dp: null, stale: true, source: "cache" };
      try {
        const { quote, stale, source } = await getQuoteABCached(s);
        quoteObj = { ...quote, stale, source };
      } catch {}

      /***********************
       * 2) 30-day trend
       * Finnhub candles (if allowed) → fallback Stooq
       ***********************/
      let graph = { labels: [], prices: [] };

      // A) Finnhub candles (skip if cooldown)
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
          // ✅ Cooldown only for 403/429 to avoid hammering Finnhub free tier
          const msg = String(err?.message || "");
          if (msg.includes("HTTP 403") || msg.includes("HTTP 429")) {
            candleBlockedUntil = Date.now() + CANDLE_COOLDOWN_MS;
          }
        }
      }

      // B) Stooq fallback
      if (graph.prices.length === 0) {
        try {
          const stooqSeries = await fetchStooqDailySeries(s, 30);
          graph.labels = stooqSeries.labels;
          graph.prices = stooqSeries.prices;
        } catch {}
      }

      // Final fallback (prevents blank charts)
      if (graph.prices.length === 0) {
        const p = Number(quoteObj?.c);
        const seed = Number.isFinite(p) ? p : 0;
        graph.labels = ["1", "2", "3"];
        graph.prices = [seed, seed, seed];
      }

      results.push({ symbol: s, quote: quoteObj, graph });
    }

    // ✅ FIX: provide what market.ejs expects
    res.render("market", {
      results,
      page,
      totalPages,

      // ✅ used by: <% watchlist.forEach(...) %>
      watchlist: ALL_STOCKS,

      // ✅ used by: (s === symbol ? 'active' : '')
      symbol
    });

  } catch (err) {
    console.error("MARKET ERROR:", err);
    res.status(500).send("Error loading market page");
  }
});

/****************************************************
 * SERVER START
 ****************************************************/
app.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});
