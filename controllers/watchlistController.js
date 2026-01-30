const pool = require('../db');

module.exports.getWatchlist = async (req, res) => {
    try {
        // If user is logged in, get from database
        if (req.session.userId) {
            const [rows] = await pool.promise().query(
                'SELECT * FROM user_watchlist WHERE userId = ? ORDER BY created_at DESC',
                [req.session.userId]
            );
            
            const items = rows.map(row => row.symbol);
            return res.render("watchlist", {
                items: items,
                title: "Watchlist"
            });
        }
        
        // Fallback to session-based for non-logged-in users
        if (!req.session.watchlist) req.session.watchlist = [];
        res.render("watchlist", {
            items: req.session.watchlist,
            title: "Watchlist"
        });
    } catch (err) {
        console.error('Error fetching watchlist:', err);
        res.render("watchlist", {
            items: [],
            title: "Watchlist"
        });
    }
};

module.exports.addToWatchlist = async (req, res) => {
    const symbol = req.body.symbol?.trim().toUpperCase();

    if (!symbol) {
        req.flash("error", "Symbol cannot be empty");
        return res.redirect("/watchlist");
    }

    try {
        // If user is logged in, save to database
        if (req.session.userId) {
            try {
                await pool.promise().query(
                    'INSERT INTO user_watchlist (userId, symbol) VALUES (?, ?)',
                    [req.session.userId, symbol]
                );
                req.flash("success", `${symbol} added to watchlist`);
            } catch (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    req.flash("error", "Symbol already in watchlist");
                } else {
                    throw err;
                }
            }
            
            return res.redirect("/watchlist");
        }
        
        // Fallback to session for non-logged-in users
        if (!req.session.watchlist) req.session.watchlist = [];

        if (!req.session.watchlist.includes(symbol)) {
            req.session.watchlist.push(symbol);
            req.flash("success", `${symbol} added to watchlist`);
        } else {
            req.flash("error", "Symbol already in watchlist");
        }

        res.redirect("/watchlist");
    } catch (err) {
        console.error('Error adding to watchlist:', err);
        req.flash("error", "Failed to add symbol to watchlist");
        res.redirect("/watchlist");
    }
};

module.exports.removeFromWatchlist = async (req, res) => {
    const symbol = req.params.symbol?.trim().toUpperCase();

    try {
        // If user is logged in, delete from database
        if (req.session.userId) {
            await pool.promise().query(
                'DELETE FROM user_watchlist WHERE userId = ? AND symbol = ?',
                [req.session.userId, symbol]
            );
            req.flash("success", `${symbol} removed from watchlist`);
            return res.redirect("/watchlist");
        }

        // Fallback to session for non-logged-in users
        if (req.session.watchlist) {
            req.session.watchlist = req.session.watchlist.filter(
                (item) => item !== symbol
            );
            req.flash("success", `${symbol} removed from watchlist`);
        }

        res.redirect("/watchlist");
    } catch (err) {
        console.error('Error removing from watchlist:', err);
        req.flash("error", "Failed to remove symbol from watchlist");
        res.redirect("/watchlist");
    }
};

module.exports.updateWatchlist = async (req, res) => {
    const { oldSymbol, newSymbol } = req.body;
    const trimmedOldSymbol = oldSymbol?.trim().toUpperCase();
    const trimmedNewSymbol = newSymbol?.trim().toUpperCase();

    if (!trimmedOldSymbol || !trimmedNewSymbol) {
        req.flash("error", "Both symbols are required");
        return res.redirect("/watchlist");
    }

    try {
        // If user is logged in, update in database
        if (req.session.userId) {
            try {
                // Check if old symbol exists
                const [oldExists] = await pool.promise().query(
                    'SELECT * FROM user_watchlist WHERE userId = ? AND symbol = ?',
                    [req.session.userId, trimmedOldSymbol]
                );
                
                if (oldExists.length === 0) {
                    req.flash("error", "Symbol not found in watchlist");
                    return res.redirect("/watchlist");
                }
                
                // Check if new symbol already exists
                const [newExists] = await pool.promise().query(
                    'SELECT * FROM user_watchlist WHERE userId = ? AND symbol = ?',
                    [req.session.userId, trimmedNewSymbol]
                );
                
                if (newExists.length > 0 && trimmedNewSymbol !== trimmedOldSymbol) {
                    req.flash("error", "New symbol already exists in watchlist");
                    return res.redirect("/watchlist");
                }
                
                // Update the symbol
                await pool.promise().query(
                    'UPDATE user_watchlist SET symbol = ? WHERE userId = ? AND symbol = ?',
                    [trimmedNewSymbol, req.session.userId, trimmedOldSymbol]
                );
                
                req.flash("success", `Updated ${trimmedOldSymbol} to ${trimmedNewSymbol}`);
            } catch (err) {
                throw err;
            }
            
            return res.redirect("/watchlist");
        }

        // Fallback to session for non-logged-in users
        if (!req.session.watchlist) req.session.watchlist = [];

        const index = req.session.watchlist.indexOf(trimmedOldSymbol);
        
        if (index === -1) {
            req.flash("error", "Symbol not found in watchlist");
            return res.redirect("/watchlist");
        }

        if (req.session.watchlist.includes(trimmedNewSymbol) && trimmedNewSymbol !== trimmedOldSymbol) {
            req.flash("error", "New symbol already exists in watchlist");
            return res.redirect("/watchlist");
        }

        req.session.watchlist[index] = trimmedNewSymbol;
        req.flash("success", `Updated ${trimmedOldSymbol} to ${trimmedNewSymbol}`);
        
        res.redirect("/watchlist");
    } catch (err) {
        console.error('Error updating watchlist:', err);
        req.flash("error", "Failed to update watchlist");
        res.redirect("/watchlist");
    }
};

// JSON endpoint for the Watchlist tab (used by the new UI)
module.exports.getWatchlistApi = async (req, res) => {
  try {
    // If logged in, read from DB; else fall back to session
    if (req.session.userId || (req.session.user && req.session.user.userId)) {
      const userId = req.session.userId || req.session.user.userId;
      const [rows] = await pool.promise().query(
        'SELECT symbol FROM user_watchlist WHERE userId = ? ORDER BY created_at DESC',
        [userId]
      );
      const items = (rows || []).map(r => ({ symbol: r.symbol }));
      return res.json({ items });
    }
    if (!req.session.watchlist) req.session.watchlist = [];
    return res.json({ items: req.session.watchlist.map(s => ({ symbol: s })) });
  } catch (err) {
    console.error('Error fetching watchlist api:', err);
    res.status(500).json({ error: 'Failed to load watchlist' });
  }
};

// JSON API: Add to watchlist
module.exports.addToWatchlistApi = async (req, res) => {
  const symbol = req.body.symbol?.trim().toUpperCase();

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  try {
    const userId = req.session.userId || req.session.user?.userId;
    
    console.log('DEBUG addToWatchlistApi:', { symbol, userId, sessionUser: req.session.user });
    
    if (!userId) {
      console.error('No userId found in session:', req.session);
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log(`Inserting into user_watchlist: userId=${userId}, symbol=${symbol}`);
    
    const result = await pool.promise().query(
      'INSERT INTO user_watchlist (userId, symbol) VALUES (?, ?)',
      [userId, symbol]
    );
    
    console.log('Successfully added to watchlist:', result);
    res.status(201).json({ success: true, symbol });
  } catch (err) {
    console.error('Error adding to watchlist - Full error:', err.message, err.code, err.sql);
    
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Symbol already in watchlist' });
    }
    
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'User not found in database' });
    }
    
    console.error('Error adding to watchlist:', err);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
};

// JSON API: Remove from watchlist
module.exports.removeFromWatchlistApi = async (req, res) => {
  const symbol = req.params.symbol?.trim().toUpperCase();

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  try {
    const userId = req.session.userId || req.session.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const [result] = await pool.promise().query(
      'DELETE FROM user_watchlist WHERE userId = ? AND symbol = ?',
      [userId, symbol]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Symbol not found in watchlist' });
    }

    res.json({ success: true, symbol });
  } catch (err) {
    console.error('Error removing from watchlist:', err);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
};

// JSON API: Update watchlist symbol
module.exports.updateWatchlistApi = async (req, res) => {
  const oldSymbol = req.params.symbol?.trim().toUpperCase();
  const newSymbol = req.body.newSymbol?.trim().toUpperCase();

  if (!oldSymbol || !newSymbol) {
    return res.status(400).json({ error: 'Both oldSymbol and newSymbol are required' });
  }

  if (oldSymbol === newSymbol) {
    return res.status(400).json({ error: 'New symbol must be different from old symbol' });
  }

  try {
    const userId = req.session.userId || req.session.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if old symbol exists
    const [oldExists] = await pool.promise().query(
      'SELECT * FROM user_watchlist WHERE userId = ? AND symbol = ?',
      [userId, oldSymbol]
    );

    if (oldExists.length === 0) {
      return res.status(404).json({ error: 'Old symbol not found in watchlist' });
    }

    // Check if new symbol already exists
    const [newExists] = await pool.promise().query(
      'SELECT * FROM user_watchlist WHERE userId = ? AND symbol = ?',
      [userId, newSymbol]
    );

    if (newExists.length > 0) {
      return res.status(409).json({ error: 'New symbol already exists in watchlist' });
    }

    // Update the symbol
    await pool.promise().query(
      'UPDATE user_watchlist SET symbol = ? WHERE userId = ? AND symbol = ?',
      [newSymbol, userId, oldSymbol]
    );

    res.json({ success: true, oldSymbol, newSymbol });
  } catch (err) {
    console.error('Error updating watchlist:', err);
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
};
