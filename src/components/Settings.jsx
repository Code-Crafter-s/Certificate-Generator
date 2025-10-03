import { useEffect, useState } from 'react';
import { Save, Settings as SettingsIcon, QrCode } from 'lucide-react';
import apiService from '../services/api';

export default function Settings() {
  const [eventName, setEventName] = useState('HackManthan 2025');
  const [eventDetails, setEventDetails] = useState('Participation Certificate');
  const [organizerName, setOrganizerName] = useState('');
  const [organizerWebsite, setOrganizerWebsite] = useState('');
  const [authorizedName, setAuthorizedName] = useState('');
  const [qrEnabled, setQrEnabled] = useState(false);
  const [qrBaseUrl, setQrBaseUrl] = useState('');
  const [certifyText, setCertifyText] = useState('This is to certify that');
  const [fatherPrefix, setFatherPrefix] = useState('S/O');
  const [completionText, setCompletionText] = useState('has successfully completed');
  const [completionSubText, setCompletionSubText] = useState('with exceptional engagement and dedication.');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await apiService.getSettings();
      if (s.eventName) setEventName(s.eventName);
      if (s.eventDetails) setEventDetails(s.eventDetails);
      if (s.organizerName) setOrganizerName(s.organizerName);
      if (s.organizerWebsite) setOrganizerWebsite(s.organizerWebsite);
      if (s.authorizedName) setAuthorizedName(s.authorizedName);
      if (typeof s.qrEnabled === 'boolean') setQrEnabled(s.qrEnabled);
      if (s.qrBaseUrl) setQrBaseUrl(s.qrBaseUrl);
      if (s.certifyText) setCertifyText(s.certifyText);
      if (s.fatherPrefix) setFatherPrefix(s.fatherPrefix);
      if (s.completionText) setCompletionText(s.completionText);
      if (s.completionSubText) setCompletionSubText(s.completionSubText);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const save = async () => {
    try {
      const s = { 
        eventName, 
        eventDetails, 
        organizerName, 
        organizerWebsite, 
        authorizedName, 
        qrEnabled, 
        qrBaseUrl, 
        certifyText, 
        fatherPrefix, 
        completionText, 
        completionSubText 
      };
      await apiService.updateSettings(s);
      alert('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
          <SettingsIcon className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Certificate Settings</h2>
          <p className="text-slate-600 text-sm">Event, organizer, and QR options</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Event Name</label>
          <input value={eventName} onChange={(e) => setEventName(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-800" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Event Details</label>
          <input value={eventDetails} onChange={(e) => setEventDetails(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-800" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Authorized Person Name</label>
          <input value={authorizedName} onChange={(e) => setAuthorizedName(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-800" placeholder="e.g., Saksham Shakya" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Organizer Name</label>
          <input value={organizerName} onChange={(e) => setOrganizerName(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-800" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Organizer Website</label>
          <input value={organizerWebsite} onChange={(e) => setOrganizerWebsite(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-800" />
        </div>
      </div>

      <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-3">Text Placeholders</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Certify Text</label>
            <input value={certifyText} onChange={(e) => setCertifyText(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Father Prefix</label>
            <input value={fatherPrefix} onChange={(e) => setFatherPrefix(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Completion Text</label>
            <input value={completionText} onChange={(e) => setCompletionText(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-800" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Completion Sub Text</label>
            <input value={completionSubText} onChange={(e) => setCompletionSubText(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-800" />
          </div>
        </div>
      </div>

      <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <QrCode className="w-5 h-5 text-slate-700" />
          <h3 className="font-semibold text-slate-800">QR Code</h3>
        </div>
        <label className="flex items-center gap-2 text-slate-700">
          <input type="checkbox" checked={qrEnabled} onChange={(e) => setQrEnabled(e.target.checked)} />
          Enable QR on certificates
        </label>
        <input disabled={!qrEnabled} placeholder="QR base URL (e.g., https://example.com/verify)" value={qrBaseUrl} onChange={(e) => setQrBaseUrl(e.target.value)} className="mt-3 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-800 disabled:bg-slate-100 disabled:text-slate-500" />
        <p className="text-xs text-slate-500 mt-2">QR payload will include name and registration number appended as query params.</p>
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={save} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
          <Save className="w-4 h-4" /> Save Settings
        </button>
      </div>
    </div>
  );
}


