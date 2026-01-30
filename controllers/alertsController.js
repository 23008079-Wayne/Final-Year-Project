/*
  alertsController.js
  Handles price alert rules CRUD operations
  Uses db.promise().query() for all MySQL operations
*/

"use strict";

const db = require("../db");

// GET - Render alerts page
async function page(req, res) {
  try {
    const userId = req.session.user?.userId;
    if (!userId) return res.redirect('/login');

    const [rules] = await db.promise().query(
      `SELECT alertId, symbol, alertType, targetPrice, isActive, createdAt
       FROM alert_rules 
       WHERE userId = ? 
       ORDER BY createdAt DESC`,
      [userId]
    );

    res.render("alerts", {
      title: "Price Alerts",
      rules: rules || [],
      currentUser: req.session.user
    });
  } catch (err) {
    console.error("Error loading alerts page:", err);
    req.flash("error", "Failed to load alerts");
    res.redirect("/portfolio");
  }
}

// GET /api/alerts - List all alert rules for user
async function listAlerts(req, res) {
  try {
    const userId = req.session.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const [rules] = await db.promise().query(
      `SELECT alertId, symbol, alertType, targetPrice, isActive, createdAt
       FROM alert_rules 
       WHERE userId = ? 
       ORDER BY createdAt DESC`,
      [userId]
    );

    res.json({ rules: rules || [], success: true });
  } catch (err) {
    console.error('Error listing alerts:', err);
    res.status(500).json({ error: 'Failed to load alerts' });
  }
}

// POST /api/alerts - Create new alert rule
async function createAlert(req, res) {
  try {
    const userId = req.session.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { symbol, alertType, targetPrice } = req.body;

    // Validate input
    if (!symbol || !alertType || !targetPrice) {
      return res.status(400).json({ error: "Missing required fields (symbol, alertType, targetPrice)" });
    }

    const trimmedSymbol = symbol.trim().toUpperCase();
    const numThreshold = parseFloat(targetPrice);

    if (isNaN(numThreshold) || numThreshold <= 0) {
      return res.status(400).json({ error: "Target price must be a positive number" });
    }

    if (!['above', 'below'].includes(alertType)) {
      return res.status(400).json({ error: "Alert type must be 'above' or 'below'" });
    }

    // Insert alert rule
    const [result] = await db.promise().query(
      `INSERT INTO alert_rules (userId, symbol, alertType, targetPrice, isActive)
       VALUES (?, ?, ?, ?, 1)`,
      [userId, trimmedSymbol, alertType, numThreshold]
    );

    res.json({ success: true, alertId: result.insertId, message: 'Alert created successfully' });
  } catch (err) {
    console.error("Error creating alert:", err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: "This alert rule already exists" });
    }
    res.status(500).json({ error: "Failed to create alert" });
  }
}

// PUT /api/alerts/:id - Update alert rule
async function updateAlert(req, res) {
  try {
    const userId = req.session.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { alertId } = req.params;
    const { symbol, alertType, targetPrice, isActive } = req.body;

    if (!alertId) {
      return res.status(400).json({ error: "Alert ID is required" });
    }

    // Verify ownership
    const [check] = await db.promise().query(
      "SELECT alertId FROM alert_rules WHERE alertId = ? AND userId = ?",
      [alertId, userId]
    );

    if (check.length === 0) {
      return res.status(403).json({ error: "Unauthorized - alert not found or not owned by user" });
    }

    // Build update query
    let updateFields = [];
    let params = [];

    if (symbol) {
      updateFields.push("symbol = ?");
      params.push(symbol.toUpperCase());
    }
    if (alertType) {
      if (!['above', 'below'].includes(alertType)) {
        return res.status(400).json({ error: "Alert type must be 'above' or 'below'" });
      }
      updateFields.push("alertType = ?");
      params.push(alertType);
    }
    if (targetPrice !== undefined) {
      const numThreshold = parseFloat(targetPrice);
      if (isNaN(numThreshold) || numThreshold <= 0) {
        return res.status(400).json({ error: "Target price must be a positive number" });
      }
      updateFields.push("targetPrice = ?");
      params.push(numThreshold);
    }
    if (isActive !== undefined) {
      updateFields.push("isActive = ?");
      params.push(isActive ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(alertId);

    const query = `UPDATE alert_rules SET ${updateFields.join(", ")} WHERE alertId = ?`;
    await db.promise().query(query, params);

    res.json({ success: true, message: "Alert updated successfully" });
  } catch (err) {
    console.error("Error updating alert:", err);
    res.status(500).json({ error: "Failed to update alert" });
  }
}

// DELETE /api/alerts/:id - Delete alert rule
async function deleteAlert(req, res) {
  try {
    const userId = req.session.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { alertId } = req.params;

    if (!alertId) {
      return res.status(400).json({ error: "Alert ID is required" });
    }

    // Verify ownership
    const [check] = await db.promise().query(
      "SELECT alertId FROM alert_rules WHERE alertId = ? AND userId = ?",
      [alertId, userId]
    );

    if (check.length === 0) {
      return res.status(403).json({ error: "Unauthorized - alert not found or not owned by user" });
    }

    // Delete the alert
    await db.promise().query("DELETE FROM alert_rules WHERE alertId = ?", [alertId]);

    res.json({ success: true, message: "Alert deleted successfully" });
  } catch (err) {
    console.error("Error deleting alert:", err);
    res.status(500).json({ error: "Failed to delete alert" });
  }
}

module.exports = { page, listAlerts, createAlert, updateAlert, deleteAlert };
