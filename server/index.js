import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import Participant from './models/Participant.js';
import Settings from './models/Settings.js';
import EmailLog from './models/EmailLog.js';

// Load env from both project root and server directory for robustness
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://saksham:LZ3L8RAYNiaysHvt@ecertificate.6lb9tpr.mongodb.net/?retryWrites=true&w=majority&appName=Ecertificate';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// CORS: allow specific origin (env) or default vite dev
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const corsOptions = {
  origin: (origin, cb) => {
    // allow requests with no origin (mobile apps, curl)
    if (!origin) return cb(null, true);
    if (origin === allowedOrigin || allowedOrigin === '*') return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400,
};
app.use(cors(corsOptions));

// Ensure explicit preflight route for send-bulk
app.options('/api/send-bulk', cors(corsOptions));
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

// ===== PARTICIPANTS API =====

// Get all participants
app.get('/api/participants', async (req, res) => {
  try {
    const participants = await Participant.find().sort({ createdAt: -1 });
    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// Create a new participant
app.post('/api/participants', async (req, res) => {
  try {
    const participant = new Participant(req.body);
    await participant.save();
    res.status(201).json(participant);
  } catch (error) {
    console.error('Error creating participant:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Registration number already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create participant' });
    }
  }
});

// Update a participant
app.put('/api/participants/:id', async (req, res) => {
  try {
    const participant = await Participant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    res.json(participant);
  } catch (error) {
    console.error('Error updating participant:', error);
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

// Delete a participant
app.delete('/api/participants/:id', async (req, res) => {
  try {
    const participant = await Participant.findByIdAndDelete(req.params.id);
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    res.json({ message: 'Participant deleted successfully' });
  } catch (error) {
    console.error('Error deleting participant:', error);
    res.status(500).json({ error: 'Failed to delete participant' });
  }
});

// Bulk import participants
app.post('/api/participants/bulk', async (req, res) => {
  try {
    const { participants } = req.body;
    if (!Array.isArray(participants)) {
      return res.status(400).json({ error: 'Participants must be an array' });
    }

    const results = [];
    for (const participantData of participants) {
      try {
        const participant = new Participant(participantData);
        await participant.save();
        results.push({ success: true, participant });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message, 
          data: participantData 
        });
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Error bulk importing participants:', error);
    res.status(500).json({ error: 'Failed to bulk import participants' });
  }
});

// ===== SETTINGS API =====

// Get settings
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
app.put('/api/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
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
    const { from, subject, html, participantIds } = req.body || {};
    
    // Get participants from MongoDB if participantIds provided, otherwise use recipients array
    let participants = [];
    if (participantIds && Array.isArray(participantIds)) {
      participants = await Participant.find({ _id: { $in: participantIds } });
    } else {
      // Fallback to old recipients array format
      const { recipients } = req.body || {};
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: 'participantIds array or recipients array required' });
      }
      participants = recipients;
    }
    
    if (participants.length === 0) {
      return res.status(400).json({ error: 'No participants found' });
    }
    
    // Get settings for email content
    const settings = await Settings.findOne();
    const emailSubject = subject || settings?.emailSubject || 'Your Certificate';
    const emailHtml = html || (settings?.emailMessage ? 
      `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.5;white-space:pre-line">${settings.emailMessage}</div>` : 
      '<p>Dear Participant,</p><p>Please find your certificate attached.</p>');
    let tx = await getTransporter();
    // Proactively verify SMTP credentials to fail fast (e.g., Mailjet 535)
    try {
      await tx.verify();
    } catch (verr) {
      console.error('SMTP verify failed:', verr);
      const wantFallback = String(process.env.SMTP_FALLBACK_TO_ETHEREAL || '').toLowerCase() === 'true';
      if (wantFallback) {
        // switch to Ethereal automatically to allow testing to proceed
        transporter = undefined; // reset
        process.env.ETHEREAL = 'true';
        tx = await getTransporter();
      } else {
        return res.status(400).json({
          error: 'SMTP authentication failed. Check SMTP_USER/SMTP_PASS and verified FROM.',
          providerHint: 'For Mailjet use host in-v3.mailjet.com, port 587 (TLS) or 465 (SSL), username=API Key, password=Secret Key, and a verified sender/domain in SMTP_FROM.',
          code: verr && (verr.code || verr.responseCode) || 'EAUTH',
        });
      }
    }
    const results = [];
    const concurrency = Math.max(1, Number(process.env.SMTP_CONCURRENCY || 3));
    const timeoutMs = Math.max(5000, Number(process.env.SMTP_TIMEOUT_MS || 30000));

    const tasks = participants.map((participant) => async () => {
      const { email, name, regNo, _id } = participant;
      if (!email) {
        return { participantId: _id, email, ok: false, error: 'No email address' };
      }
      
      try {
        // Create email log entry
        const emailLog = new EmailLog({
          participantId: _id,
          email,
          subject: emailSubject,
          status: 'pending'
        });
        await emailLog.save();
        
        // Generate PDF certificate (this would need to be implemented)
        // For now, we'll use a placeholder - you'll need to integrate with your PDF generation
        const pdfBase64 = 'placeholder'; // This should be generated using your certificate generator
        
        const content = typeof pdfBase64 === 'string' && pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
        const defaultFrom = process.env.SMTP_FROM || (isEthereal ? 'no-reply@example.test' : '');
        if (!from && !defaultFrom && !isEthereal) {
          throw new Error('Missing SMTP_FROM. Set SMTP_FROM in environment or provide "from" in request');
        }
        
        const info = await Promise.race([
          tx.sendMail({
            from: from || defaultFrom || undefined,
            to: email,
            subject: emailSubject,
            html: emailHtml.replace(/\{name\}/g, name || 'Participant'),
            attachments: [
              {
                filename: `certificate_${regNo}.pdf`,
                content,
                encoding: 'base64',
                contentType: 'application/pdf',
              },
            ],
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('SMTP send timeout')), timeoutMs)),
        ]);
        
        // Update email log with success
        emailLog.status = 'sent';
        emailLog.messageId = info.messageId;
        emailLog.sentAt = new Date();
        await emailLog.save();
        
        // Update participant status
        await Participant.findByIdAndUpdate(_id, {
          certificateGenerated: true,
          deliveredStatus: 'delivered',
          emailSentAt: new Date(),
          emailMessageId: info.messageId
        });
        
        const previewUrl = isEthereal ? nodemailer.getTestMessageUrl(info) : undefined;
        return { participantId: _id, email, ok: true, messageId: info.messageId, previewUrl };
      } catch (e) {
        console.error('Email send failed for', email, e);
        
        // Update email log with failure
        try {
          await EmailLog.findOneAndUpdate(
            { participantId: _id, email },
            { 
              status: 'failed', 
              error: e.message,
              sentAt: new Date()
            }
          );
          
          // Update participant status
          await Participant.findByIdAndUpdate(_id, {
            deliveredStatus: 'bounced',
            emailError: e.message
          });
        } catch (logError) {
          console.error('Failed to update email log:', logError);
        }
        
        return { participantId: _id, email, ok: false, error: e.message };
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


