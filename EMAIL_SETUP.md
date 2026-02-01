# Email Configuration Guide

## How to Set Up Gmail for Password Reset Emails

### Step 1: Enable 2-Factor Authentication on Gmail
1. Go to https://myaccount.google.com/security
2. Click "2-Step Verification" and enable it
3. Complete the verification process

### Step 2: Create an App Password
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer" (or your device)
3. Google will generate a 16-character password
4. Copy this password

### Step 3: Update .env File
In your `.env` file, replace the placeholders:

```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-character-app-password
APP_URL=http://localhost:3000
```

**Example:**
```
EMAIL_USER=yuzhi3112@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop
APP_URL=http://localhost:3000
```

### Step 4: Restart the Server
```bash
npm start
```

### Step 5: Test Password Reset
1. Go to `/login`
2. Click "Forgot password?"
3. Enter your email
4. Check your Gmail inbox for the reset link
5. Click the link to reset your password

---

## Important Notes:

⚠️ **Never commit your .env file to Git** - it contains sensitive credentials

✅ **Use App Passwords, not your regular Gmail password**

✅ **The reset link is valid for 1 hour only**

✅ **Each reset token can only be used once**

---

## Troubleshooting:

If emails aren't sending:
1. Check that EMAIL_USER and EMAIL_PASSWORD are correct in .env
2. Make sure 2-Factor Authentication is enabled on Gmail
3. Verify the app password was created correctly
4. Check the server logs for error messages
5. Try turning off firewall/VPN temporarily (if blocking email)

For production, consider using:
- SendGrid (https://sendgrid.com)
- Mailgun (https://mailgun.com)
- AWS SES (https://aws.amazon.com/ses)
