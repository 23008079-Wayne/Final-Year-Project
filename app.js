/*
  STOCKAI TERMINAL – SERVER ENTRY POINT

  What this file does:
  - Express setup (EJS, static, session, flash)
  - Route wiring (GET/POST/DELETE) into controllers
  - Boot-time admin creation (optional)

  Notes:
  - This assumes Node 18+ (global fetch available). If not, install node-fetch.
  - Controllers are placed inside /controllers as you requested.
*/

"use strict";

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const bcrypt = require("bcrypt");
require("dotenv").config();

// Database
const db = require("./db");

// Existing controllers you already have
const authController = require("./controllers/authController");
const profileController = require("./controllers/profileController");
const adminController = require("./controllers/adminController");

// New controllers (add these files in /controllers)
const quoteController = require("./controllers/quoteController");
const apiController = require("./controllers/apiController");
const marketController = require("./controllers/marketController");
const portfolioController = require("./controllers/portfolioController");

// Middleware
const { checkAuthenticated, checkAdmin } = require("./middleware/auth");
const upload = require("./middleware/upload");

const app = express();

/* Basic setup */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* Session + Flash */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "superSecretStockPortal",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax"
      // secure: true // enable when HTTPS
    }
  })
);

app.use(flash());

/* Debug logging */
app.use((req, res, next) => {
  console.log(`HIT: ${req.method} ${req.url}`);
  next();
});

/* Globals for views */
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currentUser = req.session.user || null;
  next();
});

/* Check required env */
if (!process.env.FINNHUB_API_KEY) {
  console.error("FINNHUB_API_KEY is missing.");
  console.error("Add it to .env -> FINNHUB_API_KEY=your_key_here");
}

/*
  Boot-time helper: ensure one admin exists
  (Keeps your system usable even after fresh DB import)
*/
async function ensureAdminExists() {
  try {
    const [admins] = await db
      .promise()
      .query("SELECT userId FROM users WHERE roleId = 2 LIMIT 1");

    if (admins.length > 0) return;

    const hashed = await bcrypt.hash("Admin123!", 10);

    const [result] = await db
      .promise()
      .query(
        "INSERT INTO users (username, email, password, roleId) VALUES (?,?,?,2)",
        ["admin", "admin@stock.com", hashed]
      );

    await db
      .promise()
      .query(
        "INSERT INTO user_profiles (userId, fullName, bio) VALUES (?,?,?)",
        [result.insertId, "System Admin", "Auto-created admin"]
      );

    console.log("Default admin created: username=admin, password=Admin123!");
  } catch (err) {
    console.error("Error ensuring admin exists:", err?.message || err);
  }
}
ensureAdminExists();

/*
  Inject shared “quote tools” into controllers that need it.
  This avoids creating a “services” folder while still keeping controllers clean.
*/
apiController.init({ quoteController });
marketController.init({ quoteController });
portfolioController.init({ quoteController });

/* API routes */
app.get("/api/health", apiController.health);
app.get("/api/ticker", apiController.ticker);
app.get("/api/page-quotes", apiController.pageQuotes);
app.get("/api/quote/:symbol", apiController.singleQuote);

/* Pages */
app.get("/", marketController.home);
app.get("/market", marketController.market);
app.get("/chart/:symbol", marketController.chart);

/* Portfolio (synced to logged-in user) */
app.get("/portfolio", checkAuthenticated, portfolioController.page);
app.get("/api/portfolio-live", checkAuthenticated, portfolioController.live);
app.get("/api/portfolio-history", checkAuthenticated, portfolioController.history);

/* Auth routes (your existing controller) */
app.get("/register", authController.showRegister);
app.post("/register", authController.register);

app.get("/login", authController.showLogin);
app.post("/login", authController.login);

app.get("/logout", authController.logout);

/* Profile routes (your existing controller) */
app.get("/profile", checkAuthenticated, profileController.showProfile);
app.get("/profile/risk", checkAuthenticated, profileController.showRiskProfile);
app.get("/account", checkAuthenticated, profileController.showAccount);

app.post("/profile/wallet/remove", checkAuthenticated, profileController.removeWalletAddress);
app.post("/profile", checkAuthenticated, upload.single("avatar"), profileController.updateProfile);
app.post("/profile/risk", checkAuthenticated, profileController.updateRiskProfile);
app.post("/profile/password", checkAuthenticated, profileController.updatePassword);

/* Admin routes (your existing controller) */
app.get("/admin/dashboard", checkAdmin, adminController.showDashboard);

app.get("/admin/users", checkAdmin, adminController.listUsers);
app.get("/admin/users/edit/:id", checkAdmin, adminController.showEditUser);
app.post("/admin/users/edit/:id", checkAdmin, adminController.updateUser);
app.post("/admin/users/delete/:id", checkAdmin, adminController.deleteUser);

app.post("/admin/users/freeze/:id", checkAdmin, adminController.freezeUser);
app.post("/admin/users/unfreeze/:id", checkAdmin, adminController.unfreezeUser);

/* Server */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Connected to MySQL database: stock_portal");
});
