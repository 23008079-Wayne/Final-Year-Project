// controllers/adminController.js
const db = require('../db');

// ---------------- EXISTING DASHBOARD ----------------
exports.showDashboard = async (req, res) => {
  try {
    const [[userCount]] = await db
      .promise()
      .query('SELECT COUNT(*) AS totalUsers FROM users');

    const [[adminCount]] = await db
      .promise()
      .query('SELECT COUNT(*) AS totalAdmins FROM users WHERE roleId = 2');

    const [[profileCount]] = await db
      .promise()
      .query('SELECT COUNT(*) AS totalProfiles FROM user_profiles');

    res.render('admin_dashboard', {
      title: 'Admin Dashboard',
      stats: {
        totalUsers: userCount.totalUsers,
        totalAdmins: adminCount.totalAdmins,
        totalProfiles: profileCount.totalProfiles
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to load admin dashboard.');
    res.redirect('/');
  }
};

// ---------------- USER MANAGEMENT ----------------

// LIST USERS
exports.listUsers = async (req, res) => {
  try {
    const [users] = await db.promise().query(`
      SELECT u.userId, u.username, u.email, u.roleId, u.created_at, u.isFrozen,
             p.fullName, p.phone
      FROM users u
      LEFT JOIN user_profiles p ON u.userId = p.userId
      ORDER BY u.userId ASC
    `);

    res.render('users', { title: 'Manage Users', users });

  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to load users.');
    res.redirect('/admin/dashboard');
  }
};

// SHOW EDIT PAGE
exports.showEditUser = async (req, res) => {
  const userId = req.params.id;

  try {
    const [rows] = await db.promise().query(`
      SELECT u.userId, u.username, u.email, u.roleId, u.isFrozen,
             p.fullName, p.bio, p.phone, p.address
      FROM users u
      LEFT JOIN user_profiles p ON u.userId = p.userId
      WHERE u.userId = ?
    `, [userId]);

    if (rows.length === 0) {
      req.flash('error', 'User not found.');
      return res.redirect('/admin/users');
    }

    res.render('users_edit', { title: 'Edit User', user: rows[0] });

  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to load user info.');
    res.redirect('/admin/users');
  }
};

// UPDATE USER
exports.updateUser = async (req, res) => {
  const userId = req.params.id;
  const { username, email, fullName, roleId, phone, address, bio } = req.body;

  try {
    await db.promise().query(
      `UPDATE users SET username=?, email=?, roleId=? WHERE userId=?`,
      [username, email, roleId, userId]
    );

    const [profile] = await db.promise().query(
      `SELECT * FROM user_profiles WHERE userId=?`,
      [userId]
    );

    if (profile.length === 0) {
      await db.promise().query(
        `INSERT INTO user_profiles (userId, fullName, bio, phone, address)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, fullName, bio, phone, address]
      );
    } else {
      await db.promise().query(
        `UPDATE user_profiles
         SET fullName=?, bio=?, phone=?, address=?
         WHERE userId=?`,
        [fullName, bio, phone, address, userId]
      );
    }

    req.flash('success', 'User updated successfully.');
    res.redirect('/admin/users');

  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to update user.');
    res.redirect('/admin/users');
  }
};

// DELETE USER
exports.deleteUser = async (req, res) => {
  const userId = req.params.id;

  try {
    await db.promise().query(`DELETE FROM users WHERE userId=?`, [userId]);
    req.flash('success', 'User deleted.');
    res.redirect('/admin/users');

  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to delete user.');
    res.redirect('/admin/users');
  }
};

// FREEZE USER
exports.freezeUser = async (req, res) => {
  const userId = req.params.id;

  try {
    await db.promise().query(
      `UPDATE users SET isFrozen = 1 WHERE userId=?`,
      [userId]
    );

    req.flash('success', 'User account has been frozen.');
    res.redirect('/admin/users');

  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to freeze user.');
    res.redirect('/admin/users');
  }
};

// UNFREEZE USER
exports.unfreezeUser = async (req, res) => {
  const userId = req.params.id;

  try {
    await db.promise().query(
      `UPDATE users SET isFrozen = 0 WHERE userId=?`,
      [userId]
    );

    req.flash('success', 'User account has been unfrozen.');
    res.redirect('/admin/users');

  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to unfreeze user.');
    res.redirect('/admin/users');
  }
};
