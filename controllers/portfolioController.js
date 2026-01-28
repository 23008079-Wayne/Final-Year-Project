/*
  portfolioController.js
  Handles:
  - GET /portfolio (page render)
  - GET /api/portfolio-live (live prices + allocation + P/L + risk warning)
  - GET /api/portfolio-history (30D portfolio value series)
*/

"use strict";

const db = require("../db");

let quoteController;

function init(deps) {
  quoteController = deps.quoteController;
}

/* Demo holdings (used only if DB table is empty or missing) */
const DEMO_PORTFOLIO_HOLDINGS = [
  { symbol: "AAPL", qty: 15, avg: 162.1 },
  { symbol: "TSLA", qty: 5, avg: 190.3 },
  { symbol: "NVDA", qty: 4, avg: 450.88 },
  { symbol: "AMZN", qty: 10, avg: 98.32 }
];

/* DB helpers */
async function getUserHoldingsFromDb(userId) {
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT symbol, qty, avgPrice AS avg FROM user_holdings WHERE userId = ? ORDER BY symbol ASC",
        [userId]
      );

    if (!Array.isArray(rows) || rows.length === 0) return null;

    return rows.map((r) => ({
      symbol: String(r.symbol || "").toUpperCase(),
      qty: Number(r.qty || 0),
      avg: Number(r.avg || 0)
    }));
  } catch {
    return null;
  }
}

async function getUserRiskTolerance(userId) {
  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT riskTolerance FROM user_risk_profiles WHERE userId = ? ORDER BY updated_at DESC LIMIT 1",
        [userId]
      );

    return rows?.[0]?.riskTolerance ? String(rows[0].riskTolerance) : null;
  } catch {
    return null;
  }
}

function normalizeUserRisk(riskTolerance) {
  const r = String(riskTolerance || "").toLowerCase();
  if (r.includes("low") || r.includes("conservative")) return "LOW";
  if (r.includes("med") || r.includes("balanced")) return "MEDIUM";
  if (r.includes("high") || r.includes("aggressive")) return "HIGH";
  return null;
}

function riskRank(level) {
  if (level === "LOW") return 1;
  if (level === "MEDIUM") return 2;
  if (level === "HIGH") return 3;
  return 0;
}

/* Page render */
async function page(req, res) {
  const userId = req.session.user?.userId;

  const holdingsFromDb = userId ? await getUserHoldingsFromDb(userId) : null;
  const holdings = holdingsFromDb || DEMO_PORTFOLIO_HOLDINGS;

  res.render("portfolio", {
    title: "My Portfolio",
    portfolio: {
      totalValue: 0,
      dailyChange: 0,
      dailyPercent: 0,
      holdings
    }
  });
}

/* Live API */
async function live(req, res) {
  const userId = req.session.user?.userId;

  const holdingsFromDb = userId ? await getUserHoldingsFromDb(userId) : null;
  const holdings = holdingsFromDb || DEMO_PORTFOLIO_HOLDINGS;

  const userRiskTolRaw = userId ? await getUserRiskTolerance(userId) : null;
  const userRiskTol = normalizeUserRisk(userRiskTolRaw);

  try {
    let totalValue = 0;
    const allocation = [];

    for (const h of holdings) {
      const sym = String(h.symbol || "").toUpperCase();
      const qty = Number(h.qty || 0);
      const avg = Number(h.avg || 0);

      // Default to avg cost if live price fails
      let livePriceToUse = Number.isFinite(avg) ? avg : 0;
      let sourceToUse = "avg-fallback";
      let staleToUse = true;

      try {
        const { quote, stale, source } = await quoteController.getQuoteABCached(sym);
        const livePrice = Number(quote?.c);
        if (Number.isFinite(livePrice)) {
          livePriceToUse = livePrice;
          sourceToUse = source;
          staleToUse = !!stale;
        }
      } catch {
        // ignore
      }

      const marketValue = Number.isFinite(livePriceToUse) ? livePriceToUse * qty : 0;
      totalValue += marketValue;

      // P/L requires avg price (avg is your cost basis)
      const pl = (livePriceToUse - avg) * qty;
      const cost = avg * qty;
      const plPercent = cost > 0 ? (pl / cost) * 100 : 0;

      // Stock risk estimate (free)
      const stockRisk = await quoteController.estimateStockRiskLevel(sym);
      const riskWarning =
        userRiskTol && stockRisk ? riskRank(stockRisk) > riskRank(userRiskTol) : false;

      allocation.push({
        symbol: sym,
        qty,
        avg: Math.round(avg * 100) / 100,
        price: Math.round(livePriceToUse * 100) / 100,
        value: Math.round(marketValue * 100) / 100,
        pl: Math.round(pl * 100) / 100,
        plPercent: Math.round(plPercent * 100) / 100,
        source: sourceToUse,
        stale: staleToUse,
        userRiskTolerance: userRiskTol || null,
        stockRisk: stockRisk || null,
        riskWarning
      });
    }

    res.json({
      ok: true,
      totalValue: Math.round(totalValue * 100) / 100,
      allocation
    });
  } catch (err) {
    console.error("PORTFOLIO LIVE ERROR:", err?.message || err);

    // Return JSON to keep frontend stable
    res.status(200).json({
      ok: false,
      totalValue: 0,
      allocation: holdings.map((h) => ({
        symbol: String(h.symbol || "").toUpperCase(),
        qty: Number(h.qty || 0),
        avg: Number(h.avg || 0),
        price: Number(h.avg || 0),
        value: 0,
        pl: 0,
        plPercent: 0,
        source: "fallback",
        stale: true,
        userRiskTolerance: null,
        stockRisk: null,
        riskWarning: false
      }))
    });
  }
}

/* 30D portfolio history (cached per user) */
const portfolioHistoryCacheByUser = new Map(); // userId -> { ts, data }
const PORTFOLIO_HISTORY_TTL_MS = 5 * 60 * 1000;

async function history(req, res) {
  const userId = req.session.user?.userId || 0;

  try {
    const now = Date.now();
    const cached = portfolioHistoryCacheByUser.get(userId);

    if (cached && cached.data && now - cached.ts < PORTFOLIO_HISTORY_TTL_MS) {
      return res.json(cached.data);
    }

    const holdingsFromDb = userId ? await getUserHoldingsFromDb(userId) : null;
    const holdings = holdingsFromDb || DEMO_PORTFOLIO_HOLDINGS;

    if (!holdings || holdings.length === 0) {
      const empty = { labels: [], values: [] };
      portfolioHistoryCacheByUser.set(userId, { ts: now, data: empty });
      return res.json(empty);
    }

    // Fetch 30D series for each symbol (Stooq)
    const seriesBySymbol = {};
    for (const h of holdings) {
      const s = String(h.symbol).toUpperCase();
      seriesBySymbol[s] = await quoteController.fetchStooqDailySeries(s, 30);
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
    portfolioHistoryCacheByUser.set(userId, { ts: now, data: payload });

    res.json(payload);
  } catch (err) {
    console.error("PORTFOLIO HISTORY ERROR:", err?.message || err);
    res.status(200).json({ labels: [], values: [] });
  }
}

module.exports = { init, page, live, history };
