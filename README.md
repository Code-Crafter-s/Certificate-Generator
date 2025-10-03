# Certificate Generator

A React-based certificate generation and bulk email system with PDF generation and QR code support.

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- An SMTP account (e.g., Gmail App Password, SendGrid SMTP, Mailgun SMTP, or any SMTP provider)

### 1) Install dependencies
```bash
npm install
```

### 2) Create environment files
Copy `ENV_EXAMPLE.txt` to `.env` and fill in your values.

**Backend/server variables (in `.env`)**
- `SMTP_HOST`: SMTP server host (e.g., smtp.gmail.com)
- `SMTP_PORT`: SMTP server port (465 for SSL, 587 for TLS)
- `SMTP_USER`: SMTP username/login
- `SMTP_PASS`: SMTP password or app password
- `SMTP_FROM`: The From address shown to recipients (e.g., "Certificates <no-reply@yourdomain.com>")
- `PORT`: Optional. Port for the email server (default: 3001)

**Frontend variable (in `.env`)**
- `VITE_EMAIL_SERVER_URL`: Base URL of the email server (e.g., http://localhost:3001)

### 3) Start the servers
- Start the email server:
```bash
npm run server
```
You should see: "Email server listening on http://localhost:3001".

- Start the app in a second terminal:
```bash
npm run dev
```

### 4) Configure in the UI
- Go to Settings and set the Authorized Person Name (permanent), event info, and optional QR.
- In Participants, click Download Template, add rows with name, fatherName, regNo, and email, then import the file.
- Click Send Emails to bulk-send certificates.

---

## 🌐 Deployment Guide

### Option A: Vercel (Recommended)

#### Frontend Deployment (Vercel)

1. **Prepare for deployment**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel**
   - Install Vercel CLI: `npm i -g vercel` v1
   - Login: `vercel login`
   - Deploy: `vercel --prod`
   - Or connect your GitHub repo at [vercel.com](https://vercel.com)

3. **Set environment variables in Vercel dashboard**
   - Go to your project → Settings → Environment Variables
   - Add: `VITE_EMAIL_SERVER_URL` = `https://your-backend-url.vercel.app`

#### Backend Deployment (Vercel Functions)

1. **Vercel configuration is already set up**
   The `vercel.json` file is configured with the correct settings:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server/index.js",
         "use": "@vercel/node"
       },
       {
         "src": "package.json",
         "use": "@vercel/static-build",
         "config": {
           "distDir": "dist"
         }
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "/server/index.js"
       },
       {
         "src": "/(.*)",
         "dest": "/$1"
       }
     ],
     "env": {
       "NODE_ENV": "production"
     }
   }
   ```

2. **Deploy to Vercel**
   ```bash
   # Install Vercel CLI if not already installed
   npm i -g vercel
   
   # Login to Vercel
   vercel login
   
   # Deploy
   vercel --prod
   ```

3. **Set environment variables in Vercel dashboard**
   - Go to your project → Settings → Environment Variables
   - Add all required variables:
     - `MONGODB_URI` (your MongoDB connection string)
     - `SMTP_HOST` (e.g., smtp.gmail.com)
     - `SMTP_PORT` (465 for SSL, 587 for TLS)
     - `SMTP_USER` (your email or API key)
     - `SMTP_PASS` (your password or API secret)
     - `SMTP_FROM` (sender email address)
     - `CORS_ORIGIN` (your frontend URL, e.g., https://your-app.vercel.app)
     - `ETHEREAL` (set to `true` for testing, `false` for production)

### Option B: Separate Backend Hosting

#### Backend on Railway/Render/Heroku

1. **Prepare server for deployment**
   - Create `server/package.json` (already exists)
   - Add `"start": "node index.js"` script

2. **Deploy to Railway**
   - Connect GitHub repo
   - Set root directory to `server/`
   - Add environment variables in Railway dashboard

3. **Deploy to Render**
   - Create new Web Service
   - Connect GitHub repo
   - Set build command: `cd server && npm install`
   - Set start command: `cd server && npm start`
   - Add environment variables

4. **Update frontend environment**
   - Set `VITE_EMAIL_SERVER_URL` to your deployed backend URL

---

## 🔧 Production Configuration

### Environment Variables for Production

**Frontend (.env.production)**
```env
VITE_EMAIL_SERVER_URL=https://your-backend-domain.com
```

**Backend (.env)**
```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Your Organization <no-reply@yourdomain.com>"

# Optional: Enable test mode (no real emails)
# ETHEREAL=true

# Server Configuration
PORT=3001
```

### SMTP Provider Setup

#### Gmail Setup
1. Enable 2-Factor Authentication
2. Generate App Password: Google Account → Security → App passwords
3. Use App Password as `SMTP_PASS`

#### SendGrid Setup
1. Create SendGrid account
2. Generate API key
3. Use SMTP settings:
   - Host: `smtp.sendgrid.net`
   - Port: `587`
   - User: `apikey`
   - Pass: Your API key

#### Mailgun Setup
1. Create Mailgun account
2. Get SMTP credentials from dashboard
3. Use provided SMTP settings

---

## 🚨 Troubleshooting

### Common Issues

**"Failed to reach email server"**
- Check `VITE_EMAIL_SERVER_URL` matches your backend URL
- Ensure backend is deployed and accessible
- Check CORS settings (default allows all origins)

**"Cannot POST /api/health/api/send-bulk"**
- URL concatenation issue - ensure `VITE_EMAIL_SERVER_URL` doesn't include `/api`
- Should be: `https://your-backend.com` not `https://your-backend.com/api`

**Emails not sending**
- Verify SMTP credentials
- Check spam folder
- For Gmail: use App Password, not regular password
- Check SMTP provider logs

**Large file uploads fail**
- Server has 50MB JSON limit
- Consider reducing PDF size or batch size

### Testing Email Functionality

1. **Test with Ethereal (no real emails)**
   ```env
   ETHEREAL=true
   ```
   - Check server logs for preview URLs
   - No real emails sent

2. **Test with real SMTP**
   - Use a test email address
   - Check email delivery and spam folder

---

## 📁 Project Structure

```
project/
├── src/                    # Frontend React app
│   ├── components/         # React components
│   ├── utils/             # Utility functions
│   └── App.tsx            # Main app component
├── server/                # Backend Express server
│   ├── index.js           # Server entry point
│   └── package.json       # Server dependencies
├── vercel.json            # Vercel configuration
├── package.json           # Frontend dependencies
└── ENV_EXAMPLE.txt        # Environment variables template
```

---

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Start frontend dev server
npm run dev

# Start backend server
npm run server

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Type check
npm run typecheck
```

---

## 📝 Features

- ✅ Bulk certificate generation
- ✅ PDF export with custom logos and signatures
- ✅ QR code integration
- ✅ Excel/CSV import
- ✅ Bulk email sending
- ✅ Responsive design
- ✅ Real-time progress tracking
- ✅ Email customization
- ✅ Status tracking (pending/delivered/bounced)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).


