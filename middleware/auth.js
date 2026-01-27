// middleware/auth.js

// make sure user is logged in
exports.checkAuthenticated = (req, res, next) => {
  console.log("DEBUG: checkAuthenticated middleware - Path:", req.path);
  console.log("DEBUG: Session exists:", !!req.session);
  console.log("DEBUG: User exists:", !!req.session?.user);
  
  if (req.session && req.session.user) {
    console.log("DEBUG: Authentication passed for user:", req.session.user.userId);
    return next();
  }
  
  console.log("DEBUG: Authentication failed - redirecting to login");
  req.flash('error', 'Please login first.');
  return res.redirect('/login');
};

// make sure user is admin
exports.checkAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.roleId === 2) {
    return next();
  }
  req.flash('error', 'You are not authorised to view that page.');
  return res.redirect('/');
};
