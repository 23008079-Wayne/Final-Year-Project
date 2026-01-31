// controllers/authController.js
const bcrypt = require('bcrypt');
const db = require('../db');

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
    
    // Create Trading account
    await db
      .promise()
      .query(
        'INSERT INTO accounts (userId, accountNumber, accountType, accountStatus, balance, totalInvested, totalReturns, currency) VALUES (?,?,?,?,?,?,?,?)',
        [userId, accountNumber, 'Trading', 'active', 0, 0, 0, 'USD']
      );
    
    // Create Paper account with $100,000 starting balance
    await db
      .promise()
      .query(
        'INSERT INTO accounts (userId, accountNumber, accountType, accountStatus, balance, totalInvested, totalReturns, currency) VALUES (?,?,?,?,?,?,?,?)',
        [userId, paperAccountNumber, 'paper', 'active', 100000, 0, 0, 'USD']
      );

    console.log("DEBUG: Accounts created (Trading + Paper), redirecting to login");
    req.flash('success', 'Registration successful. Please login.');
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
      req.flash('error', 'Invalid credentials.');
      return res.redirect('/login');
    }

    console.log("DEBUG: Password matched, creating session...");
    req.session.user = {
      userId: user.userId,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
      roleName: user.roleName
    };

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
          [user.userId, accountNumber, 'Trading', 'active', 0, 0, 0, 'USD']
        );
        
        // Create Paper account with $100,000 starting balance
        await db.promise().query(
          'INSERT INTO accounts (userId, accountNumber, accountType, accountStatus, balance, totalInvested, totalReturns, currency) VALUES (?,?,?,?,?,?,?,?)',
          [user.userId, paperAccountNumber, 'paper', 'active', 100000, 0, 0, 'USD']
        );
        
        console.log("DEBUG: Both Trading and Paper accounts created successfully");
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
            [user.userId, paperAccountNumber, 'paper', 'active', 100000, 0, 0, 'USD']
          );
          console.log("DEBUG: Paper account created successfully");
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
