import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Mail, 
  Lock, 
  User, 
  AlertCircle,
  ScanLine,
  ArrowRight,
  Copy,
  Check,
  Shield,
  School
} from 'lucide-react';

export const Login: React.FC = () => {
  const { 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    loginAsDemoGuard, 
    loading 
  } = useAuth();

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState<{ title: string; desc: string; domain?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      const code = err.code || '';
      
      if (code === 'auth/unauthorized-domain') {
        setErrorMsg({
          title: 'Domain Not Authorized',
          desc: 'Please add this domain under Firebase Console > Authentication > Settings > Authorized domains:',
          domain: currentHostname
        });
      } else if (code === 'auth/popup-blocked') {
        setErrorMsg({
          title: 'Pop-up Window Blocked',
          desc: 'Please allow pop-ups for this site in your browser, or sign in using email and password.'
        });
      } else if (code === 'auth/operation-not-allowed') {
        setErrorMsg({
          title: 'Google Provider Not Enabled',
          desc: 'Please enable Google sign-in under Firebase Console > Authentication > Sign-in method.'
        });
      } else {
        setErrorMsg({
          title: 'Sign-in Failed',
          desc: err.message || 'Unable to complete Google sign-in. Please try again or use email sign-in.'
        });
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (tab === 'signup') {
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        await signUpWithEmail(email.trim(), password, fullName.trim(), 'GUARD');
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (err: any) {
      setErrorMsg({
        title: 'Authentication Failed',
        desc: err.message || 'Invalid email or password. Please check your credentials.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyDomain = () => {
    if (errorMsg?.domain) {
      navigator.clipboard.writeText(errorMsg.domain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-x-hidden font-sans">
      {/* Background Campus Photo with Deep Vignette */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('/campus-bg.png')` }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-900/85 backdrop-blur-[2px]" />

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 my-auto">
        <div className="w-full max-w-md space-y-5">

          {/* School Emblem & Header */}
          <div className="text-center space-y-2">
            {/* Crisp School Seal */}
            <div className="inline-block relative">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white p-1.5 shadow-2xl ring-2 ring-amber-400 mx-auto flex items-center justify-center">
                <img 
                  src="/school-logo.png" 
                  alt="Madapdap Resettlement High School Seal"
                  className="w-full h-full object-contain rounded-full" 
                />
              </div>
            </div>

            {/* School Name & System Title */}
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight uppercase drop-shadow">
                Madapdap Resettlement High School
              </h1>
              <p className="text-xs text-slate-300 font-semibold tracking-wider uppercase mt-0.5">
                Mabalacat City, Pampanga
              </p>
              <div className="mt-2 inline-block px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30">
                <span className="text-xs sm:text-sm font-extrabold text-amber-300 uppercase tracking-wide">
                  Student Attendance &amp; Parent Alert System
                </span>
              </div>
            </div>
          </div>

          {/* Clean Glassmorphic Auth Card */}
          <div className="bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100">
            
            {/* Tab Pill Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-950/60 rounded-xl border border-white/10 mb-5">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setTab('signin');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  tab === 'signin'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setTab('signup');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  tab === 'signup'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Register Staff
              </button>
            </div>

            {/* Error Banner with Optional Domain Copy */}
            {errorMsg && (
              <div className="mb-4 p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs rounded-2xl space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg.title}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {errorMsg.desc}
                </p>
                {errorMsg.domain && (
                  <div className="p-2 bg-black/60 rounded-xl font-mono text-[10px] text-amber-300 flex items-center justify-between">
                    <span className="truncate">{errorMsg.domain}</span>
                    <button
                      type="button"
                      onClick={handleCopyDomain}
                      className="ml-2 px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-md flex items-center gap-1 shrink-0 text-[10px] transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 min-h-[46px] bg-white hover:bg-slate-100 text-slate-800 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400 bg-transparent px-2">
                <span className="bg-slate-900 px-3 py-0.5 rounded-full border border-white/10">or continue with email</span>
              </div>
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {tab === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Officer Juan Dela Cruz"
                      className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] text-xs bg-slate-950/60 border border-white/15 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@school.edu.ph"
                    className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] text-xs bg-slate-950/60 border border-white/15 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                    className="w-full pl-10 pr-3.5 py-2.5 min-h-[44px] text-xs bg-slate-950/60 border border-white/15 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                className="w-full py-3 min-h-[46px] rounded-xl text-xs sm:text-sm font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-lg shadow-amber-400/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-1"
              >
                <span>{submitting ? 'Please wait...' : tab === 'signup' ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Gate Scanner Mode */}
            <div className="mt-5 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={loginAsDemoGuard}
                className="w-full py-2.5 px-3 min-h-[44px] rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <ScanLine className="w-4 h-4 text-amber-400" />
                <span>Open Mobile Gate Scanner</span>
              </button>
            </div>
          </div>

          {/* Simple Bottom Footer */}
          <div className="text-center text-[11px] text-slate-400 space-y-1">
            <p className="italic">"Mabuhay ka! Sumulong ka! Itataas namin ang ngalan mo't dangal."</p>
            <p>&copy; {new Date().getFullYear()} Madapdap Resettlement High School. All rights reserved.</p>
          </div>
        </div>
      </main>
    </div>
  );
};
