import React, { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { AuditLog } from '../../types';
import { 
  Settings as SettingsIcon, 
  School, 
  Clock, 
  Mail, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  RotateCw, 
  Send 
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { userProfile } = useAuth();

  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [address, setAddress] = useState(settings.address || 'Mabalacat City, Pampanga');
  const [motto, setMotto] = useState(settings.motto || "Mabuhay ka! Sumulong ka! Itataas namin ang ngalan mo't dangal.");
  const [schoolLogo, setSchoolLogo] = useState(settings.schoolLogo || '/school-logo.png');
  const [timezone, setTimezone] = useState(settings.timezone || 'Asia/Manila');
  const [openingTime, setOpeningTime] = useState(settings.openingTime || '07:00');
  const [lateCutoff, setLateCutoff] = useState(settings.lateCutoff || '07:30');
  const [closingTime, setClosingTime] = useState(settings.closingTime || '17:00');
  const [schoolDays, setSchoolDays] = useState<string[]>(settings.schoolDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);

  const [resendApiKey, setResendApiKey] = useState(settings.resendApiKey || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Email test sender
  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState('');

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    setSchoolName(settings.schoolName);
    setAddress(settings.address || 'Mabalacat City, Pampanga');
    setMotto(settings.motto || "Mabuhay ka! Sumulong ka! Itataas namin ang ngalan mo't dangal.");
    setSchoolLogo(settings.schoolLogo || '/school-logo.png');
    setResendApiKey(settings.resendApiKey || '');
    setTimezone(settings.timezone);
    setOpeningTime(settings.openingTime);
    setLateCutoff(settings.lateCutoff);
    setClosingTime(settings.closingTime);
    setSchoolDays(settings.schoolDays);
  }, [settings]);

  useEffect(() => {
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(25)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAuditLogs(snap.docs.map(d => ({ ...d.data(), auditId: d.id } as AuditLog)));
    }, (err) => {
      console.warn('Audit logs listener error:', err);
    });

    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await updateSettings({
        schoolName: schoolName.trim(),
        address: address.trim(),
        motto: motto.trim(),
        schoolLogo: schoolLogo.trim(),
        resendApiKey: resendApiKey.trim(),
        timezone: timezone.trim(),
        openingTime,
        lateCutoff,
        closingTime,
        schoolDays
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error updating settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDayToggle = (day: string) => {
    if (schoolDays.includes(day)) {
      setSchoolDays(schoolDays.filter(d => d !== day));
    } else {
      setSchoolDays([...schoolDays, day]);
    }
  };

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleTestEmailSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) return;

    setTestingEmail(true);
    setEmailStatusMessage('');

    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: testEmail.trim(),
          testApiKey: resendApiKey.trim()
        })
      });
      const data = await res.json();
      if (data.simulated) {
        setEmailStatusMessage(`Simulated email logged. (System is active. Provide a live Resend API key below to send real emails to parent inboxes).`);
      } else if (data.success) {
        setEmailStatusMessage(`Success! Real attendance test notification delivered to ${testEmail}. Please check your inbox or spam folder.`);
      } else {
        setEmailStatusMessage(`Notice: ${data.error || 'Failed to dispatch email.'}`);
      }
    } catch (e: any) {
      setEmailStatusMessage(`Error: ${e.message}`);
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-blue-600" />
          <span>School Operational Schedules &amp; System Configuration</span>
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          Configure gate entry timetables, late cutoff parameters, school timezones, and parent notification credentials.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>School timetable configuration updated successfully across all gates and terminals!</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <School className="w-4 h-4 text-blue-600" />
            <span>Institution Information</span>
          </h3>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-4">
            <img 
              src={schoolLogo || '/school-logo.png'} 
              alt="School Seal" 
              className="w-16 h-16 rounded-full border-2 border-amber-400 bg-white p-1 object-contain shadow-xs shrink-0" 
            />
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-slate-900">{schoolName || 'Madapdap Resettlement High School'}</h4>
              <p className="text-xs text-slate-500 font-medium">{address || 'Mabalacat City, Pampanga'}</p>
              <p className="text-[11px] text-amber-700 italic font-semibold">"{motto}"</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official School Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Campus Location / Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Mabalacat City, Pampanga"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                School Motto / Alma Mater Slogan
              </label>
              <input
                type="text"
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                placeholder="Mabuhay ka! Sumulong ka! Itataas namin ang ngalan mo't dangal."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                School Logo Image Path
              </label>
              <input
                type="text"
                value={schoolLogo}
                onChange={(e) => setSchoolLogo(e.target.value)}
                placeholder="/school-logo.png"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official Timezone <span className="text-rose-500">*</span>
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
              >
                <option value="Asia/Manila">Asia/Manila (GMT+8) - Default</option>
                <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Campus Gate Timetable &amp; Late Cutoff Rules</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Gate Opening Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Earliest student check-in</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Late Arrival Cutoff <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={lateCutoff}
                onChange={(e) => setLateCutoff(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-bold text-amber-700"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Scans after this are flagged LATE</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dismissal / Closing Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Scheduled campus exit</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Active School Days
            </label>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map((day) => {
                const isSelected = schoolDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayToggle(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-xs shadow-blue-500/20 disabled:opacity-50 transition-colors"
          >
            {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* Parent Email Notification Service Status & Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            <span>Parent Auto-Email Notification Engine (Resend API)</span>
          </h3>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
            resendApiKey ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            <CheckCircle2 className="w-3 h-3" />
            {resendApiKey ? 'Live Email Delivery Active' : 'Simulated Delivery (No Key Yet)'}
          </span>
        </div>

        {/* How Automated Alerts Work */}
        <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl text-xs space-y-2">
          <h4 className="font-bold text-blue-900">How Automated Parent Notifications Work:</h4>
          <ol className="list-decimal list-inside space-y-1 text-slate-700 text-[11px] leading-relaxed">
            <li><strong>Parent Registration:</strong> Register the parent or guardian's email under <em>Students</em> or <em>Parents/Guardians</em>.</li>
            <li><strong>Gate Verification:</strong> Each time a student scans their QR badge at the gate terminal (Entry or Exit), the system retrieves the linked guardian.</li>
            <li><strong>Instant Dispatch:</strong> The system automatically dispatches a branded email receipt with student details, exact timestamp, and status (PRESENT or LATE).</li>
            <li><strong>Audit Logs:</strong> Monitor all sent and queued notices under the <em>Email Notifications</em> tab.</li>
          </ol>
        </div>

        {/* Resend API Key Setup */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <label className="text-xs font-bold text-slate-800">
              Resend API Key (<code className="text-blue-600 font-mono">re_...</code>)
            </label>
            <a 
              href="https://resend.com" 
              target="_blank" 
              rel="noreferrer" 
              className="text-[11px] text-blue-600 hover:underline font-semibold"
            >
              Get free API key at Resend.com &rarr;
            </a>
          </div>
          
          <div className="flex gap-2">
            <input
              type="password"
              value={resendApiKey}
              onChange={(e) => setResendApiKey(e.target.value)}
              placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono bg-white"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shrink-0 cursor-pointer"
            >
              Save Key
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            Resend includes 3,000 free emails per month (100 emails/day), ideal for daily school gate attendance.
          </p>
        </div>

        {/* Live Email Tester */}
        <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-emerald-600" />
            <span>Test Email Dispatcher (Send a sample alert to verify delivery)</span>
          </h4>
          
          <form onSubmit={handleTestEmailSend} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              required
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="admin@school.edu.ph"
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
            />
            <button
              type="submit"
              disabled={testingEmail}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {testingEmail ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{testingEmail ? 'Sending...' : 'Send Test Alert'}</span>
            </button>
          </form>

          {emailStatusMessage && (
            <div className={`p-3 rounded-xl text-xs font-medium ${
              emailStatusMessage.includes('Success') 
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                : 'bg-blue-100 text-blue-900 border border-blue-200'
            }`}>
              {emailStatusMessage}
            </div>
          )}
        </div>
      </div>

      {/* Immutable Audit Log */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Administrative Audit Trail</span>
        </h3>

        {auditLogs.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No administrative audit actions recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto text-xs">
            {auditLogs.map((log) => (
              <div key={log.auditId} className="py-2.5 flex items-start justify-between">
                <div>
                  <div className="font-bold text-slate-800">
                    {log.action} &bull; Target: {log.targetId}
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    {log.details}
                  </div>
                </div>
                <div className="font-mono text-slate-400 text-[10px] shrink-0 ml-3">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
