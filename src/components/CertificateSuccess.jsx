import { useState } from 'react';
import { CheckCircle, Download, Loader2 } from 'lucide-react';
import { generateCertificate, downloadPDF } from '../utils/certificateGenerator';

export default function CertificateSuccess({ participant, onReset }) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const pdfBytes = await generateCertificate(participant);
      downloadPDF(pdfBytes, `certificate_${participant.regNo}.pdf`);

      const participants = JSON.parse(localStorage.getItem('participants') || '[]');
      const updated = participants.map(p =>
        p.regNo === participant.regNo ? { ...p, certificateGenerated: true } : p
      );
      localStorage.setItem('participants', JSON.stringify(updated));
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert('Failed to generate certificate. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Registration Successful!</h2>
        <p className="text-slate-600 mb-6">Your certificate is ready to download</p>

        <div className="bg-slate-50 rounded-lg p-6 mb-6 text-left border border-slate-200">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Name</p>
              <p className="font-semibold text-slate-800">{participant.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Father's Name</p>
              <p className="font-semibold text-slate-800">{participant.fatherName}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Registration Number</p>
              <p className="font-semibold text-slate-800">{participant.regNo}</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={generating}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 mb-3"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Download Certificate
            </>
          )}
        </button>

        <button
          onClick={onReset}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-6 rounded-lg transition duration-200"
        >
          Register Another Participant
        </button>
      </div>
    </div>
  );
}
