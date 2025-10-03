import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env from both project root and server directory for robustness
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(cors());
// Allow larger payloads for multiple attachments
app.use(express.json({ limit: '50mb' }));

// Basic root notice
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'certificate-email-server', endpoints: ['/api/health', '/api/send-bulk'] });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Alias endpoint (user requested): treat /api/wealth as a health check
app.get('/api/wealth', (req, res) => {
  res.json({ ok: true, alias: 'health' });
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
let isEthereal = false;
async function getTransporter() {
  if (transporter) return transporter;
  // Optional Ethereal test mode OR automatic fallback when SMTP missing
  const wantEthereal = String(process.env.ETHEREAL || '').toLowerCase() === 'true';
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const smtpConfigured = Boolean(host && port && user && pass);

  if (wantEthereal || !smtpConfigured) {
    const testAccount = await nodemailer.createTestAccount();
    isEthereal = true;
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('[mail] Using Ethereal test SMTP');
    return transporter;
  }
  if (!host || !port || !user || !pass) {
    throw new Error('SMTP configuration missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS or enable ETHEREAL=true');
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    // pooling improves throughput and avoids handshake per email
    pool: true,
    maxConnections: Number(process.env.SMTP_MAX_CONN || 3),
    maxMessages: Number(process.env.SMTP_MAX_MSG || 100),
  });
  return transporter;
}

app.post('/api/send-bulk', async (req, res) => {
  try {
    const { from, subject, html, recipients } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'recipients array required' });
    }
    const tx = await getTransporter();
    const results = [];
    const concurrency = Math.max(1, Number(process.env.SMTP_CONCURRENCY || 3));
    const timeoutMs = Math.max(5000, Number(process.env.SMTP_TIMEOUT_MS || 30000));

    const tasks = recipients.map((r) => async () => {
      const { email, name, filename, pdfBase64 } = r || {};
      if (!email || !pdfBase64) {
        return { email, ok: false, error: 'missing email or pdf' };
      }
      try {
        const content = typeof pdfBase64 === 'string' && pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
        const defaultFrom = process.env.SMTP_FROM || (isEthereal ? 'no-reply@example.test' : '');
        if (!from && !defaultFrom && !isEthereal) {
          throw new Error('Missing SMTP_FROM. Set SMTP_FROM in environment or provide "from" in request');
        }
        const info = await Promise.race([
          tx.sendMail({
            from: from || defaultFrom || undefined,
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
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('SMTP send timeout')), timeoutMs)),
        ]);
        const previewUrl = isEthereal ? nodemailer.getTestMessageUrl(info) : undefined;
        return { email, ok: true, messageId: info.messageId, previewUrl };
      } catch (e) {
        console.error('Email send failed for', email, e);
        return { email, ok: false, error: e.message };
      }
    });

    // simple concurrency runner
    const queue = tasks.slice();
    const running = [];
    while (queue.length > 0 || running.length > 0) {
      while (running.length < concurrency && queue.length > 0) {
        const t = queue.shift();
        const p = t().then((r) => {
          results.push(r);
        }).finally(() => {
          const idx = running.indexOf(p);
          if (idx >= 0) running.splice(idx, 1);
        });
        running.push(p);
      }
      // wait for any to finish
      if (running.length > 0) await Promise.race(running);
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


