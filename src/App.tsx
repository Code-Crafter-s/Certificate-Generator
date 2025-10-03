import { useState } from 'react';
import { Award, FileText, Settings as SettingsIcon } from 'lucide-react';
import RegistrationForm from './components/RegistrationForm.jsx';
import CertificateSuccess from './components/CertificateSuccess.jsx';
import ParticipantsList from './components/ParticipantsList.jsx';
import Settings from './components/Settings.jsx';

type Participant = {
  id: string;
  name: string;
  fatherName: string;
  regNo: string;
  createdAt: string;
  certificateGenerated?: boolean;
};

function App() {
  const [currentView, setCurrentView] = useState('register');
  const [registeredParticipant, setRegisteredParticipant] = useState<Participant | null>(null);

  const handleRegister = (participant: Participant) => {
    setRegisteredParticipant(participant);
    setCurrentView('success');
  };

  const handleReset = () => {
    setRegisteredParticipant(null);
    setCurrentView('register');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-md">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Certificate Generator</h1>
                <p className="text-xs text-slate-500">Event Participation Certificates</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentView('register')}
                className={`px-4 py-2 rounded-lg font-medium transition duration-200 ${
                  currentView === 'register' || currentView === 'success'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Register
              </button>
              <button
                onClick={() => setCurrentView('participants')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition duration-200 ${
                  currentView === 'participants'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" />
                All Participants
              </button>
              <button
                onClick={() => setCurrentView('settings')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition duration-200 ${
                  currentView === 'settings'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <SettingsIcon className="w-4 h-4" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {currentView === 'register' && (
          <RegistrationForm onRegister={handleRegister} />
        )}

        {currentView === 'success' && registeredParticipant && (
          <CertificateSuccess
            participant={registeredParticipant}
            onReset={handleReset}
          />
        )}

        {currentView === 'participants' && (
          <ParticipantsList />
        )}
        {currentView === 'settings' && (
          <Settings />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-slate-500 text-sm">
            Certificate Generator System - Manage participant registrations and generate certificates
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
