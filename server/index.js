import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.use(cors());
// Allow larger payloads for multiple attachments
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`${name} is required in environment`);
  }
  return v;
}

// Create transport once
let transporter;
function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) {
    throw new Error('SMTP configuration missing. Ensure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS are set');
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
  return transporter;
}

app.post('/api/send-bulk', async (req, res) => {
  try {
    const { from, subject, html, recipients } = req.body;
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'recipients array required' });
    }
    const tx = getTransporter();
    const results = [];
    for (const r of recipients) {
      const { email, name, filename, pdfBase64 } = r;
      if (!email || !pdfBase64) {
        results.push({ email, ok: false, error: 'missing email or pdf' });
        continue;
      }
      try {
        // Accept both raw base64 or data URLs
        const content = typeof pdfBase64 === 'string' && pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
        await tx.sendMail({
          from: from || requireEnv('SMTP_FROM'),
          to: email,
          subject: subject || 'Your Certificate',
          html: html || `<p>Dear ${name || ''},</p><p>Please find your certificate attached.</p>`,
          attachments: [
            {
              filename: filename || 'certificate.pdf',
              content,
              encoding: 'base64',
              contentType: 'application/pdf',
            },
          ],
        });
        results.push({ email, ok: true });
      } catch (e) {
        console.error('Email send failed for', email, e);
        results.push({ email, ok: false, error: e.message });
      }
    }
    res.json({ results });
  } catch (e) {
    console.error('Bulk send failed:', e);
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Email server listening on http://localhost:${port}`);
});


