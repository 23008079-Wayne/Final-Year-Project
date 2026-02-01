// controllers/authController.js
const bcrypt = require('bcrypt');
const db = require('../db');
const emailService = require('../services/emailService');

// GET /register
exports.showRegister = (req, res) => {
  console.log("DEBUG: showRegister() CALLED");
  res.render('register', { title: 'Register' });
};

// POST /register
exports.register = async (req, res) => {
  console.log("DEBUG: POST /register hit");
  console.log("DEBUG: BODY =", req.body);

  const { username, email, password, confirmPassword, fullName, riskTolerance, investmentExperience, annualIncome, investmentGoal, timeHorizon, age, netWorth } = req.body;

  if (!username || !email || !password || !confirmPassword || !riskTolerance || !investmentExperience || !investmentGoal || !timeHorizon || !age) {
    console.log("DEBUG: Missing required fields");
    req.flash('error', 'Please fill in all required fields.');
    return res.redirect('/register');
  }

  // Validate age - must be at least 18
  const ageNum = parseInt(age);
  if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
    console.log("DEBUG: Invalid age - must be between 18 and 120");
    req.flash('error', 'You must be at least 18 years old to register.');
    return res.redirect('/register');
  }

  // Validate email format (must be gmail.com)
  const emailRegex = /^[^\s@]+@gmail\.com$/;
  if (!emailRegex.test(email.trim().toLowerCase())) {
    console.log("DEBUG: Invalid email format");
    req.flash('error', 'Please enter a valid Gmail address (ending with @gmail.com)');
    return res.redirect('/register');
  }

  // Validate full name (only letters and spaces)
  if (fullName && fullName.trim()) {
    const fullNameRegex = /^[A-Za-z\s]+$/;
    if (!fullNameRegex.test(fullName.trim())) {
      console.log("DEBUG: Invalid full name format");
      req.flash('error', 'Full name should only contain letters and spaces.');
      return res.redirect('/register');
    }
  }

  if (password !== confirmPassword) {
    console.log("DEBUG: Passwords do not match");
    req.flash('error', 'Passwords do not match.');
    return res.redirect('/register');
  }

  try {
    console.log("DEBUG: Checking existing user");
    const [existing] = await db
      .promise()
      .query(
        'SELECT * FROM users WHERE username = ? OR email = ?',
        [username, email]
      );

    if (existing.length > 0) {
      console.log("DEBUG: User or email already exists");
      req.flash('error', 'Username or email already taken.');
      return res.redirect('/register');
    }

    console.log("DEBUG: Hashing password...");
    const hashed = await bcrypt.hash(password, 10);

    console.log("DEBUG: Inserting new user...");
    const [result] = await db
      .promise()
      .query(
        'INSERT INTO users (username, email, password, roleId) VALUES (?,?,?,1)',
        [username, email, hashed]
      );

    const userId = result.insertId;

    console.log("DEBUG: Creating user profile...");
    await db
      .promise()
      .query(
        'INSERT INTO user_profiles (userId, fullName, bio) VALUES (?,?,?)',
        [userId, fullName || null, null]
      );

    console.log("DEBUG: Creating user risk profile...");
    await db
      .promise()
      .query(
        'INSERT INTO user_risk_profiles (userId, riskTolerance, investmentExperience, annualIncome, investmentGoal, timeHorizon, age, netWorth) VALUES (?,?,?,?,?,?,?,?)',
        [userId, riskTolerance, investmentExperience, annualIncome || null, investmentGoal, timeHorizon, age || null, netWorth || null]
      );

    console.log("DEBUG: Creating user accounts...");
    const accountNumber = `ACC-${userId}-${Date.now()}`;
    const paperAccountNumber = `PAPER-${userId}-${Date.now()}`;
    
    // Create Trading account (pending approval)
    await db
      .promise()
      .query(
        'INSERT INTO accounts (userId, accountNumber, accountType, accountStatus, balance, totalInvested, totalReturns, currency) VALUES (?,?,?,?,?,?,?,?)',
        [userId, accountNumber, 'Trading', 'pending', 0, 0, 0, 'USD']
      );
    
    // Create Paper account with $100,000 starting balance (pending approval)
    await db
      .promise()
      .query(
        'INSERT INTO accounts (userId, accountNumber, accountType, accountStatus, balance, totalInvested, totalReturns, currency) VALUES (?,?,?,?,?,?,?,?)',
        [userId, paperAccountNumber, 'paper', 'pending', 100000, 0, 0, 'USD']
      );

    console.log("DEBUG: Accounts created (Trading + Paper - pending approval), redirecting to login");
    req.flash('success', 'Registration successful. Your account is pending admin approval.');
    res.redirect('/login');

  } catch (err) {
    console.error("DEBUG: ERROR in register():", err);
    req.flash('error', 'Something went wrong during registration.');
    res.redirect('/register');
  }
};

// GET /login
exports.showLogin = (req, res) => {
  console.log("DEBUG: showLogin() CALLED");
  res.render('login', { title: 'Login' });
};

// POST /login
exports.login = async (req, res) => {
  console.log("DEBUG: POST /login hit");
  console.log("DEBUG: BODY =", req.body);

  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || !password) {
    console.log("DEBUG: Missing fields for login");
    req.flash('error', 'Please fill in all fields.');
    return res.redirect('/login');
  }

  try {
    console.log("DEBUG: Fetching user from DB...");
    const [rows] = await db
      .promise()
      .query(
        `SELECT u.*, r.roleName
         FROM users u
         LEFT JOIN roles r ON u.roleId = r.roleId
         WHERE u.username = ? OR u.email = ?`,
        [emailOrUsername, emailOrUsername]
      );

    if (rows.length === 0) {
      console.log("DEBUG: No user found");
      req.flash('error', 'Invalid credentials.');
      return res.redirect('/login');
    }

    const user = rows[0];
    console.log("DEBUG: User found:", user.username);

    console.log("DEBUG: Comparing passwords...");
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      console.log("DEBUG: Invalid password");
      
      // Track failed login attempt (optional - skip if columns don't exist)
      try {
        const [userRecord] = await db.promise().query(
          'SELECT loginAttempts, lockedUntil FROM users WHERE username = ? OR email = ?',
          [emailOrUsername, emailOrUsername]
        );
        
        if (userRecord.length > 0) {
          let attempts = (userRecord[0].loginAttempts || 0) + 1;
          let lockedUntil = null;
          
          // Lock account after 5 failed attempts for 30 minutes
          if (attempts >= 5) {
            lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
            console.log("DEBUG: Account locked due to too many failed attempts");
          }
          
          await db.promise().query(
            'UPDATE users SET loginAttempts = ?, lockedUntil = ? WHERE username = ? OR email = ?',
            [attempts, lockedUntil, emailOrUsername, emailOrUsername]
          );
        }
      } catch (err) {
        // Columns might not exist - that's ok, just continue
        console.log("DEBUG: Note - loginAttempts/lockedUntil columns not found (optional feature)");
      }
      
      req.flash('error', 'Invalid credentials.');
      return res.redirect('/login');
    }

    // Check if account is locked (optional - skip if columns don't exist)
    try {
      if (user.lockedUntil) {
        const now = new Date();
        if (now < new Date(user.lockedUntil)) {
          console.log("DEBUG: Account is locked");
          const remainingTime = Math.ceil((new Date(user.lockedUntil) - now) / 60000);
          req.flash('error', `Account locked due to too many failed login attempts. Try again in ${remainingTime} minutes.`);
          return res.redirect('/login');
        } else {
          // Unlock account
          await db.promise().query(
            'UPDATE users SET lockedUntil = NULL, loginAttempts = 0 WHERE userId = ?',
            [user.userId]
          );
        }
      }
    } catch (err) {
      // Columns might not exist - that's ok, just continue
      console.log("DEBUG: Note - lockedUntil check skipped (optional feature)");
    }

    console.log("DEBUG: Password matched, creating session...");
    
    // Reset login attempts on successful login (optional - skip if columns don't exist)
    try {
      await db.promise().query(
        'UPDATE users SET loginAttempts = 0, lockedUntil = NULL WHERE userId = ?',
        [user.userId]
      );
    } catch (err) {
      // Columns might not exist - that's ok, just continue
      console.log("DEBUG: Note - loginAttempts/lockedUntil columns not found (optional feature)");
    }
    
    req.session.user = {
      userId: user.userId,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
      roleName: user.roleName
    };
    
    // Handle "Remember Me"
    if (req.body.rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    // Check if user has an account, create one if not
    try {
      const [existingAccount] = await db.promise().query(
        'SELECT * FROM accounts WHERE userId = ?',
        [user.userId]
      );

      if (existingAccount.length === 0) {
        console.log("DEBUG: No accounts found, creating both Trading and Paper...");
        const accountNumber = `ACC-${user.userId}-${Date.now()}`;
        const paperAccountNumber = `PAPER-${user.userId}-${Date.now()}`;
        
        // Create Trading account
        await db.promise().query(
          'INSERT INTO accounts (userId, accountNumber, accountType, accountStatus, balance, totalInvested, totalReturns, currency) VALUES (?,?,?,?,?,?,?,?)',
          [user.userId, accountNumber, 'Trading', 'pending', 0, 0, 0, 'USD']
        );
        
        // Create Paper account with $100,000 starting balance
        await db.promise().query(
          'INSERT INTO accounts (userId, accountNumber, accountType, accountStatus, balance, totalInvested, totalReturns, currency) VALUES (?,?,?,?,?,?,?,?)',
          [user.userId, paperAccountNumber, 'paper', 'pending', 100000, 0, 0, 'USD']
        );
        
        console.log("DEBUG: Both Trading and Paper accounts created successfully (pending approval)");
      } else {
        // Check if paper account exists
        const [paperAccounts] = await db.promise().query(
          'SELECT * FROM accounts WHERE userId = ? AND accountType = "paper"',
          [user.userId]
        );
        
        if (paperAccounts.length === 0) {
          console.log("DEBUG: Paper account missing, creating one...");
          const paperAccountNumber = `PAPER-${user.userId}-${Date.now()}`;
          await db.promise().query(
            'INSERT INTO accounts (userId, accountNumber, accountType, accountStatus, balance, totalInvested, totalReturns, currency) VALUES (?,?,?,?,?,?,?,?)',
            [user.userId, paperAccountNumber, 'paper', 'pending', 100000, 0, 0, 'USD']
          );
          console.log("DEBUG: Paper account created successfully (pending approval)");
        }
      }
    } catch (err) {
      console.error("DEBUG: Error checking/creating account:", err);
    }

    req.flash('success', 'Logged in successfully.');

    if (user.roleId === 2) {
      console.log("DEBUG: Admin detected → redirecting to dashboard");
      return res.redirect('/admin/dashboard');
    }

    console.log("DEBUG: Normal user → redirecting to home");
    return res.redirect('/');

  } catch (err) {
    console.error("DEBUG: ERROR in login():", err);
    req.flash('error', 'Something went wrong during login.');
    res.redirect('/login');
  }
};

// GET /logout
exports.logout = (req, res) => {
  console.log("DEBUG: logout() CALLED");
  req.session.destroy((err) => {
    if (err) {
      console.error("DEBUG: Error destroying session:", err);
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
};

// GET /forgot-password
exports.showForgotPassword = (req, res) => {
  console.log("DEBUG: showForgotPassword() CALLED");
  res.render('forgot-password', { title: 'Forgot Password' });
};

// POST /forgot-password
exports.forgotPassword = async (req, res) => {
  console.log("DEBUG: POST /forgot-password hit");
  const { email } = req.body;

  if (!email) {
    req.flash('error', 'Please enter your email address.');
    return res.redirect('/forgot-password');
  }

  try {
    const [rows] = await db.promise().query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      // Don't reveal if email exists (security best practice)
      req.flash('success', 'If an account exists with that email, a password reset link has been sent.');
      return res.redirect('/login');
    }

    const user = rows[0];
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetTokenHash = require('crypto').createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token to database
    try {
      await db.promise().query(
        'INSERT INTO password_resets (userId, token, tokenExpiry) VALUES (?,?,?) ON DUPLICATE KEY UPDATE token=?, tokenExpiry=?',
        [user.userId, resetTokenHash, resetTokenExpiry, resetTokenHash, resetTokenExpiry]
      );
    } catch (err) {
      // Table might not exist, create it
      if (err.code === 'ER_NO_SUCH_TABLE') {
        console.log("DEBUG: Creating password_resets table...");
        await db.promise().query(`
          CREATE TABLE password_resets (
            resetId INT PRIMARY KEY AUTO_INCREMENT,
            userId INT NOT NULL,
            token VARCHAR(255) NOT NULL,
            tokenExpiry DATETIME NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
            UNIQUE KEY (userId)
          )
        `);
        
        await db.promise().query(
          'INSERT INTO password_resets (userId, token, tokenExpiry) VALUES (?,?,?)',
          [user.userId, resetTokenHash, resetTokenExpiry]
        );
      }
    }

    console.log("DEBUG: Password reset token generated for user:", user.username);
    console.log("DEBUG: Reset link: /reset-password/" + resetToken);

    // Send email with reset link
    console.log("DEBUG: Sending password reset email to:", user.email);
    const emailSent = await emailService.sendPasswordResetEmail(user.email, resetToken, user.username);
    
    if (emailSent) {
      req.flash('success', 'Password reset link has been sent to your email. Please check your inbox.');
    } else {
      req.flash('error', 'Email could not be sent. Please try again later.');
    }
    
    res.redirect('/login');

  } catch (err) {
    console.error("DEBUG: ERROR in forgotPassword():", err);
    req.flash('error', 'Something went wrong. Please try again later.');
    res.redirect('/forgot-password');
  }
};

// GET /reset-password/:token
exports.showResetPassword = async (req, res) => {
  console.log("DEBUG: showResetPassword() CALLED");
  console.log("DEBUG: req.params:", req.params);
  const { token } = req.params;
  console.log("DEBUG: Token extracted:", token);

  if (!token) {
    req.flash('error', 'Invalid reset link.');
    return res.redirect('/login');
  }

  try {
    const resetTokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
    
    const [rows] = await db.promise().query(
      'SELECT * FROM password_resets WHERE token = ? AND tokenExpiry > NOW()',
      [resetTokenHash]
    );

    if (rows.length === 0) {
      req.flash('error', 'Password reset link has expired or is invalid.');
      return res.redirect('/login');
    }

    res.render('reset-password', { 
      title: 'Reset Password',
      token: token,
      userId: rows[0].userId
    });

  } catch (err) {
    console.error("DEBUG: ERROR in showResetPassword():", err);
    req.flash('error', 'Something went wrong. Please try again.');
    res.redirect('/login');
  }
};

// POST /reset-password/:token
exports.resetPassword = async (req, res) => {
  console.log("DEBUG: POST /reset-password hit");
  const { token } = req.params; // Get token from URL parameter
  const { password, confirmPassword } = req.body;

  console.log("DEBUG: Token from params:", token);
  console.log("DEBUG: Password from body:", password ? "***" : "undefined");

  if (!token) {
    req.flash('error', 'Invalid reset link.');
    return res.redirect('/login');
  }

  if (!password || !confirmPassword) {
    req.flash('error', 'Please fill in all fields.');
    return res.redirect('/reset-password/' + token);
  }

  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect('/reset-password/' + token);
  }

  // Validate password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    req.flash('error', 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.');
    return res.redirect('/reset-password/' + token);
  }

  try {
    const resetTokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
    
    const [rows] = await db.promise().query(
      'SELECT * FROM password_resets WHERE token = ? AND tokenExpiry > NOW()',
      [resetTokenHash]
    );

    if (rows.length === 0) {
      req.flash('error', 'Password reset link has expired or is invalid.');
      return res.redirect('/login');
    }

    const userId = rows[0].userId;
    const hashedPassword = await require('bcrypt').hash(password, 10);

    // Update password
    await db.promise().query(
      'UPDATE users SET password = ? WHERE userId = ?',
      [hashedPassword, userId]
    );

    // Delete reset token
    await db.promise().query(
      'DELETE FROM password_resets WHERE userId = ?',
      [userId]
    );

    console.log("DEBUG: Password reset successfully for user:", userId);
    req.flash('success', 'Password reset successfully. You can now log in with your new password.');
    res.redirect('/login');

  } catch (err) {
    console.error("DEBUG: ERROR in resetPassword():", err);
    req.flash('error', 'Something went wrong. Please try again.');
    res.redirect('/reset-password/' + token);
  }
};
