import { useState, useEffect } from 'react';
import { Users, Download, Calendar, Loader2, Search, Upload, FileSpreadsheet, Image as ImageIcon, FileCheck, Wand2, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import { generateCertificate, downloadPDF } from '../utils/certificateGenerator';
import { bytesToBase64 } from '../utils/bytes';
import apiService from '../services/api';

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
    loadSettings();
  }, []);

  const loadParticipants = async () => {
    try {
      const data = await apiService.getParticipants();
      setParticipants(data);
    } catch (error) {
      console.error('Failed to load participants:', error);
      alert('Failed to load participants. Please refresh the page.');
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await apiService.getSettings();
      setEmailSubject(settings.emailSubject || 'Your Certificate');
      setEmailMessage(settings.emailMessage || 'Dear Participant,\n\nPlease find your certificate attached.\n\nBest regards,');
      
      // Load images from database
      if (settings.logoBase64) {
        const logoBytes = Uint8Array.from(atob(settings.logoBase64), c => c.charCodeAt(0));
        setLogoBytes(logoBytes);
      }
      if (settings.secondLogoBase64) {
        const secondLogoBytes = Uint8Array.from(atob(settings.secondLogoBase64), c => c.charCodeAt(0));
        setSecondLogoBytes(secondLogoBytes);
      }
      if (settings.signatureBase64) {
        const signatureBytes = Uint8Array.from(atob(settings.signatureBase64), c => c.charCodeAt(0));
        setSignatureBytes(signatureBytes);
      }
      if (settings.signatureLabel) {
        setSignatureLabel(settings.signatureLabel);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const persistParticipants = async (list) => {
    // No longer needed - data is persisted via API calls
  };

  const readSettings = async () => {
    try {
      return await apiService.getSettings();
    } catch (error) {
      console.error('Failed to read settings:', error);
      return {};
    }
  };

  const ensureStatus = (p) => ({
    deliveredStatus: 'pending', // pending|delivered|bounced
    ...p,
  });

  const handleDownloadCertificate = async (participant) => {
    setGeneratingId(participant._id);
    try {
      const settings = await readSettings();
      const qrBytes = await maybeGenerateQrBytes(participant, settings);
      const pdfBytes = await generateCertificate(ensureStatus(participant), {
        logoBytes: settings.logoBase64 ? Uint8Array.from(atob(settings.logoBase64), c => c.charCodeAt(0)) : null,
        secondLogoBytes: settings.secondLogoBase64 ? Uint8Array.from(atob(settings.secondLogoBase64), c => c.charCodeAt(0)) : null,
        signatureBytes: settings.signatureBase64 ? Uint8Array.from(atob(settings.signatureBase64), c => c.charCodeAt(0)) : null,
        signatureLabel: settings.signatureLabel || 'Authorized Signatory',
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

      // Update participant status in database
      await apiService.updateParticipant(participant._id, {
        certificateGenerated: true,
        deliveredStatus: 'delivered'
      });

      // Refresh participants list
      await loadParticipants();
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

  const addExcelRowsToParticipants = async () => {
    if (excelRows.length === 0) return;
    
    try {
      const results = await apiService.bulkImportParticipants(excelRows);
      const successCount = results.results.filter(r => r.success).length;
      const failCount = results.results.length - successCount;
      
      if (successCount > 0) {
        alert(`Added ${successCount} row(s) to the list.${failCount > 0 ? ` ${failCount} failed due to duplicates or validation errors.` : ''}`);
        await loadParticipants(); // Refresh the list
      } else {
        alert('No new rows added (all were duplicates or invalid).');
      }
      
      // Clear parsed rows after adding
      setExcelRows([]);
    } catch (error) {
      console.error('Failed to import participants:', error);
      alert('Failed to import participants. Please try again.');
    }
  };

  const sendBulkEmails = async () => {
    setIsSending(true);
    setSendProgress(0);
    
    const participantsWithEmail = filteredParticipants.filter(p => !!p.email);
    if (participantsWithEmail.length === 0) {
      alert('No emails found in the current list. Ensure participants include an email field.');
      setIsSending(false);
      setSendProgress(0);
      return;
    }

    try {
      // Health check
      await apiService.healthCheck();
    } catch (e) {
      alert('Email server is not reachable. Start it with "npm run server" and set VITE_EMAIL_SERVER_URL.');
      setIsSending(false);
      setSendProgress(0);
      return;
    }

    try {
      setSendProgress(50);
      
      // Get participant IDs for bulk email
      const participantIds = participantsWithEmail.map(p => p._id);
      
      // Send bulk emails using the new API
      const results = await apiService.sendBulkEmails(participantIds, {
        subject: emailSubject,
        html: emailMessage ? `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.5;white-space:pre-line">${emailMessage}</div>` : undefined,
      });
      
      setSendProgress(100);
      
      const ok = results.results.filter(r => r.ok).length;
      const fail = results.results.length - ok;
      
      alert(`Emails sent successfully. Success: ${ok}, Failed: ${fail}`);
      
      // Refresh participants list to show updated status
      await loadParticipants();
      
    } catch (e) {
      console.error('Bulk email failed:', e);
      alert(e?.name === 'AbortError' ? 'Email request timed out. Try again.' : `Failed to send emails: ${e.message}`);
    } finally {
      // Brief delay so 100% is visible
      setTimeout(() => {
        setIsSending(false);
        setSendProgress(0);
      }, 600);
    }
  };

  const handleImageUpload = async (e, setter, imageType) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const base64 = bytesToBase64(bytes);
      setter(bytes);
      
      // Save to settings in database
      const currentSettings = await apiService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        [imageType]: base64
      };
      await apiService.updateSettings(updatedSettings);
      console.log(`${imageType} saved to database`);
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

  const updateStatus = async (id, status) => {
    try {
      await apiService.updateParticipant(id, { deliveredStatus: status });
      await loadParticipants(); // Refresh the list
    } catch (error) {
      console.error('Failed to update participant status:', error);
      alert('Failed to update participant status. Please try again.');
    }
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
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleImageUpload(e, setLogoBytes, 'logoBase64')} />
            </label>
            {logoBytes && <p className="text-xs text-green-700">Left logo attached</p>}
            <label className="flex items-center justify-center gap-2 w-full cursor-pointer bg-white border border-dashed border-slate-300 hover:border-slate-400 rounded-lg py-6 text-slate-700">
              <Upload className="w-4 h-4" /> Right Logo (PNG/JPEG)
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleImageUpload(e, setSecondLogoBytes, 'secondLogoBase64')} />
            </label>
            {secondLogoBytes && <p className="text-xs text-green-700">Right logo attached</p>}
          </div>
        </div>

        <div className="col-span-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Signature (optional)</h3>
          <label className="flex items-center justify-center gap-2 w-full cursor-pointer bg-white border border-dashed border-slate-300 hover:border-slate-400 rounded-lg py-6 text-slate-700">
            <Upload className="w-4 h-4" /> Choose PNG/JPEG
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleImageUpload(e, setSignatureBytes, 'signatureBase64')} />
          </label>
          {signatureBytes && <p className="mt-3 text-sm text-green-700">Signature attached</p>}
          <input value={signatureLabel} onChange={async (e) => {
            setSignatureLabel(e.target.value);
            // Save signature label to database
            try {
              const currentSettings = await apiService.getSettings();
              const updatedSettings = {
                ...currentSettings,
                signatureLabel: e.target.value
              };
              await apiService.updateSettings(updatedSettings);
            } catch (err) {
              console.error('Failed to save signature label:', err);
            }
          }} className="mt-3 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800" placeholder="Signature label (e.g., Authorized Signatory)" />
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
                <tr key={participant._id} className="border-b border-slate-100 hover:bg-slate-50 transition">
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
                    <select value={participant.deliveredStatus || 'pending'} onChange={(e) => updateStatus(participant._id, e.target.value)} className="border border-slate-300 rounded-md px-2 py-1 text-sm">
                      <option value="pending">Pending</option>
                      <option value="delivered">Delivered</option>
                      <option value="bounced">Bounced</option>
                    </select>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() => handleDownloadCertificate(participant)}
                      disabled={generatingId === participant._id}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition duration-200 shadow-sm hover:shadow"
                    >
                      {generatingId === participant._id ? (
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
