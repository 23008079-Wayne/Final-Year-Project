"use strict";

const db = require("../db");

// Configuration for purchase thresholds (in USD)
const PURCHASE_THRESHOLDS = {
  tier1: 50,        // $50
  tier2: 100,       // $100
  tier3: 200,       // $200
  tier4: 500,       // $500
  tier5: 1000,      // $1,000
  tier6: 2500,      // $2,500
  tier7: 5000,      // $5,000
  tier8: 10000,     // $10,000
  tier9: 25000,     // $25,000
  tier10: 50000,    // $50,000
  tier11: 100000    // $100,000
};

/* =========================
   HELPER FUNCTIONS
========================= */

// Get total purchase amount for a user in a date range
async function getUserPurchaseTotal(userId, days = 30) {
  const [rows] = await db.promise().query(
    `
    SELECT SUM(qty * price) as totalPurchases
    FROM stock_transactions
    WHERE userId = ? 
      AND txType = 'BUY'
      AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `,
    [userId, days]
  );
  
  return Number(rows[0]?.totalPurchases || 0);
}

// Get all users who exceeded purchase thresholds
async function getUsersExceedingThreshold(threshold, days = 30) {
  const [rows] = await db.promise().query(
    `
    SELECT 
      u.userId,
      u.username,
      u.email,
      a.accountNumber,
      a.accountType,
      pt.totalPurchases,
      pt.transactionCount,
      pt.lastTransaction
    FROM users u
    LEFT JOIN accounts a ON u.userId = a.userId AND a.accountType = 'personal'
    LEFT JOIN (
      SELECT 
        userId,
        COALESCE(SUM(CAST(qty AS DECIMAL(12,2)) * CAST(price AS DECIMAL(12,2))), 0) as totalPurchases,
        COUNT(txId) as transactionCount,
        MAX(created_at) as lastTransaction
      FROM stock_transactions
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY userId
    ) pt ON u.userId = pt.userId
    WHERE COALESCE(pt.totalPurchases, 0) >= ?
    ORDER BY pt.totalPurchases DESC
    `,
    [days, threshold]
  );
  
  return rows;
}

// Track or update a purchase report
async function trackPurchaseReport(userId, totalAmount, threshold, reason = null) {
  try {
    await db.promise().query(
      `
      INSERT INTO purchase_reports 
        (userId, totalAmount, thresholdExceeded, reason, created_at)
      VALUES (?, ?, ?, ?, NOW())
      `,
      [userId, totalAmount, threshold, reason]
    );
  } catch (err) {
    console.error("Error tracking purchase report:", err);
  }
}

/* =========================
   ADMIN ROUTES
========================= */

// GET /admin/reports - Show all purchase reports
async function listPurchaseReports(req, res) {
  try {
    const days = req.query.days || 30;
    const threshold = req.query.threshold || PURCHASE_THRESHOLDS.medium;
    
    const users = await getUsersExceedingThreshold(threshold, days);
    
    // Calculate total amount from all users
    const totalAmount = users.reduce((sum, user) => sum + parseFloat(user.totalPurchases || 0), 0);
    
    res.render('admin_reports', {
      title: 'Purchase Reports',
      reports: users,
      usersCount: users.length,
      totalAmount: totalAmount,
      currentThreshold: threshold,
      threshold,
      days,
      thresholds: PURCHASE_THRESHOLDS
    });
  } catch (err) {
    console.error("Error fetching reports:", err);
    req.flash('error', 'Unable to fetch reports');
    res.redirect('/admin/dashboard');
  }
}

// GET /admin/reports/user/:userId - Detailed report for a user
async function getUserDetailedReport(req, res) {
  try {
    const { userId } = req.params;
    
    // Get user info
    const [userRows] = await db.promise().query(
      `
      SELECT u.userId, u.username, u.email, u.created_at,
             a.accountNumber, a.accountType
      FROM users u
      LEFT JOIN accounts a ON u.userId = a.userId AND a.accountType = 'personal'
      WHERE u.userId = ?
      `,
      [userId]
    );
    
    if (userRows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('/admin/reports');
    }
    
    const user = userRows[0];
    
    // Get detailed transactions
    const [transactions] = await db.promise().query(
      `
      SELECT symbol, txType, qty, price, 
             (qty * price) as value,
             created_at
      FROM stock_transactions
      WHERE userId = ? AND txType = 'BUY'
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [userId]
    );
    
    // Get summary stats (30 days, 90 days, all time)
    const total30 = await getUserPurchaseTotal(userId, 30);
    const total90 = await getUserPurchaseTotal(userId, 90);
    const [allTimeRows] = await db.promise().query(
      `
      SELECT SUM(qty * price) as totalAllTime
      FROM stock_transactions
      WHERE userId = ? AND txType = 'BUY'
      `,
      [userId]
    );
    const totalAllTime = Number(allTimeRows[0]?.totalAllTime || 0);
    
    res.render('admin_user_report', {
      title: `${user.username} - Purchase Report`,
      user,
      transactions,
      stats: {
        days30: total30,
        days90: total90,
        allTime: totalAllTime
      },
      thresholds: PURCHASE_THRESHOLDS
    });
  } catch (err) {
    console.error("Error fetching user report:", err);
    req.flash('error', 'Unable to fetch user report');
    res.redirect('/admin/reports');
  }
}

// GET /admin/reports/export - Export reports as CSV
async function exportReportsCSV(req, res) {
  try {
    const days = req.query.days || 30;
    const threshold = req.query.threshold || PURCHASE_THRESHOLDS.medium;
    
    const users = await getUsersExceedingThreshold(threshold, days);
    
    // Create CSV content
    let csv = 'Username,Email,Account Number,Account Type,Total Purchases,Transaction Count,Last Transaction\n';
    
    users.forEach(user => {
      csv += `"${user.username}","${user.email}","${user.accountNumber}","${user.accountType}",${user.totalPurchases || 0},${user.transactionCount || 0},"${user.lastTransaction || 'N/A'}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="purchase_reports_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error("Error exporting reports:", err);
    req.flash('error', 'Unable to export reports');
    res.redirect('/admin/reports');
  }
}

/* =========================
   API ENDPOINTS
========================= */

// POST /api/reports/check-threshold - Check if user exceeded threshold
async function checkUserThreshold(req, res) {
  try {
    const { userId, days = 30, threshold = PURCHASE_THRESHOLDS.medium } = req.body;
    
    const total = await getUserPurchaseTotal(userId, days);
    const exceeded = total >= threshold;
    
    if (exceeded) {
      await trackPurchaseReport(userId, total, threshold, "Threshold exceeded");
    }
    
    res.json({
      ok: true,
      userId,
      totalPurchases: total,
      threshold,
      exceeded,
      message: exceeded ? `User exceeded $${threshold} threshold with $${total.toFixed(2)}` : 'Below threshold'
    });
  } catch (err) {
    console.error("Error checking threshold:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// Clear all transactions
async function clearAllTransactions(req, res) {
  try {
    // Delete all transactions
    await db.promise().query('DELETE FROM stock_transactions');
    
    // Reset user_holdings to empty
    await db.promise().query('DELETE FROM user_holdings');
    
    console.log("✅ All transactions cleared");
    res.json({ success: true, message: 'All transactions cleared successfully' });
  } catch (err) {
    console.error("Error clearing transactions:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// Export functions
module.exports = {
  listPurchaseReports,
  getUserDetailedReport,
  exportReportsCSV,
  checkUserThreshold,
  clearAllTransactions,
  getUserPurchaseTotal,
  getUsersExceedingThreshold,
  PURCHASE_THRESHOLDS
};
