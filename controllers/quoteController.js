/*
  quoteController.js

  This file contains:
  - A+B+fallback quote logic (Finnhub primary, Yahoo backup, cache fallback)
  - Stooq historical daily series (for 30D performance)
  - Simple risk estimate using volatility (free approach)
  quote system (Finnhub + Yahoo + cache)
  Stooq historical prices
  DB read helpers (holdings + risk profile)
  risk estimate + caching
*/

"use strict";

const yahooFinance = require("yahoo-finance2").default;

/* Basic fetch helpers (Node 18+ has global fetch) */
async function fetchWithTimeout(url, timeout = 8000) {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available. Use Node 18+ or install node-fetch.");
  }

  return Promise.race([
    fetch(url, { headers: { Accept: "application/json" } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout))
  ]);
}

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

/* Stooq historical daily close series */
async function fetchStooqDailySeries(symbol, days = 60) {
  const stooqSymbol = `${String(symbol).toLowerCase()}.us`;
  const url = `https://stooq.com/q/d/l/?s=${stooqSymbol}&i=d`;

  const res = await fetchWithTimeout(url, 8000);
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

/* Quote cache */
const QUOTE_TTL_MS = 15 * 1000;
const quoteBySymbol = new Map();

let finnhubBlockedUntil = 0;
const FINNHUB_COOLDOWN_MS = 60 * 1000;

async function fetchYahooQuote(symbol) {
  const sym = String(symbol).toUpperCase();

  const data = await Promise.race([
    yahooFinance.quote(sym),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Yahoo timeout")), 5000))
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
  const apiKey = process.env.FINNHUB_API_KEY;
  const sym = String(symbol).toUpperCase();
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${apiKey}`;
  return fetchJsonWithTimeout(url, 8000);
}

async function getQuoteABCached(symbol) {
  const sym = String(symbol || "").toUpperCase();
  const now = Date.now();

  const hit = quoteBySymbol.get(sym);
  if (hit && now - hit.ts < QUOTE_TTL_MS) {
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
      if (Number.isFinite(c)) return store(q, "finnhub", false);
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("HTTP 429")) finnhubBlockedUntil = now + FINNHUB_COOLDOWN_MS;
    }
  }

  try {
    const y = await fetchYahooQuote(sym);
    const c = Number(y?.c);
    if (Number.isFinite(c)) return store(y, "yahoo", false);
  } catch {
    // ignore
  }

  if (hit?.data) return { quote: hit.data, stale: true, source: "cache" };
  return { quote: { c: null, d: null, dp: null }, stale: true, source: "cache" };
}

/* Risk estimate (free) using volatility from Stooq */
function stdDev(nums) {
  const n = nums.length;
  if (n < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / n;
  const varr = nums.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(varr);
}

const riskCache = new Map(); // symbol -> { ts, level }
const RISK_TTL_MS = 10 * 60 * 1000;

async function estimateStockRiskLevel(symbol) {
  const sym = String(symbol || "").toUpperCase();
  const now = Date.now();

  const cached = riskCache.get(sym);
  if (cached && now - cached.ts < RISK_TTL_MS) return cached.level;

  try {
    const { prices } = await fetchStooqDailySeries(sym, 60);
    if (!prices || prices.length < 10) {
      riskCache.set(sym, { ts: now, level: null });
      return null;
    }

    const rets = [];
    for (let i = 1; i < prices.length; i++) {
      const prev = Number(prices[i - 1]);
      const cur = Number(prices[i]);
      if (Number.isFinite(prev) && prev > 0 && Number.isFinite(cur)) {
        rets.push((cur - prev) / prev);
      }
    }
    if (rets.length < 10) {
      riskCache.set(sym, { ts: now, level: null });
      return null;
    }

    const vol = stdDev(rets);
    let level = "HIGH";
    if (vol < 0.015) level = "LOW";
    else if (vol < 0.03) level = "MEDIUM";

    riskCache.set(sym, { ts: now, level });
    return level;
  } catch {
    riskCache.set(sym, { ts: now, level: null });
    return null;
  }
}

/* Export */
module.exports = {
  QUOTE_TTL_MS,
  getQuoteABCached,
  fetchStooqDailySeries,
  estimateStockRiskLevel,
  finnhubState: () => ({ blockedUntil: finnhubBlockedUntil })
};