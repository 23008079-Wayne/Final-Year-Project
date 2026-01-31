/*
  marketController.js
  Handles:
  - GET / (home)
  - GET /market
  - GET /chart/:symbol
*/

"use strict";

let quoteController;

function init(deps) {
  quoteController = deps.quoteController;
}

const ALL_STOCKS = [
  // Mega-cap Tech
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","NFLX","AMD","INTC",
  // Payments / Fintech
  "V","MA","PYPL","SQ",
  // Enterprise / Cloud / Software
  "ORCL","CRM","ADBE","NOW","IBM","SNOW","PLTR",
  // Semis / Hardware
  "AVGO","QCOM","TXN","MU","AMAT",
  // Consumer / Retail
  "DIS","NKE","SBUX","MCD","KO","PEP","COST","WMT","TGT",
  // EV / Industrial
  "F","GM","BA","CAT","GE",
  // Healthcare
  "JNJ","PFE","UNH","ABBV",
  // Financials
  "JPM","BAC","GS",
  // Energy
  "XOM","CVX",
  // China / Others (popular tickers)
  "BABA","TSM","SHOP","UBER"
];


async function buildCards(symbols) {
  const results = [];

  for (const symbol of symbols) {
    let quoteObj = { c: null, d: null, dp: null };
    try {
      const { quote } = await quoteController.getQuoteABCached(symbol);
      quoteObj = quote;
    } catch {
      // ignore
    }

    // For your mini chart (use Stooq daily series)
    let graph = { labels: [], prices: [] };
    try {
      const stooq = await quoteController.fetchStooqDailySeries(symbol, 30);
      graph.labels = stooq.labels;
      graph.prices = stooq.prices;
    } catch {
      // ignore
    }

    // Final fallback so chart never breaks
    if (!graph.prices || graph.prices.length === 0) {
      const p = Number(quoteObj?.c) || 0;
      graph.labels = ["1", "2", "3"];
      graph.prices = [p, p, p];
    }

    results.push({ symbol, quote: quoteObj, graph });
  }

  return results;
}

async function home(req, res) {
  if (!req.session.user) {
    return res.render("homepage", { title: "Marketmind - Stock Management Platform" });
  }

  const page = parseInt(req.query.page, 10) || 1;
  const perPage = 6;

  const start = (page - 1) * perPage;
  const end = start + perPage;

  const symbols = ALL_STOCKS.slice(start, end);
  const totalPages = Math.ceil(ALL_STOCKS.length / perPage);

  try {
    const results = await buildCards(symbols);
    res.render("home", { results, page, totalPages, title: "Marketmind" });
  } catch (err) {
    console.error("HOME ERROR:", err?.message || err);
    res.render("home", { results: [], page: 1, totalPages: 0, title: "Marketmind" });
  }
}

async function market(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const perPage = 6;

  const symbol = String(req.query.symbol || ALL_STOCKS[0] || "AAPL").toUpperCase();

  const start = (page - 1) * perPage;
  const end = start + perPage;

  const symbols = ALL_STOCKS.slice(start, end);
  const totalPages = Math.ceil(ALL_STOCKS.length / perPage);

  try {
    const results = await buildCards(symbols);

    res.render("market", {
      title: "StockAI Terminal – Market",
      results,
      page,
      totalPages,
      watchlist: ALL_STOCKS,
      symbol
    });
  } catch (err) {
    console.error("MARKET ERROR:", err?.message || err);
    res.status(500).send("Error loading market page");
  }
}

function chart(req, res) {
  res.render("chart", { title: "StockAI Terminal – Chart", symbol: String(req.params.symbol || "").toUpperCase() });
}

module.exports = { init, home, market, chart };