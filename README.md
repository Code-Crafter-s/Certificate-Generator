Certificate Generator – Setup Guide

Prerequisites
- Node.js 18+
- An SMTP account (e.g., Gmail App Password, SendGrid SMTP, Mailgun SMTP, or any SMTP provider)

1) Install dependencies
```bash
npm install
```

2) Create environment files
- Copy `.env.example` to `.env` and fill in your values.

Backend/server variables (in `.env`)
- SMTP_HOST: SMTP server host (e.g., smtp.gmail.com)
- SMTP_PORT: SMTP server port (465 for SSL, 587 for TLS)
- SMTP_USER: SMTP username/login
- SMTP_PASS: SMTP password or app password
- SMTP_FROM: The From address shown to recipients (e.g., "Certificates <no-reply@yourdomain.com>")
- PORT: Optional. Port for the email server (default: 3001)

Frontend variable (in `.env`)
- VITE_EMAIL_SERVER_URL: Base URL of the email server (e.g., http://localhost:3001)

3) Start the servers
- Start the email server:
```bash
npm run server
```
You should see: "Email server listening on http://localhost:3001".

- Start the app in a second terminal:
```bash
npm run dev
```

4) Configure in the UI
- Go to Settings and set the Authorized Person Name (permanent), event info, and optional QR.
- In Participants, click Download Template, add rows with name, fatherName, regNo, and email, then import the file.
- Click Send Emails to bulk-send certificates.

Troubleshooting
- If you see "connection refused" on Send Emails: make sure `npm run server` is running and `VITE_EMAIL_SERVER_URL` matches your server URL.
- If emails don’t arrive: check SMTP credentials, provider logs, and spam folder.
- If using Gmail, create an App Password (with 2FA enabled) and use it as SMTP_PASS.


