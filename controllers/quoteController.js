/*
  quoteController.js
  --------------------------------------------------
  Purpose:
  - Provide stock quote data using A+B+Fallback strategy
    A) Finnhub (primary)
    B) Yahoo Finance (backup)
    Fallback)
  - Fetch historical prices from Stooq
*/

"use strict";

const yahooFinance = require("yahoo-finance2").default;


/**
 * Fetch with timeout protection
 */
async function fetchWithTimeout(url, timeout = 8000) {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available. Use Node 18+ or install node-fetch.");
  }

  return Promise.race([
    fetch(url, { headers: { Accept: "application/json" } }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeout)
    )
  ]);
}

/**
 * Fetch JSON safely (status + content-type check)
 */
async function fetchJsonWithTimeout(url, timeout = 8000) {
  const res = await fetchWithTimeout(url, timeout);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} from ${url} -> ${text.slice(0, 160)}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Non-JSON response from ${url} -> ${text.slice(0, 160)}`);
  }

  return res.json();
}

/* ==================================================
   HISTORICAL PRICE DATA (STOOQ)
   ================================================== */

/**
 * Fetch daily closing prices from Stooq
 * Used for charts and risk estimation
 */
async function fetchStooqDailySeries(symbol, days = 60) {
  const stooqSymbol = `${String(symbol).toLowerCase()}.us`;
  const url = `https://stooq.com/q/d/l/?s=${stooqSymbol}&i=d`;

  const res = await fetchWithTimeout(url, 8000);
  const csvText = await res.text();

  const lines = csvText.trim().split("\n");
  if (lines.length <= 1) return { labels: [], prices: [] };

  const rows = lines.slice(1).slice(-days);

  const labels = [];
  const prices = [];

  for (const row of rows) {
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

/* ==================================================
   QUOTE CACHE + PROVIDERS
   ================================================== */

const QUOTE_TTL_MS = 15 * 1000; // 15 seconds
const quoteBySymbol = new Map();

// Finnhub cooldown handling
let finnhubBlockedUntil = 0;
const FINNHUB_COOLDOWN_MS = 60 * 1000;

/**
 * Yahoo Finance fallback quote
 */
async function fetchYahooQuote(symbol) {
  const sym = String(symbol).toUpperCase();

  const data = await Promise.race([
    yahooFinance.quote(sym),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Yahoo timeout")), 5000)
    )
  ]);

  return {
    c: Number.isFinite(data?.regularMarketPrice) ? data.regularMarketPrice : null,
    d: Number.isFinite(data?.regularMarketChange) ? data.regularMarketChange : null,
    dp: Number.isFinite(data?.regularMarketChangePercent) ? data.regularMarketChangePercent : null
  };
}

/**
 * Finnhub primary quote
 */
async function fetchFinnhubQuote(symbol) {
  const apiKey = process.env.FINNHUB_API_KEY;
  const sym = String(symbol).toUpperCase();

  if (!apiKey) throw new Error("Missing FINNHUB_API_KEY");

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${apiKey}`;
  return fetchJsonWithTimeout(url, 8000);
}

/**
 * A+B+Fallback quote logic with caching
 */
async function getQuoteABCached(symbol) {
  const sym = String(symbol || "").toUpperCase();
  const now = Date.now();

  const cached = quoteBySymbol.get(sym);
  if (cached && now - cached.ts < QUOTE_TTL_MS) {
    return { quote: cached.data, stale: false, source: cached.source };
  }

  const store = (data, source, stale = false) => {
    if (Number.isFinite(Number(data?.c))) {
      quoteBySymbol.set(sym, { ts: now, data, source });
    }
    return { quote: data, stale, source };
  };

  // Try Finnhub (unless in cooldown)
  if (now >= finnhubBlockedUntil) {
    try {
      const q = await fetchFinnhubQuote(sym);
      if (Number.isFinite(Number(q?.c))) return store(q, "finnhub");
    } catch (err) {
      if (String(err?.message).includes("HTTP 429")) {
        finnhubBlockedUntil = now + FINNHUB_COOLDOWN_MS;
      }
    }
  }

  // Try Yahoo Finance
  try {
    const y = await fetchYahooQuote(sym);
    if (Number.isFinite(Number(y?.c))) return store(y, "yahoo");
  } catch {
    // ignore
  }

  // Fallback to cached data
  if (cached?.data) return { quote: cached.data, stale: true, source: "cache" };

  return {
    quote: { c: null, d: null, dp: null },
    stale: true,
    source: "cache"
  };
}

/* ==================================================
   EXPRESS ROUTE HANDLER
   ================================================== */

/**
 * GET /api/quote/:symbol
 * Public endpoint for live quote retrieval
 */
async function getQuote(req, res) {
  try {
    const symbol = String(req.params.symbol || "").toUpperCase().trim();
    if (!symbol) {
      return res.status(400).json({ error: "Missing stock symbol" });
    }

    const { quote, stale, source } = await getQuoteABCached(symbol);

    res.json({ symbol, quote, stale, source });
  } catch (error) {
    console.error("getQuote error:", error?.message || error);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
}

/* ==================================================
   RISK ESTIMATION (VOLATILITY-BASED)
   ================================================== */

function stdDev(nums) {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, x) => a + (x - mean) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

const riskCache = new Map();
const RISK_TTL_MS = 10 * 60 * 1000;

/**
 * Estimate stock risk level using historical volatility
 */
async function estimateStockRiskLevel(symbol) {
  const sym = String(symbol || "").toUpperCase();
  const now = Date.now();

  const cached = riskCache.get(sym);
  if (cached && now - cached.ts < RISK_TTL_MS) return cached.level;

  try {
    const { prices } = await fetchStooqDailySeries(sym, 60);
    if (!prices || prices.length < 10) return null;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const vol = stdDev(returns);
    const level = vol < 0.015 ? "LOW" : vol < 0.03 ? "MEDIUM" : "HIGH";

    riskCache.set(sym, { ts: now, level });
    return level;
  } catch {
    return null;
  }
}

/* ==================================================
   MODULE EXPORTS
   ================================================== */

module.exports = {
  QUOTE_TTL_MS,
  getQuoteABCached,
  getQuote,                    // ✅ Express route handler
  fetchStooqDailySeries,
  estimateStockRiskLevel,
  finnhubState: () => ({
    blockedUntil: finnhubBlockedUntil
  })
};
