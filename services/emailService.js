// services/emailService.js
const nodemailer = require('nodemailer');

// Create transporter with Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: (process.env.EMAIL_PASSWORD || 'your-app-password').replace(/\s/g, '') // Remove all spaces
  }
});

// Send password reset email
exports.sendPasswordResetEmail = async (userEmail, resetToken, userName) => {
  try {
    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@marketmind.com',
      to: userEmail,
      subject: 'Password Reset Request - Marketmind',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${userName},</p>
        <p>You requested a password reset for your Marketmind account.</p>
        <p>Click the link below to reset your password (valid for 1 hour):</p>
        <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
        <p>Or copy this link: ${resetLink}</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>Marketmind Team</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('DEBUG: Password reset email sent:', info.response);
    return true;

  } catch (err) {
    console.error("DEBUG: Error sending email:", err);
    return false;
  }
};

// Send welcome email (optional)
exports.sendWelcomeEmail = async (userEmail, userName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@marketmind.com',
      to: userEmail,
      subject: 'Welcome to Marketmind',
      html: `
        <h2>Welcome to Marketmind!</h2>
        <p>Hi ${userName},</p>
        <p>Your account has been successfully created.</p>
        <p>Your account is pending admin approval. You'll be notified once it's approved.</p>
        <p>Best regards,<br>Marketmind Team</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('DEBUG: Welcome email sent:', info.response);
    return true;

  } catch (err) {
    console.error("DEBUG: Error sending welcome email:", err);
    return false;
  }
};
