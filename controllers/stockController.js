// controllers/stockController.js
const db = require('../db');

// User - View their stocks
exports.showMyStocks = (req, res) => {
  try {
    const userId = req.session.user.userId;
    console.log(`DEBUG: showMyStocks() called for user ${userId}`);

    // TODO: Fetch user's stocks from database
    // For now, render empty page
    res.render('stocks', {
      title: 'My Stocks',
      userStocks: []
    });
  } catch (err) {
    console.error("ERROR in showMyStocks():", err);
    req.flash('error', 'Something went wrong.');
    res.redirect('/profile');
  }
};

// User - Add a stock
exports.addStock = async (req, res) => {
  try {
    const userId = req.session.user.userId;
    const { symbol, quantity, purchasePrice } = req.body;

    console.log(`DEBUG: addStock() called with:`, { symbol, quantity, purchasePrice });

    // TODO: Validate input
    // TODO: Insert into stocks table
    // TODO: Update portfolio value

    req.flash('success', 'Stock added successfully.');
    res.redirect('/stocks');
  } catch (err) {
    console.error("ERROR in addStock():", err);
    req.flash('error', 'Failed to add stock.');
    res.redirect('/stocks');
  }
};

// User - Edit a stock
exports.editStock = async (req, res) => {
  try {
    const userId = req.session.user.userId;
    const { stockId } = req.params;
    const { quantity, purchasePrice } = req.body;

    console.log(`DEBUG: editStock() called for stock ${stockId}`);

    // TODO: Verify ownership
    // TODO: Update stock in database
    // TODO: Update portfolio value

    req.flash('success', 'Stock updated successfully.');
    res.redirect('/stocks');
  } catch (err) {
    console.error("ERROR in editStock():", err);
    req.flash('error', 'Failed to update stock.');
    res.redirect('/stocks');
  }
};

// User - Delete a stock
exports.deleteStock = async (req, res) => {
  try {
    const userId = req.session.user.userId;
    const { stockId } = req.params;

    console.log(`DEBUG: deleteStock() called for stock ${stockId}`);

    // TODO: Verify ownership
    // TODO: Delete stock from database
    // TODO: Update portfolio value

    req.flash('success', 'Stock removed successfully.');
    res.redirect('/stocks');
  } catch (err) {
    console.error("ERROR in deleteStock():", err);
    req.flash('error', 'Failed to remove stock.');
    res.redirect('/stocks');
  }
};

// Admin - View all stocks
exports.adminShowAllStocks = (req, res) => {
  try {
    console.log('DEBUG: adminShowAllStocks() called');

    // TODO: Fetch all active stocks
    // TODO: Get freeze status for each stock

    res.render('admin_stocks', {
      title: 'Stock Management',
      stocks: [],
      excessHoldings: []
    });
  } catch (err) {
    console.error("ERROR in adminShowAllStocks():", err);
    req.flash('error', 'Something went wrong.');
    res.redirect('/admin/dashboard');
  }
};

// Admin - Freeze a stock
exports.freezeStock = async (req, res) => {
  try {
    const { stockId } = req.params;

    console.log(`DEBUG: freezeStock() called for stock ${stockId}`);

    // TODO: Update stock status to frozen
    // TODO: Prevent users from trading this stock
    // TODO: Create audit log

    req.flash('success', 'Stock frozen successfully.');
    res.redirect('/admin/stocks');
  } catch (err) {
    console.error("ERROR in freezeStock():", err);
    req.flash('error', 'Failed to freeze stock.');
    res.redirect('/admin/stocks');
  }
};

// Admin - Unfreeze a stock
exports.unfreezeStock = async (req, res) => {
  try {
    const { stockId } = req.params;

    console.log(`DEBUG: unfreezeStock() called for stock ${stockId}`);

    // TODO: Update stock status to active
    // TODO: Allow users to trade this stock again
    // TODO: Create audit log

    req.flash('success', 'Stock unfrozen successfully.');
    res.redirect('/admin/stocks');
  } catch (err) {
    console.error("ERROR in unfreezeStock():", err);
    req.flash('error', 'Failed to unfreeze stock.');
    res.redirect('/admin/stocks');
  }
};

// Admin - Get excess holdings report
exports.getExcessHoldingsReport = async (req, res) => {
  try {
    const { minHoldings, stockType, dateRange } = req.query;

    console.log(`DEBUG: getExcessHoldingsReport() called with filters:`, { minHoldings, stockType, dateRange });

    // TODO: Query users with holdings exceeding limits
    // TODO: Apply filters
    // TODO: Generate report data

    res.render('admin_stocks', {
      title: 'Stock Management - Report',
      excessHoldings: [],
      filters: { minHoldings, stockType, dateRange }
    });
  } catch (err) {
    console.error("ERROR in getExcessHoldingsReport():", err);
    req.flash('error', 'Failed to generate report.');
    res.redirect('/admin/stocks');
  }
};

// Admin - Export report
exports.exportReport = async (req, res) => {
  try {
    console.log('DEBUG: exportReport() called');

    // TODO: Generate CSV or PDF report
    // TODO: Send as download

    req.flash('success', 'Report exported successfully.');
    res.redirect('/admin/stocks');
  } catch (err) {
    console.error("ERROR in exportReport():", err);
    req.flash('error', 'Failed to export report.');
    res.redirect('/admin/stocks');
  }
};
