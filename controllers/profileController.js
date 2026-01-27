// Remove wallet address for current user
exports.removeWalletAddress = async (req, res) => {
  console.log("DEBUG: removeWalletAddress() called");
  console.log("DEBUG: Session:", req.session);
  console.log("DEBUG: User:", req.session?.user);
  
  if (!req.session || !req.session.user) {
    console.log("DEBUG: No session or user found");
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const userId = req.session.user.userId;
  console.log("DEBUG: removeWalletAddress() called for user:", userId);
  
  try {
    console.log("DEBUG: Executing UPDATE query...");
    const result = await db.promise().query(
      'UPDATE user_profiles SET walletAddress = NULL WHERE userId = ?',
      [userId]
    );
    console.log("DEBUG: Query result:", result);
    console.log("DEBUG: Wallet address removed successfully");
    res.json({ success: true });
  } catch (err) {
    console.error("DEBUG: Error removing wallet:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
// controllers/profileController.js
const db = require('../db');
const bcrypt = require('bcrypt');

exports.showProfile = async (req, res) => {
  const userId = req.session.user.userId;

  try {
    const [rows] = await db.promise().query(
      `SELECT u.userId, u.username, u.email, u.roleId,
              p.fullName, p.bio, p.phone, p.avatar, p.address, p.walletAddress
       FROM users u
       LEFT JOIN user_profiles p ON u.userId = p.userId
       WHERE u.userId = ?`,
      [userId]
    );

    if (rows.length === 0) {
      req.flash('error', 'User not found.');
      return res.redirect('/login');
    }

    res.render('profile', {
      title: 'My Profile',
      userProfile: rows[0]
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to load profile.');
    res.redirect('/');
  }
};

exports.updateProfile = async (req, res) => {
  const userId = req.session.user.userId;
  const { fullName, bio, phone, address, email, username, walletAddress } = req.body;
  const avatarFile = req.file ? req.file.filename : null;

  // ---- BASIC VALIDATION ----
  if (!fullName || !email || !phone || !address || !username) {
    req.flash('error', 'Full name, email, phone, address, and username are required.');
    return res.redirect('/profile');
  }

  // Validate full name (only letters and spaces)
  const fullNameRegex = /^[A-Za-z\s]+$/;
  if (!fullNameRegex.test(fullName.trim())) {
    req.flash('error', 'Full name should only contain letters and spaces.');
    return res.redirect('/profile');
  }

  // Validate email format (must be gmail.com)
  const emailRegex = /^[^\s@]+@gmail\.com$/;
  if (!emailRegex.test(email.trim().toLowerCase())) {
    req.flash('error', 'Please enter a valid Gmail address (ending with @gmail.com)');
    return res.redirect('/profile');
  }

  const usernameRegex = /^[A-Za-z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    req.flash('error', 'Username must be 3–20 characters with letters, numbers, underscore only.');
    return res.redirect('/profile');
  }

  // Validate wallet address if provided
  if (walletAddress && walletAddress.trim()) {
    const walletRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!walletRegex.test(walletAddress.trim())) {
      req.flash('error', 'Invalid wallet address. Must be valid Ethereum address (0x + 40 hex characters).');
      return res.redirect('/profile');
    }
  }

  const phoneRegex = /^[0-9]{8,15}$/;
  if (!phoneRegex.test(phone)) {
    req.flash('error', 'Phone number must be 8–15 digits.');
    return res.redirect('/profile');
  }

  try {
    const [existingUsernames] = await db.promise().query(
      'SELECT userId FROM users WHERE username = ? AND userId <> ?',
      [username, userId]
    );

    if (existingUsernames.length > 0) {
      req.flash('error', 'This username is already taken.');
      return res.redirect('/profile');
    }

    await db
      .promise()
      .query(
        'UPDATE users SET email = ?, username = ? WHERE userId = ?',
        [email, username, userId]
      );

    const [profiles] = await db
      .promise()
      .query('SELECT * FROM user_profiles WHERE userId = ?', [userId]);

    if (profiles.length === 0) {
      await db.promise().query(
        `INSERT INTO user_profiles 
         (userId, fullName, bio, phone, address, walletAddress, avatar) 
         VALUES (?,?,?,?,?,?,?)`,
        [userId, fullName, bio || null, phone, address, walletAddress || null, avatarFile || null]
      );
    } else {
      const sql = avatarFile
        ? `UPDATE user_profiles SET fullName=?, bio=?, phone=?, address=?, walletAddress=?, avatar=? WHERE userId=?`
        : `UPDATE user_profiles SET fullName=?, bio=?, phone=?, address=?, walletAddress=? WHERE userId=?`;

      const params = avatarFile
        ? [fullName, bio || null, phone, address, walletAddress || null, avatarFile, userId]
        : [fullName, bio || null, phone, address, walletAddress || null, userId];

      await db.promise().query(sql, params);
    }

    req.session.user.email = email;
    req.session.user.username = username;

    req.flash('success', 'Profile updated successfully.');
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error updating profile.');
    res.redirect('/profile');
  }
};


// -------------------------------
// FIXED CHANGE PASSWORD FUNCTION
// -------------------------------
exports.updatePassword = async (req, res) => {
  const userId = req.session.user.userId;
  const { currentPassword, newPassword, confirmPassword } = req.body;

  try {
    const [rows] = await db.promise().query(
      'SELECT password FROM users WHERE userId = ?',
      [userId]
    );

    if (rows.length === 0) {
      req.flash('error', 'User not found.');
      return res.redirect('/profile');
    }

    const currentHash = rows[0].password;

    // 1. Check correct current password
    const match = await bcrypt.compare(currentPassword, currentHash);
    if (!match) {
      req.flash('error', 'Current password is incorrect.');
      return res.redirect('/profile');
    }

    // 2. Prevent using the same password again
    const sameAsOld = await bcrypt.compare(newPassword, currentHash);
    if (sameAsOld) {
      req.flash('error', 'New password cannot be the same as the current password.');
      return res.redirect('/profile');
    }

    // 3. Confirm password check
    if (newPassword !== confirmPassword) {
      req.flash('error', 'New passwords do not match.');
      return res.redirect('/profile');
    }

    // 4. Password strength validation
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!strongPasswordRegex.test(newPassword)) {
      req.flash(
        'error',
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      );
      return res.redirect('/profile');
    }

    // 5. Hash + update password
    const newHash = await bcrypt.hash(newPassword, 10);

    await db
      .promise()
      .query('UPDATE users SET password = ? WHERE userId = ?', [
        newHash,
        userId
      ]);

    req.flash('success', 'Password updated successfully.');
    res.redirect('/profile');

  } catch (err) {
    console.error(err);
    req.flash('error', 'Error updating password.');
    res.redirect('/profile');
  }
};
// GET /profile/risk - Show risk profile
exports.showRiskProfile = async (req, res) => {
  const userId = req.session.user.userId;

  try {
    // Fetch risk profile
    const [riskRows] = await db.promise().query(
      `SELECT u.userId, u.username, u.email,
              rp.riskTolerance, rp.investmentExperience, rp.annualIncome, rp.investmentGoal, rp.timeHorizon, rp.completedAt
       FROM users u
       LEFT JOIN user_risk_profiles rp ON u.userId = rp.userId
       WHERE u.userId = ?`,
      [userId]
    );

    // Fetch user profile (for wallet address, etc)
    const [profileRows] = await db.promise().query(
      `SELECT * FROM user_profiles WHERE userId = ?`,
      [userId]
    );

    if (riskRows.length === 0) {
      req.flash('error', 'User not found.');
      return res.redirect('/login');
    }

    res.render('risk_profile', {
      title: 'Investment Profile',
      userRisk: riskRows[0],
      userProfile: profileRows[0] || {}
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Unable to load risk profile.');
    res.redirect('/profile');
  }
};

// POST /profile/risk - Update risk profile
exports.updateRiskProfile = async (req, res) => {
  const userId = req.session.user.userId;
  const { riskTolerance, investmentExperience, annualIncome, investmentGoal, timeHorizon, age, netWorth } = req.body;

  if (!riskTolerance || !investmentExperience || !investmentGoal || !timeHorizon || !age) {
    req.flash('error', 'All required fields must be filled.');
    return res.redirect('/profile/risk');
  }

  // Validate age - must be at least 18
  const ageNum = parseInt(age);
  if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
    req.flash('error', 'You must be at least 18 years old to invest.');
    return res.redirect('/profile/risk');
  }

  try {
    // Check if risk profile exists
    const [existing] = await db.promise().query(
      'SELECT riskProfileId FROM user_risk_profiles WHERE userId = ?',
      [userId]
    );

    if (existing.length > 0) {
      // Update existing
      await db.promise().query(
        `UPDATE user_risk_profiles 
         SET riskTolerance = ?, investmentExperience = ?, annualIncome = ?, investmentGoal = ?, timeHorizon = ?, age = ?, netWorth = ?, completedAt = NOW()
         WHERE userId = ?`,
        [riskTolerance, investmentExperience, annualIncome || null, investmentGoal, timeHorizon, age || null, netWorth || null, userId]
      );
    } else {
      // Create new
      await db.promise().query(
        `INSERT INTO user_risk_profiles (userId, riskTolerance, investmentExperience, annualIncome, investmentGoal, timeHorizon, age, netWorth, completedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [userId, riskTolerance, investmentExperience, annualIncome || null, investmentGoal, timeHorizon, age || null, netWorth || null]
      );
    }

    req.flash('success', 'Risk profile updated successfully.');
    res.redirect('/profile/risk');

  } catch (err) {
    console.error(err);
    req.flash('error', 'Error updating risk profile.');
    res.redirect('/profile/risk');
  }
};

// GET /account - Show user account details
exports.showAccount = async (req, res) => {
  const userId = req.session.user.userId;

  try {
    // Get account data
    const [accounts] = await db.promise().query(
      'SELECT * FROM accounts WHERE userId = ?',
      [userId]
    );

    if (accounts.length === 0) {
      req.flash('error', 'No account found.');
      return res.redirect('/profile');
    }

    const account = accounts[0];

    res.render('account', {
      title: 'My Account',
      account: account
    });

  } catch (err) {
    console.error(err);
    req.flash('error', 'Error loading account.');
    res.redirect('/');
  }
};