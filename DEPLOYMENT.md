# Quick Deployment Guide

## 🚀 Vercel Deployment (Easiest)

### Step 1: Deploy Frontend
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Vercel will auto-detect it's a Vite project
4. Deploy!

### Step 2: Deploy Backend
1. In Vercel dashboard, go to your project
2. Go to Settings → Environment Variables
3. Add these variables:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM="Your Name <your-email@gmail.com>"
   ETHEREAL=true
   ```
4. The `vercel.json` file will automatically deploy your backend as serverless functions

### Step 3: Connect Frontend to Backend
1. In Vercel dashboard, go to your frontend project
2. Go to Settings → Environment Variables
3. Add: `VITE_EMAIL_SERVER_URL` = `https://your-project.vercel.app`

## 🔧 Alternative: Separate Backend

### Railway (Recommended for backend)
1. Go to [railway.app](https://railway.app)
2. Connect GitHub repository
3. Set root directory to `server/`
4. Add environment variables
5. Deploy!

### Render (Alternative)
1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect GitHub repository
4. Set:
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
5. Add environment variables
6. Deploy!

## 📧 Gmail Setup (Most Common)
1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account → Security → App passwords
3. Generate a new app password
4. Use this password as `SMTP_PASS` (not your regular password)

## 🧪 Testing
- Set `ETHEREAL=true` to test without sending real emails
- Check server logs for preview URLs
- Once working, set `ETHEREAL=false` and add real SMTP credentials

## 🚨 Common Issues
- **"Cannot POST /api/health/api/send-bulk"**: Check `VITE_EMAIL_SERVER_URL` doesn't include `/api`
- **CORS errors**: Backend has CORS enabled by default
- **Emails not sending**: Check SMTP credentials and spam folder
