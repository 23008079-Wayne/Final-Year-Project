"use strict";

const db = require("../db");
const quoteController = require("./quoteController");

/* =========================
   Helpers
========================= */
function money(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}

/* =========================
   DB helpers (PAPER only)
========================= */

// PAPER wallet
async function getPaperAccount(userId) {
  const [rows] = await db.promise().query(
    "SELECT accountId, balance FROM accounts WHERE userId = ? AND accountType = 'paper' LIMIT 1",
    [userId]
  );
  return rows[0] || null;
}

// PAPER holdings list
async function listPaperHoldings(userId) {
  const [rows] = await db.promise().query(
    `
    SELECT 
      UPPER(symbol) AS symbol,
      qty,
      avgPrice
    FROM user_holdings
    WHERE userId = ?
      AND mode = 'PAPER'
      AND qty > 0
    ORDER BY symbol ASC
    `,
    [userId]
  );
  return rows;
}

// PAPER transactions
async function listPaperTxs(userId) {
  const [rows] = await db.promise().query(
    `
    SELECT txType, symbol, qty, price, created_at
    FROM stock_transactions
    WHERE userId = ?
      AND mode = 'PAPER'
    ORDER BY created_at DESC
    LIMIT 50
    `,
    [userId]
  );
  return rows;
}

// PAPER holding qty (for SELL validation)
async function getPaperHoldingQty(userId, symbol) {
  const [rows] = await db.promise().query(
    `
    SELECT qty
    FROM user_holdings
    WHERE userId = ?
      AND symbol = UPPER(?)
      AND mode = 'PAPER'
    LIMIT 1
    `,
    [userId, symbol]
  );
  return rows[0] ? Number(rows[0].qty) : 0;
}

/* =========================
   PAGE
========================= */

// GET /paper-trading
async function page(req, res) {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) return res.redirect("/login");

    const acct = await getPaperAccount(userId);
    if (!acct) {
      req.flash("error", "Paper account not found.");
      return res.redirect("/portfolio");
    }

    const holdingsList = await listPaperHoldings(userId);
    const txs = await listPaperTxs(userId);

    // ⚠️ filename must match views/papertrading.ejs
    res.render("papertrading", {
      title: "Paper Trading",
      account: {
        balance: acct.balance,
        totalInvested: 0,
        totalReturns: 0
      },
      holdingsList,
      txs
    });
  } catch (err) {
    console.error("paperTradingController.page error:", err);
    res.status(500).send("Error loading paper trading page");
  }
}

/* =========================
   TRADES
========================= */

async function createTrade(req, res) {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    let { symbol, qty, txType } = req.body;
    symbol = String(symbol || "").toUpperCase().trim();
    qty = Number(qty);
    txType = String(txType || "BUY").toUpperCase();

    if (!symbol) return res.status(400).json({ ok: false, error: "Symbol is required" });
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ ok: false, error: "Qty must be > 0" });
    if (!["BUY", "SELL"].includes(txType)) return res.status(400).json({ ok: false, error: "Invalid txType" });

    const acct = await getPaperAccount(userId);
    if (!acct) return res.status(404).json({ ok: false, error: "Paper account not found" });

    const { quote } = await quoteController.getQuoteABCached(symbol);
    const livePrice = Number(quote?.c);

    if (!Number.isFinite(livePrice) || livePrice <= 0) {
      return res.status(400).json({ ok: false, error: "Live price not available" });
    }

    const tradeValue = money(livePrice * qty);
    const conn = db.promise();

    /* ========= BUY ========= */
    if (txType === "BUY") {
      if (tradeValue > Number(acct.balance)) {
        return res.status(400).json({ ok: false, error: "Insufficient paper funds" });
      }

      const newBal = money(Number(acct.balance) - tradeValue);

      try {
        await conn.beginTransaction();

        await conn.query(
          "UPDATE accounts SET balance = ? WHERE accountId = ?",
          [newBal, acct.accountId]
        );

        await conn.query(
          `
          INSERT INTO stock_transactions
            (userId, symbol, txType, qty, price, dataSource, isStale, mode, created_at)
          VALUES
            (?, ?, 'BUY', ?, ?, 'cache', 1, 'PAPER', NOW())
          `,
          [userId, symbol, qty, livePrice]
        );

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      }

      return res.json({
        ok: true,
        txType: "BUY",
        symbol,
        qty,
        price: livePrice,
        newBalance: newBal
      });
    }

    /* ========= SELL ========= */
    const owned = await getPaperHoldingQty(userId, symbol);
    if (owned < qty) {
      return res.status(400).json({ ok: false, error: "Not enough shares" });
    }

    const newBal = money(Number(acct.balance) + tradeValue);

    try {
      await conn.beginTransaction();

      await conn.query(
        "UPDATE accounts SET balance = ? WHERE accountId = ?",
        [newBal, acct.accountId]
      );

      await conn.query(
        `
        INSERT INTO stock_transactions
          (userId, symbol, txType, qty, price, dataSource, isStale, mode, created_at)
        VALUES
          (?, ?, 'SELL', ?, ?, 'cache', 1, 'PAPER', NOW())
        `,
        [userId, symbol, qty, livePrice]
      );

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    }

    return res.json({
      ok: true,
      txType: "SELL",
      symbol,
      qty,
      price: livePrice,
      newBalance: newBal
    });

  } catch (err) {
    console.error("paperTradingController.createTrade error:", err);
    res.status(500).json({
      ok: false,
      error: "Server error executing paper trade",
      detail: err?.sqlMessage || err?.message
    });
  }
}

/* =========================
   DELETE PAPER HOLDING
========================= */

async function deleteHolding(req, res) {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) return res.status(401).json({ ok: false, error: "Not logged in" });

    const symbol = String(req.params.symbol || "").toUpperCase().trim();

    await db.promise().query(
      "DELETE FROM user_holdings WHERE userId = ? AND symbol = UPPER(?) AND mode = 'PAPER'",
      [userId, symbol]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("paperTradingController.deleteHolding error:", err);
    res.status(500).json({ ok: false, error: "Error deleting paper holding" });
  }
}

/* =========================
   SUMMARY
========================= */

async function summary(req, res) {
  try {
    const userId = req.session?.user?.userId;
    if (!userId) return res.status(401).json({ ok: false, error: "Not logged in" });

    const acct = await getPaperAccount(userId);
    if (!acct) return res.status(404).json({ ok: false, error: "Paper account not found" });

    const holdings = await listPaperHoldings(userId);

    const totalInvested = holdings.reduce(
      (s, h) => s + Number(h.qty) * Number(h.avgPrice),
      0
    );

    let marketValue = 0;
    for (const h of holdings) {
      try {
        const { quote } = await quoteController.getQuoteABCached(h.symbol);
        const live = Number(quote?.c);
        if (Number.isFinite(live)) marketValue += live * Number(h.qty);
      } catch {}
    }

    res.json({
      ok: true,
      balance: money(acct.balance),
      totalInvested: money(totalInvested),
      totalReturns: money(marketValue - totalInvested)
    });
  } catch (err) {
    console.error("paperTradingController.summary error:", err);
    res.status(500).json({ ok: false, error: "Error computing paper summary" });
  }
}

/* =========================
   EXPORTS
========================= */

module.exports = {
  page,
  createTrade,
  deleteHolding,
  summary
};
