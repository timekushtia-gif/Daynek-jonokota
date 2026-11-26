import React, { useState } from 'react';
import { X, ShieldCheck, KeyRound, Mail, Phone, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BANGLADESH_LOCATIONS } from '../lib/bangladesh-locations.ts';
import type { UserProfile } from '../types.ts';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose }) => {
  const { signInWithGoogle, setSessionAuth } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sandboxOtp, setSandboxOtp] = useState<string | null>(null);

  // Register fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [division, setDivision] = useState('Dhaka');
  const [district, setDistrict] = useState('Dhaka');
  const [upazila, setUpazila] = useState('Savar');
  const [unionWard, setUnionWard] = useState('');
  const [areaDetails, setAreaDetails] = useState('');
  const [regOtp, setRegOtp] = useState('');

  // Forgot password fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  if (!open) return null;

  const selectedDivisionObj = BANGLADESH_LOCATIONS.find((d) => d.name === division) || BANGLADESH_LOCATIONS[0];
  const selectedDistrictObj =
    selectedDivisionObj.districts.find((d) => d.name === district) || selectedDivisionObj.districts[0];

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (target: string, purpose: 'register' | 'reset') => {
    setError(null);
    setInfo(null);
    if (!target.trim()) {
      setError('প্রথমে ইমেইল অথবা মোবাইল নম্বর দিন।');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.trim(), purpose }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP পাঠানো যায়নি');
      setInfo(data.message);
      if (data.sandboxOtpPreview) setSandboxOtp(data.sandboxOtpPreview);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OTP পাঠানো ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, otpCode: requires2FA ? otpCode : undefined }),
      });
      const data = await res.json();
      if (res.status === 202 && data.requires2FA) {
        setRequires2FA(true);
        if (data.sandboxOtpPreview) setSandboxOtp(data.sandboxOtpPreview);
        setInfo(data.message);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'লগইন ব্যর্থ হয়েছে');
      setSessionAuth(data.token, data.user as UserProfile);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'লগইন করা যায়নি।');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          username,
          email,
          phone,
          password: regPassword,
          otpCode: regOtp,
          division,
          district,
          upazila,
          unionWard,
          areaDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে');
      setSessionAuth(data.token, data.user as UserProfile);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'রেজিস্ট্রেশন ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, otpCode: resetOtp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'পাসওয়ার্ড পরিবর্তন করা যায়নি');
      setInfo('পাসওয়ার্ড সফলভাবে আপডেট হয়েছে। এখন লগইন করুন।');
      setMode('login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'login' ? 'জনকথায় সাইন ইন করুন' : mode === 'register' ? 'নতুন নাগরিক সাংবাদিক অ্যাকাউন্ট' : 'পাসওয়ার্ড পুনরুদ্ধার'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">সুরক্ষিত অ্যাকাউন্ট ও এলাকাভিত্তিক সংবাদ প্রকাশনা</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Google Login */}
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.4 14.7 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            Google দিয়ে চালিয়ে যান
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-xs text-slate-500 shrink-0">অথবা ইমেইল / মোবাইল দিয়ে</span>
            <div className="border-t border-slate-200 w-full" />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setInfo(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              লগইন
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); setInfo(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              নতুন অ্যাকাউন্ট
            </button>
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(null); setInfo(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'forgot' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              পাসওয়ার্ড ভুলে গেছেন?
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 space-y-1">
              <p>{info}</p>
              {sandboxOtp && (
                <p className="font-tabular font-semibold">যাচাইকরণ OTP কোড: {sandboxOtp}</p>
              )}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ইমেইল অথবা মোবাইল নম্বর</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="example@mail.com বা +88017..."
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">পাসওয়ার্ড</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  />
                </div>
              </div>
              {requires2FA && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Two-Factor OTP কোড</label>
                  <input
                    type="text"
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="৬ সংখ্যার OTP দিন"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-tabular"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition-colors disabled:opacity-60"
              >
                {loading ? 'যাচাই হচ্ছে...' : 'লগইন করুন'}
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">পূর্ণ নাম</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="আপনার নাম"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ইউজারনেম (Profile URL)</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="mahmud_kushtia"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ইমেইল</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">মোবাইল নম্বর</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+88017..."
                      className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-sm font-tabular"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">শক্তিশালী পাসওয়ার্ড (৮+ অক্ষর, বড়/ছোট হাতের অক্ষর ও সংখ্যা)</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="StrongPass123"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-red-700" />
                  <span>আপনার এলাকার তথ্য</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={division}
                    onChange={(e) => {
                      const nextDiv = BANGLADESH_LOCATIONS.find((d) => d.name === e.target.value) || BANGLADESH_LOCATIONS[0];
                      setDivision(nextDiv.name);
                      setDistrict(nextDiv.districts[0].name);
                      setUpazila(nextDiv.districts[0].upazilas[0]);
                    }}
                    className="rounded-lg border border-slate-300 px-2 py-2 text-xs bg-white"
                  >
                    {BANGLADESH_LOCATIONS.map((d) => (
                      <option key={d.name} value={d.name}>{d.bnName}</option>
                    ))}
                  </select>
                  <select
                    value={district}
                    onChange={(e) => {
                      const nextDist = selectedDivisionObj.districts.find((d) => d.name === e.target.value) || selectedDivisionObj.districts[0];
                      setDistrict(nextDist.name);
                      setUpazila(nextDist.upazilas[0]);
                    }}
                    className="rounded-lg border border-slate-300 px-2 py-2 text-xs bg-white"
                  >
                    {selectedDivisionObj.districts.map((d) => (
                      <option key={d.name} value={d.name}>{d.bnName}</option>
                    ))}
                  </select>
                  <select
                    value={upazila}
                    onChange={(e) => setUpazila(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-2 text-xs bg-white"
                  >
                    {selectedDistrictObj.upazilas.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <input
                    type="text"
                    value={unionWard}
                    onChange={(e) => setUnionWard(e.target.value)}
                    placeholder="ইউনিয়ন / পৌরসভা / ওয়ার্ড"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={areaDetails}
                    onChange={(e) => setAreaDetails(e.target.value)}
                    placeholder="এলাকার সংক্ষিপ্ত বিবরণ"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">OTP কোড</label>
                  <input
                    type="text"
                    required
                    value={regOtp}
                    onChange={(e) => setRegOtp(e.target.value)}
                    placeholder="৬ সংখ্যার OTP"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-tabular"
                  />
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSendOtp(email || phone, 'register')}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                >
                  OTP পাঠান
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition-colors disabled:opacity-60"
              >
                {loading ? 'অ্যাকাউন্ট তৈরি হচ্ছে...' : 'অ্যাকাউন্ট খুলুন'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">নিবন্ধিত ইমেইল</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSendOtp(resetEmail, 'reset')}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                >
                  OTP পাঠান
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">OTP কোড</label>
                <input
                  type="text"
                  required
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                  placeholder="৬ সংখ্যার OTP"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">নতুন শক্তিশালী পাসওয়ার্ড</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="NewStrongPass123"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                পাসওয়ার্ড আপডেট করুন
              </button>
            </form>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>সকল পাসওয়ার্ড scrypt দিয়ে এনক্রিপ্ট করা এবং সেশন টোকেন মেমোরিতে সুরক্ষিত থাকে।</span>
          </div>
        </div>
      </div>
    </div>
  );
};
