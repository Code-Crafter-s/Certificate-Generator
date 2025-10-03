import { useState, useEffect } from 'react';
import { Users, Download, Calendar, Loader2, Search, Upload, FileSpreadsheet, Image as ImageIcon, FileCheck, Wand2, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import { generateCertificate, downloadPDF } from '../utils/certificateGenerator';
import { bytesToBase64 } from '../utils/bytes';

export default function ParticipantsList() {
  const [participants, setParticipants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingId, setGeneratingId] = useState(null);
  const [excelRows, setExcelRows] = useState([]);
  const [logoBytes, setLogoBytes] = useState(null);
  const [signatureBytes, setSignatureBytes] = useState(null);
  const [secondLogoBytes, setSecondLogoBytes] = useState(null);
  const [signatureLabel, setSignatureLabel] = useState('Authorized Signatory');
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all|pending|delivered|bounced
  const [emailSubject, setEmailSubject] = useState('Your Certificate');
  const [emailMessage, setEmailMessage] = useState('Dear Participant,\n\nPlease find your certificate attached.\n\nBest regards,');
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0); // 0..100

  useEffect(() => {
    loadParticipants();
  }, []);

  const loadParticipants = () => {
    const stored = JSON.parse(localStorage.getItem('participants') || '[]');
    setParticipants(stored.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  };

  const persistParticipants = (list) => {
    localStorage.setItem('participants', JSON.stringify(list));
  };

  const readSettings = () => JSON.parse(localStorage.getItem('cert_settings') || '{}');

  const ensureStatus = (p) => ({
    deliveredStatus: 'pending', // pending|delivered|bounced
    ...p,
  });

  const handleDownloadCertificate = async (participant) => {
    setGeneratingId(participant.id);
    try {
      const settings = readSettings();
      const qrBytes = await maybeGenerateQrBytes(participant, settings);
      const pdfBytes = await generateCertificate(ensureStatus(participant), {
        logoBytes,
        secondLogoBytes,
        signatureBytes,
        signatureLabel,
        authorizedName: settings.authorizedName,
        eventName: settings.eventName,
        eventDetails: settings.eventDetails,
        organizerName: settings.organizerName,
        organizerWebsite: settings.organizerWebsite,
        certifyText: settings.certifyText,
        fatherPrefix: settings.fatherPrefix,
        completionText: settings.completionText ? `${settings.completionText} ${settings.eventName || ''}`.trim() : undefined,
        completionSubText: settings.completionSubText,
        qrBytes,
      });
      downloadPDF(pdfBytes, `certificate_${participant.regNo}.pdf`);

      const updated = participants.map(p =>
        p.id === participant.id ? { ...p, certificateGenerated: true, deliveredStatus: 'delivered' } : p
      );
      setParticipants(updated);
      persistParticipants(updated);
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert('Failed to generate certificate. Please try again.');
    } finally {
      setGeneratingId(null);
    }
  };

  const maybeGenerateQrBytes = async (participant, settings) => {
    if (!settings.qrEnabled || !settings.qrBaseUrl) return null;
    try {
      const url = new URL(settings.qrBaseUrl);
      url.searchParams.set('name', participant.name);
      url.searchParams.set('regNo', participant.regNo);
      const dataUrl = await QRCode.toDataURL(url.toString(), { margin: 0, scale: 4 });
      const res = await fetch(dataUrl);
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      console.warn('QR generation failed', e);
      return null;
    }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const normalized = rows.map((r, idx) => normalizeParticipantRow(r, idx)).filter(r => r.name && r.fatherName && r.regNo);
      setExcelRows(normalized);
    } catch (err) {
      console.error('Failed to parse Excel:', err);
      alert('Failed to parse file. Use the template or ensure columns: name, fatherName, regNo');
    } finally {
      e.target.value = '';
    }
  };

  const addExcelRowsToParticipants = () => {
    if (excelRows.length === 0) return;
    const existing = JSON.parse(localStorage.getItem('participants') || '[]');
    const regSet = new Set(existing.map(p => String(p.regNo)));
    const merged = [...existing];
    let addedCount = 0;
    for (const r of excelRows) {
      const reg = String(r.regNo);
      if (!regSet.has(reg)) {
        merged.push(r);
        regSet.add(reg);
        addedCount++;
      }
    }
    persistParticipants(merged);
    setParticipants(merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    // UX feedback
    if (addedCount > 0) {
      alert(`Added ${addedCount} row(s) to the list.`);
    } else {
      alert('No new rows added (all were duplicates or invalid).');
    }
    // Clear parsed rows after adding
    setExcelRows([]);
  };

  const sendBulkEmails = async () => {
    const serverUrl = (import.meta.env && import.meta.env.VITE_EMAIL_SERVER_URL) || 'http://localhost:3001';
    const settings = readSettings();
    const recipients = [];
    setIsSending(true);
    setSendProgress(0);
    const totalToProcess = filteredParticipants.filter(p => !!p.email).length || 1;
    let processed = 0;
    for (const p of filteredParticipants) {
      if (!p.email) continue;
      const qrBytes = await maybeGenerateQrBytes(p, settings);
      const pdfBytes = await generateCertificate(p, {
        logoBytes,
        secondLogoBytes,
        signatureBytes,
        signatureLabel,
        authorizedName: settings.authorizedName,
        eventName: settings.eventName,
        eventDetails: settings.eventDetails,
        organizerName: settings.organizerName,
        organizerWebsite: settings.organizerWebsite,
        certifyText: settings.certifyText,
        fatherPrefix: settings.fatherPrefix,
        completionText: settings.completionText ? `${settings.completionText} ${settings.eventName || ''}`.trim() : undefined,
        completionSubText: settings.completionSubText,
        qrBytes,
      });
      const base64 = bytesToBase64(new Uint8Array(pdfBytes));
      recipients.push({
        email: p.email,
        name: p.name,
        filename: `certificate_${p.regNo}.pdf`,
        pdfBase64: base64,
      });
      processed += 1;
      setSendProgress(Math.min(99, Math.round((processed / totalToProcess) * 80))); // up to 80% while preparing
    }
    if (recipients.length === 0) {
      alert('No emails found in the current list. Ensure participants include an email field.');
      setIsSending(false);
      setSendProgress(0);
      return;
    }
    try {
      // quick health check for better error ux
      await fetch(`${serverUrl}/api/health`).then(r => r.ok);
    } catch (e) {
      alert('Email server is not reachable. Start it with "npm run server" and set VITE_EMAIL_SERVER_URL.');
      setIsSending(false);
      setSendProgress(0);
      return;
    }
    try {
      setSendProgress(prev => Math.max(prev, 85));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s client timeout
      const resp = await fetch(`${serverUrl}/api/send-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: emailSubject || undefined,
          html: emailMessage ? `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.5;white-space:pre-line">${emailMessage}</div>` : undefined,
          recipients,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const json = await resp.json();
      if (!resp.ok) {
        alert(`Bulk email failed: ${json.error || 'Unknown error'}`);
        setIsSending(false);
        setSendProgress(0);
        return;
      }
      const ok = json.results.filter(r => r.ok).length;
      const fail = json.results.length - ok;
      setSendProgress(100);
      alert(`Emails sent successfully. Success: ${ok}, Failed: ${fail}`);
    } catch (e) {
      alert(e?.name === 'AbortError' ? 'Email request timed out. Try again.' : 'Failed to reach email server. Check your network, CORS, and server logs.');
      setIsSending(false);
      setSendProgress(0);
      return;
    } finally {
      // brief delay so 100% is visible
      setTimeout(() => {
        setIsSending(false);
        setSendProgress(0);
      }, 600);
    }
  };

  const handleImageUpload = async (e, setter) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setter(bytes);
    } catch (err) {
      console.error('Failed to read image:', err);
      alert('Failed to read image file');
    } finally {
      e.target.value = '';
    }
  };

  const bulkGenerateFromExcel = async () => {
    if (excelRows.length === 0) return;
    setBulkGenerating(true);
    try {
      const settings = readSettings();
      for (const row of excelRows) {
        const qrBytes = await maybeGenerateQrBytes(row, settings);
        const pdfBytes = await generateCertificate(row, {
          logoBytes,
          secondLogoBytes,
          signatureBytes,
          signatureLabel,
          authorizedName: settings.authorizedName,
          eventName: settings.eventName,
          eventDetails: settings.eventDetails,
          organizerName: settings.organizerName,
          organizerWebsite: settings.organizerWebsite,
          certifyText: settings.certifyText,
          fatherPrefix: settings.fatherPrefix,
          completionText: settings.completionText ? `${settings.completionText} ${settings.eventName || ''}`.trim() : undefined,
          completionSubText: settings.completionSubText,
          qrBytes,
        });
        downloadPDF(pdfBytes, `certificate_${row.regNo}.pdf`);
      }
    } catch (err) {
      console.error('Bulk generation failed:', err);
      alert('Bulk generation failed. See console for details.');
    } finally {
      setBulkGenerating(false);
    }
  };

  const cleanupName = (text) => {
    const trimmed = (text || '').trim().replace(/\s+/g, ' ');
    return trimmed
      .toLowerCase()
      .split(' ')
      .map(w => w ? w[0].toUpperCase() + w.slice(1) : '')
      .join(' ');
  };

  const runNameCleanup = () => {
    const updated = participants.map(p => ({
      ...p,
      name: cleanupName(p.name),
      fatherName: cleanupName(p.fatherName),
    }));
    setParticipants(updated);
    persistParticipants(updated);
  };

  const updateStatus = (id, status) => {
    const updated = participants.map(p => p.id === id ? { ...p, deliveredStatus: status } : p);
    setParticipants(updated);
    persistParticipants(updated);
  };

  const filteredParticipants = participants
    .filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.regNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.fatherName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(p => statusFilter === 'all' ? true : (p.deliveredStatus || 'pending') === statusFilter);

  return (
    <div className="w-full max-w-6xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">All Participants</h2>
            <p className="text-slate-600 text-sm">Total: {participants.length}</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={runNameCleanup} className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg">
            <Wand2 className="w-4 h-4" /> Clean Names
          </button>
          <button onClick={sendBulkEmails} disabled={isSending} className={`inline-flex items-center gap-2 px-3 py-2 text-white text-sm font-medium rounded-lg ${isSending ? 'bg-emerald-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {isSending ? (<><Loader2 className="w-4 h-4 animate-spin" /> Sending... {sendProgress}%</>) : (<>Send Emails</>)}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="col-span-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Import from Excel</h3>
          <p className="text-sm text-slate-600 mb-3">Columns: <span className="font-mono">name</span>, <span className="font-mono">fatherName</span>, <span className="font-mono">regNo</span>, <span className="font-mono">email</span></p>
          <div className="flex gap-2 mb-3">
            <button onClick={downloadTemplate} className="px-3 py-2 rounded-md text-sm font-medium bg-slate-200 text-slate-800 hover:bg-slate-300">Download Template</button>
          </div>
          <label className="flex items-center justify-center gap-2 w-full cursor-pointer bg-white border border-dashed border-slate-300 hover:border-slate-400 rounded-lg py-6 text-slate-700">
            <Upload className="w-4 h-4" /> Choose .xlsx/.xls/.csv
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelUpload} />
          </label>
          {excelRows.length > 0 && (
            <p className="mt-3 text-sm text-green-700 flex items-center gap-2"><FileCheck className="w-4 h-4" /> {excelRows.length} rows parsed</p>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={addExcelRowsToParticipants} disabled={excelRows.length === 0} className={`px-3 py-2 rounded-md text-sm font-medium ${excelRows.length === 0 ? 'bg-slate-200 text-slate-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Add to list</button>
            <button onClick={bulkGenerateFromExcel} disabled={excelRows.length === 0 || bulkGenerating} className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${excelRows.length === 0 || bulkGenerating ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
              {bulkGenerating ? (<><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>) : (<>Generate PDFs</>)}
            </button>
          </div>
        </div>

        <div className="col-span-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Logos (optional)</h3>
          <div className="grid grid-cols-1 gap-3">
            <label className="flex items-center justify-center gap-2 w-full cursor-pointer bg-white border border-dashed border-slate-300 hover:border-slate-400 rounded-lg py-6 text-slate-700">
              <Upload className="w-4 h-4" /> Left Logo (PNG/JPEG)
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleImageUpload(e, setLogoBytes)} />
            </label>
            {logoBytes && <p className="text-xs text-green-700">Left logo attached</p>}
            <label className="flex items-center justify-center gap-2 w-full cursor-pointer bg-white border border-dashed border-slate-300 hover:border-slate-400 rounded-lg py-6 text-slate-700">
              <Upload className="w-4 h-4" /> Right Logo (PNG/JPEG)
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleImageUpload(e, setSecondLogoBytes)} />
            </label>
            {secondLogoBytes && <p className="text-xs text-green-700">Right logo attached</p>}
          </div>
        </div>

        <div className="col-span-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Signature (optional)</h3>
          <label className="flex items-center justify-center gap-2 w-full cursor-pointer bg-white border border-dashed border-slate-300 hover:border-slate-400 rounded-lg py-6 text-slate-700">
            <Upload className="w-4 h-4" /> Choose PNG/JPEG
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleImageUpload(e, setSignatureBytes)} />
          </label>
          {signatureBytes && <p className="mt-3 text-sm text-green-700">Signature attached</p>}
          <input value={signatureLabel} onChange={(e) => setSignatureLabel(e.target.value)} className="mt-3 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800" placeholder="Signature label (e.g., Authorized Signatory)" />
        </div>
      </div>

      {/* Email customization card */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-3">Email Message</h3>
          <input
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 mb-3"
            placeholder="Email subject"
          />
          <textarea
            value={emailMessage}
            onChange={(e) => setEmailMessage(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 h-28"
            placeholder="Email message (plain text). Use new lines for paragraphs."
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, registration number, or father's name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-500" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-slate-800">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="bounced">Bounced</option>
          </select>
          <div className="hidden md:flex items-center gap-3 ml-auto">
            {isSending && (
              <>
                <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600" style={{ width: `${sendProgress}%` }} />
                </div>
                <span className="text-sm text-slate-600 min-w-[3ch]">{sendProgress}%</span>
              </>
            )}
          </div>
        </div>
      </div>

      {filteredParticipants.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">
            {searchTerm ? 'No participants found matching your search' : 'No participants registered yet'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Reg. No.</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Father's Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Email</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.map((participant) => (
                <tr key={participant.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="py-4 px-4">
                    <span className="font-mono text-sm font-medium text-blue-600">{participant.regNo}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-medium text-slate-800">{participant.name}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-slate-600">{participant.fatherName}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-slate-600">{participant.email || 'N/A'}</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2 text-slate-600 text-sm">
                      <Calendar className="w-4 h-4" />
                      {new Date(participant.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <select value={participant.deliveredStatus || 'pending'} onChange={(e) => updateStatus(participant.id, e.target.value)} className="border border-slate-300 rounded-md px-2 py-1 text-sm">
                      <option value="pending">Pending</option>
                      <option value="delivered">Delivered</option>
                      <option value="bounced">Bounced</option>
                    </select>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() => handleDownloadCertificate(participant)}
                      disabled={generatingId === participant.id}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition duration-200 shadow-sm hover:shadow"
                    >
                      {generatingId === participant.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Download
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Helpers
function normalizeParticipantRow(r, idx) {
  const sanitize = (s) => String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // remove spaces, dashes, underscores, etc.

  const getByHeaders = (accepted) => {
    const acceptedSet = new Set(accepted.map(sanitize));
    for (const key of Object.keys(r)) {
      const norm = sanitize(key);
      if (acceptedSet.has(norm)) {
        const val = r[key];
        if (val !== undefined && String(val).trim() !== '') return String(val).trim();
      }
    }
    return '';
  };

  const name = getByHeaders(['name']);
  const fatherName = getByHeaders([
    'fatherName', "father's name", 'fathers name', 'father', 'guardian',
  ]);
  const regNo = getByHeaders([
    'regNo', 'registration', 'registration no', 'registration number', 'reg no', 'reg_number', 'reg-number', 'regid', 'id',
  ]);
  const email = getByHeaders([
    'email', 'e-mail', 'email id', 'emailid', 'email address', 'emailaddress', 'mail', 'mail id', 'mailid', 'contact email'
  ]);

  return {
    id: `xlsx-${Date.now()}-${idx}`,
    name,
    fatherName,
    regNo,
    email,
    createdAt: new Date().toISOString(),
    certificateGenerated: false,
    deliveredStatus: 'pending',
  };
}

async function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function fileToBytes(file) {
  const buf = await fileToArrayBuffer(file);
  return new Uint8Array(buf);
}

function downloadTemplate() {
  const rows = [
    { name: 'John Doe', fatherName: 'Richard Roe', regNo: 'REG001', email: 'john@example.com' },
    { name: 'Jane Smith', fatherName: 'Alan Smith', regNo: 'REG002', email: 'jane@example.com' },
  ];
  const ws = XLSX.utils.json_to_sheet(rows, { header: ['name', 'fatherName', 'regNo', 'email'] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Participants');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'participants_template.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
