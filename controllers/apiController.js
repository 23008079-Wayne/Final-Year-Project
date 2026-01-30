/*
  apiController.js
  Handles:
  - /api/health Testing Phase to see live or not
  - /api/ticker ticker bar 
  - /api/page-quotes quotes for 
  - /api/quote/:symbol Stock Symbol
*/

"use strict";

let quoteController;

function init(deps) {
  quoteController = deps.quoteController;
}

function health(req, res) {
  res.json({ ok: true, time: new Date().toISOString() });
}

const TICKER_SYMBOLS = ["AAPL", "MSFT", "AMZN", "TSLA", "NVDA", "GOOGL", "META", "NFLX"];

async function ticker(req, res) {
  try {
    const rows = [];
    for (const s of TICKER_SYMBOLS) {
      const { quote, stale, source } = await quoteController.getQuoteABCached(s);
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
      ttlMs: quoteController.QUOTE_TTL_MS,
      finnhubCooldown: Date.now() < quoteController.finnhubState().blockedUntil,
      symbols: rows
    });
  } catch {
    res.status(500).json({ error: "Ticker unavailable" });
  }
}

async function pageQuotes(req, res) {
  try {
    const raw = String(req.query.symbols || "");
    const list = raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20);

    const out = {};
    for (const s of list) {
      const { quote, stale, source } = await quoteController.getQuoteABCached(s);
      out[s] = { quote, stale, source };
    }

    res.json({
      updatedAt: new Date().toISOString(),
      ttlMs: quoteController.QUOTE_TTL_MS,
      symbols: out
    });
  } catch {
    res.status(500).json({ error: "Page quotes unavailable" });
  }
}

async function singleQuote(req, res) {
  try {
    const symbol = String(req.params.symbol || "").toUpperCase();
    
    if (!symbol || symbol.length === 0) {
      return res.status(400).json({ error: "Symbol required" });
    }

    const { quote, stale, source } = await quoteController.getQuoteABCached(symbol);
    
    // Validate that we have a valid price
    const price = quote?.c;
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(404).json({ 
        error: "Quote unavailable for symbol",
        symbol: symbol,
        source: source,
        stale: stale
      });
    }
    
    res.json({ ...quote, stale, source });
  } catch (error) {
    console.error('[apiController.singleQuote]', error.message);
    res.status(500).json({ error: "Live quote unavailable", details: error.message });
  }
}

module.exports = { init, health, ticker, pageQuotes, singleQuote };