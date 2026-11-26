import React, { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  MapPin,
  PenSquare,
  Phone,
  ShieldCheck,
  Upload,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BANGLADESH_LOCATIONS } from '../lib/bangladesh-locations.ts';
import { processGalleryImageFile } from '../lib/image-upload.ts';
import type { PublicSiteSettings, UserProfile } from '../types.ts';

interface CreatorSignupViewProps {
  siteSettings?: PublicSiteSettings;
  onSignupSuccess: () => void;
  onOpenCreatorStudio: () => void;
  onOpenLogin: () => void;
  onBackToFeed: () => void;
}

export const CreatorSignupView: React.FC<CreatorSignupViewProps> = ({
  siteSettings,
  onSignupSuccess,
  onOpenCreatorStudio,
  onOpenLogin,
  onBackToFeed,
}) => {
  const { user, signInWithGoogle, setSessionAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sandboxOtp, setSandboxOtp] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [division, setDivision] = useState('Dhaka');
  const [district, setDistrict] = useState('Dhaka');
  const [upazila, setUpazila] = useState('Savar');
  const [unionWard, setUnionWard] = useState('');
  const [areaDetails, setAreaDetails] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const revSharePct = Number(siteSettings?.creator_revenue_share_pct ?? 60);
  const minWithdrawal = Number(siteSettings?.min_withdrawal_bdt ?? 500);
  const minFollowers = Number(siteSettings?.min_followers_monetization ?? 1000);
  const minViews = Number(siteSettings?.min_views_monetization ?? 10000);
  const registrationDisabled =
    siteSettings?.registration_enabled === false || siteSettings?.registration_enabled === 'false';

  const selectedDivisionObj = BANGLADESH_LOCATIONS.find((d) => d.name === division) || BANGLADESH_LOCATIONS[0];
  const selectedDistrictObj =
    selectedDivisionObj.districts.find((d) => d.name === district) || selectedDivisionObj.districts[0];

  const handleGoogleSignup = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onSignupSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google সাইন আপ সম্পন্ন করা যায়নি।');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError(null);
    setInfo(null);
    const target = (email || phone).trim();
    if (!target) {
      setError('OTP পাঠাতে প্রথমে ইমেইল অথবা মোবাইল নম্বর লিখুন।');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, purpose: 'register' }),
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
          password,
          bio,
          avatarUrl: avatarUrl || undefined,
          otpCode,
          division,
          district,
          upazila,
          unionWard,
          areaDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'সাইন আপ সম্পন্ন করা যায়নি');
      setSessionAuth(data.token, data.user as UserProfile);
      onSignupSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'রেজিস্ট্রেশন ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div className="max-w-3xl mx-auto py-4 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
            </div>
            <div className="space-y-1">
              <h1 className="font-editorial text-xl font-bold text-slate-900">
                আপনার কন্টেন্ট ক্রিয়েটর অ্যাকাউন্ট সক্রিয় রয়েছে
              </h1>
              <p className="text-sm text-slate-600">
                স্বাগতম, <span className="font-semibold text-slate-900">{user.fullName}</span> (@{user.username}) · {user.district}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs border-y border-slate-100 py-4 font-tabular">
            <div>
              <span className="text-slate-500 block">বর্তমান ফলোয়ার</span>
              <span className="text-base font-bold text-slate-900">{user.totalFollowers.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-500 block">বৈধ ভিউ</span>
              <span className="text-base font-bold text-slate-900">{user.validViews.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-500 block">মনিটাইজেশন স্ট্যাটাস</span>
              <span className="text-base font-bold text-emerald-700">{user.monetizationStatus}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSignupSuccess}
              className="px-5 py-2.5 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 inline-flex items-center gap-2"
            >
              <PenSquare className="w-4 h-4" />
              এখনই সংবাদ পোস্ট করুন
            </button>
            <button
              type="button"
              onClick={onOpenCreatorStudio}
              className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 inline-flex items-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              ক্রিয়েটর স্টুডিও ও আয় দেখুন
            </button>
            <button
              type="button"
              onClick={onBackToFeed}
              className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              হোম ফিডে ফিরুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-2 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Creator Earning Proposition */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-slate-900 text-white rounded-xl p-6 sm:p-7 space-y-5">
            <div className="text-xs font-semibold tracking-wide text-emerald-400 uppercase">
              নাগরিক সাংবাদিকতা ও আয় প্রোগ্রাম
            </div>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold leading-snug">
              নিজের এলাকার খবর লিখে নিয়মিত আয় করুন
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              সাইন আপ সম্পন্ন করার সাথে সাথেই আপনার কন্টেন্ট ক্রিয়েটর প্রোফাইল তৈরি হবে। স্থানীয় সংবাদ, ছবি ও ভিডিও প্রকাশ করে পাঠকের ভিউ এবং বিজ্ঞাপন থেকে সরাসরি আয় করুন।
            </p>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800 font-tabular">
              <div>
                <div className="text-xl font-bold text-white">{revSharePct}%</div>
                <div className="text-[11px] text-slate-400">রেভিনিউ শেয়ার</div>
              </div>
              <div>
                <div className="text-xl font-bold text-emerald-400">৳{minWithdrawal}</div>
                <div className="text-[11px] text-slate-400">ন্যূনতম উত্তোলন</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">৬৪ জেলা</div>
                <div className="text-[11px] text-slate-400">লোকাল রিচ</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3.5 text-xs">
            <h2 className="text-sm font-bold text-slate-900">কন্টেন্ট ক্রিয়েটর হিসেবে যা পাবেন</h2>
            <ul className="space-y-2.5 text-slate-600">
              <li className="flex items-start gap-2.5">
                <PenSquare className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span>তাৎক্ষণিক সংবাদ, গ্যালারি ছবি ও ভিডিও প্রকাশের পূর্ণ সুবিধা এবং AI হেডলাইন সহায়তা।</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Wallet className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span className="font-tabular">
                  {minFollowers.toLocaleString()} ফলোয়ার ও {minViews.toLocaleString()} বৈধ ভিউ পূর্ণ হলেই মনিটাইজেশন চালু — bKash, Nagad বা ব্যাংকে সরাসরি পেমেন্ট।
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <BadgeCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <span>অফিশিয়াল সাংবাদিক ভেরিফিকেশন ব্যাজ ও নিজস্ব পাবলিক প্রোফাইল (/profile/username)।</span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                <span>স্বয়ংক্রিয় অ্যান্টি-ফ্রড সুরক্ষা ও স্বচ্ছ রেভিনিউ লেজার।</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Direct Creator Registration Form */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">কন্টেন্ট ক্রিয়েটর সাইন আপ</h2>
              <p className="text-xs text-slate-500 mt-0.5">সাইন আপ শেষেই সরাসরি সংবাদ পোস্ট করার পেজে চলে যাবেন</p>
            </div>
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-xs font-semibold text-red-700 hover:underline"
            >
              আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন
            </button>
          </div>

          {registrationDisabled ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              নতুন অ্যাকাউন্ট নিবন্ধন সাময়িকভাবে অ্যাডমিন কর্তৃক বন্ধ রাখা হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন বা লগইন করুন।
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignup}
                className="w-full flex items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.4 14.7 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z"
                  />
                </svg>
                Google দিয়ে ১ ক্লিকে ক্রিয়েটর অ্যাকাউন্ট খুলুন
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-xs text-slate-500 shrink-0">অথবা তথ্য পূরণ করে নিবন্ধন করুন</span>
                <div className="border-t border-slate-200 w-full" />
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

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">আপনার পূর্ণ নাম *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="যেমন: তানভীর আহমেদ"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">ইউজারনেম (Profile URL) *</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="tanvir_reporter"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-tabular focus:outline-none focus:border-red-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">ইমেইল *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">মোবাইল নম্বর (bKash/Nagad/যোগাযোগ)</label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+88017..."
                        className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-sm font-tabular focus:outline-none focus:border-red-700"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    শক্তিশালী পাসওয়ার্ড * (কমপক্ষে ৮ অক্ষর, বড়/ছোট হাতের অক্ষর ও সংখ্যা)
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="StrongPass123"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="প্রোফাইল ছবি" className="w-11 h-11 rounded-full object-cover border border-slate-300" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-white border border-slate-300 flex items-center justify-center text-slate-400">
                        <UserIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-semibold text-slate-800">প্রোফাইল ছবি (ঐচ্ছিক)</div>
                      <div className="text-[11px] text-slate-500">গ্যালারি থেকে আপনার ছবি যোগ করুন</div>
                    </div>
                  </div>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">
                    <Upload className="w-3.5 h-3.5" />
                    গ্যালারি থেকে আপলোড
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.currentTarget.value = '';
                        if (!file) return;
                        setError(null);
                        try {
                          const uri = await processGalleryImageFile(file, { maxDimension: 512, quality: 0.85, maxOutputBytes: 450 * 1024 });
                          setAvatarUrl(uri);
                        } catch (uploadErr: unknown) {
                          setError(uploadErr instanceof Error ? uploadErr.message : 'ছবি আপলোড ব্যর্থ হয়েছে');
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">সংক্ষিপ্ত পরিচয় / আপনি কোন ধরনের সংবাদ লিখবেন</label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="যেমন: স্থানীয় শিক্ষা, কৃষি ও জনদুর্ভোগ নিয়ে নিয়মিত প্রতিবেদন করি।"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-red-700" />
                    <span>আপনার এলাকার তথ্য (স্থানীয় সংবাদের জন্য)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={division}
                      onChange={(e) => {
                        const nextDiv = BANGLADESH_LOCATIONS.find((d) => d.name === e.target.value) || BANGLADESH_LOCATIONS[0];
                        setDivision(nextDiv.name);
                        setDistrict(nextDiv.districts[0].name);
                        setUpazila(nextDiv.districts[0].upazilas[0]);
                      }}
                      className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs bg-white"
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
                      className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs bg-white"
                    >
                      {selectedDivisionObj.districts.map((d) => (
                        <option key={d.name} value={d.name}>{d.bnName}</option>
                      ))}
                    </select>
                    <select
                      value={upazila}
                      onChange={(e) => setUpazila(e.target.value)}
                      className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs bg-white"
                    >
                      {selectedDistrictObj.upazilas.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={unionWard}
                      onChange={(e) => setUnionWard(e.target.value)}
                      placeholder="ইউনিয়ন / পৌরসভা / ওয়ার্ড"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      value={areaDetails}
                      onChange={(e) => setAreaDetails(e.target.value)}
                      placeholder="এলাকার বিস্তারিত ঠিকানা"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-end gap-2 pt-1">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-700 mb-1">OTP যাচাইকরণ কোড *</label>
                    <input
                      type="text"
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="৬ সংখ্যার OTP দিন"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-tabular"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSendOtp}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                  >
                    OTP পাঠান
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-emerald-700 py-3 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  <span>{loading ? 'ক্রিয়েটর অ্যাকাউন্ট তৈরি হচ্ছে...' : 'সাইন আপ সম্পন্ন করুন ও সংবাদ লেখা শুরু করুন'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
