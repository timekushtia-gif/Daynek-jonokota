import React, { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Coins,
  FileText,
  LogOut,
  Shield,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';
import type { CreatorDashboardData } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { BANGLADESH_LOCATIONS, CREATOR_LEVELS } from '../lib/bangladesh-locations.ts';
import { processGalleryImageFile } from '../lib/image-upload.ts';

interface CreatorDashboardViewProps {
  onOpenArticle: (slug: string) => void;
  onCreatePost: () => void;
}

export const CreatorDashboardView: React.FC<CreatorDashboardViewProps> = ({ onOpenArticle, onCreatePost }) => {
  const { apiFetch, refreshUser, logout } = useAuth();
  const [data, setData] = useState<CreatorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'posts' | 'withdraw' | 'verification' | 'settings'>('overview');
  const [postFilter, setPostFilter] = useState<'all' | 'published' | 'pending_review' | 'draft' | 'rejected'>('all');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Withdrawal form
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | 'bank'>('bkash');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('500');

  // Verification form
  const [verificationType, setVerificationType] = useState('local_reporter');
  const [nidOrPressId, setNidOrPressId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [docNotes, setDocNotes] = useState('');

  // Profile Settings form
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [division, setDivision] = useState('Dhaka');
  const [district, setDistrict] = useState('Dhaka');
  const [upazila, setUpazila] = useState('Savar');
  const [unionWard, setUnionWard] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<CreatorDashboardData>('/api/creators/me/dashboard');
      setData(res);
      setFullName(res.profile.fullName);
      setBio(res.profile.bio || '');
      setAvatarUrl(res.profile.avatarUrl || '');
      setCoverUrl(res.profile.coverUrl || '');
      setDivision(res.profile.division || 'Dhaka');
      setDistrict(res.profile.district || 'Dhaka');
      setUpazila(res.profile.upazila || 'Savar');
      setUnionWard(res.profile.unionWard || '');
      setTwoFactorEnabled(res.profile.twoFactorEnabled);
      setAccountName(res.profile.fullName);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'ড্যাশবোর্ড লোড করা যায়নি');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleApplyMonetization = async () => {
    setErr(null);
    setMsg(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/creators/me/monetization-apply', { method: 'POST' });
      setMsg(res.message);
      await loadDashboard();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'আবেদন ব্যর্থ হয়েছে');
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/api/creators/me/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod,
          accountName,
          accountNumber,
          amount: Number(withdrawAmount),
        }),
      });
      setMsg('উত্তোলনের অনুরোধ সফলভাবে জমা হয়েছে। ফিন্যান্স টিম যাচাই করে পেমেন্ট প্রসেস করবে।');
      await loadDashboard();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'উত্তোলনের অনুরোধ ব্যর্থ হয়েছে');
    }
  };

  const handleVerifyApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/api/creators/me/verify-apply', {
        method: 'POST',
        body: JSON.stringify({
          verificationType,
          nidOrPressId,
          organizationName: orgName,
          documentNotes: docNotes,
        }),
      });
      setMsg('ভেরিফিকেশন আবেদন জমা হয়েছে। অ্যাডমিন তথ্য যাচাই করে ব্যাজ অনুমোদন করবেন।');
      setNidOrPressId('');
      await loadDashboard();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'আবেদন ব্যর্থ হয়েছে');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          bio,
          avatarUrl,
          coverUrl,
          division,
          district,
          upazila,
          unionWard,
          twoFactorEnabled,
        }),
      });
      setMsg('প্রোফাইল ও নিরাপত্তা সেটিংস আপডেট হয়েছে।');
      await refreshUser();
      await loadDashboard();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'আপডেট ব্যর্থ হয়েছে');
    }
  };

  if (loading) return <div className="bg-white rounded-xl border border-slate-200 p-8 animate-pulse h-80" />;
  if (!data) return <div className="bg-white rounded-xl border border-slate-200 p-8 text-sm text-red-700">{err}</div>;

  const maxChartVal = Math.max(10, ...data.revenueChart.map((d) => d.views));
  const levelInfo = CREATOR_LEVELS.find((l) => l.level === data.profile.creatorLevel) || CREATOR_LEVELS[0];
  const filteredPosts = data.posts.filter((p) => (postFilter === 'all' ? true : p.status === postFilter));

  const divObj = BANGLADESH_LOCATIONS.find((d) => d.name === division) || BANGLADESH_LOCATIONS[0];
  const distObj = divObj.districts.find((d) => d.name === district) || divObj.districts[0];

  return (
    <div className="space-y-6">
      {/* Creator Studio Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">ক্রিয়েটর স্টুডিও ও আয় ড্যাশবোর্ড</h1>
            {data.profile.verificationType !== 'none' && <BadgeCheck className="w-5 h-5 text-sky-600" />}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Level {data.profile.creatorLevel} ({levelInfo.bnName}) · মনিটাইজেশন: {data.profile.monetizationStatus} · @{data.profile.username}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCreatePost}
            className="px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800 whitespace-nowrap"
          >
            + নতুন সংবাদ লিখুন
          </button>
          <button
            type="button"
            onClick={logout}
            className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 whitespace-nowrap inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            লগআউট
          </button>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
        {[
          { id: 'overview', label: 'আয় ও অ্যানালিটিক্স' },
          { id: 'posts', label: `আমার সংবাদ (${data.posts.length})` },
          { id: 'withdraw', label: 'পেমেন্ট ও উত্তোলন' },
          { id: 'verification', label: 'ভেরিফিকেশন ব্যাজ' },
          { id: 'settings', label: 'প্রোফাইল ও 2FA' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{err}</div>}
      {msg && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{msg}</div>}
      {data.eligibility.globalMonetizationEnabled === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          অ্যাডমিন সাময়িকভাবে প্ল্যাটফর্মের ক্রিয়েটর মনিটাইজেশন ব্যবস্থা বন্ধ রেখেছেন।
        </div>
      )}
      {(data.profile.monetizationStatus === 'disabled' || data.profile.monetizationStatus === 'suspended') && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          আপনার প্রোফাইল মনিটাইজেশন বর্তমানে <strong>{data.profile.monetizationStatus}</strong> অবস্থায় রয়েছে। বিস্তারিত জানতে অ্যাডমিনের সাথে যোগাযোগ করুন।
        </div>
      )}

      {tab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-xs text-slate-500">উত্তোলনযোগ্য ব্যালেন্স</span>
              <div className="text-2xl font-bold text-emerald-700 font-tabular mt-1">
                ৳{data.earnings.withdrawableBalance.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400">অনুমোদিত: ৳{data.earnings.approvedEarnings}</span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-xs text-slate-500">মোট আয় (Lifetime)</span>
              <div className="text-2xl font-bold text-slate-900 font-tabular mt-1">
                ৳{data.earnings.lifetimeEarnings.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400">এই মাস: ৳{data.earnings.monthEarnings} · পেন্ডিং: ৳{data.earnings.pendingEarnings}</span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-xs text-slate-500">বৈধ ভিউ / মোট ভিউ</span>
              <div className="text-2xl font-bold text-slate-900 font-tabular mt-1">
                {data.profile.validViews.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400">মোট ভিউ: {data.profile.totalViews.toLocaleString()} · RPM ৳{data.earnings.estimatedRpm}</span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <span className="text-xs text-slate-500">ফলোয়ার ও আজকের আয়</span>
              <div className="text-2xl font-bold text-slate-900 font-tabular mt-1">
                {data.profile.totalFollowers.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400">আজ: ৳{data.earnings.todayEarnings} · গতকাল: ৳{data.earnings.yesterdayEarnings}</span>
            </div>
          </div>

          {/* 7-Day Revenue & Views Analytics Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-red-700" />
                ৭ দিনের ভিউ ও আনুমানিক আয় অ্যানালিটিক্স
              </h2>
              <span className="text-xs text-slate-500 font-tabular">CPM: ৳{data.earnings.estimatedCpm} · Share: {data.eligibility.revSharePct}%</span>
            </div>
            <div className="grid grid-cols-7 gap-3 items-end h-44 pt-4">
              {data.revenueChart.map((bar) => {
                const heightPct = Math.max(10, Math.round((bar.views / maxChartVal) * 100));
                return (
                  <div key={bar.day} className="flex flex-col items-center justify-end h-full gap-1.5">
                    <span className="text-[11px] font-tabular text-slate-600">৳{bar.revenueBdt}</span>
                    <div className="w-full max-w-[42px] bg-slate-100 rounded-t-md flex items-end h-28 overflow-hidden">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full bg-red-700 rounded-t-md transition-all"
                        title={`${bar.views} views`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 text-center truncate w-full">{bar.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Automatic Monetization Eligibility */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-600" />
                  অটোমেটিক মনিটাইজেশন যোগ্যতা (Eligibility)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  শর্ত পূরণের পর কপিরাইট ও ভুয়া ট্রাফিক যাচাই করে অ্যাডমিন অনুমোদন প্রদান করেন।
                </p>
              </div>
              {data.profile.monetizationStatus === 'eligible' && data.eligibility.globalMonetizationEnabled !== false && (
                <button
                  type="button"
                  onClick={handleApplyMonetization}
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
                >
                  মনিটাইজেশনের জন্য আবেদন করুন
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">ন্যূনতম ফলোয়ার</span>
                  <CheckCircle2 className={`w-4 h-4 ${data.eligibility.followersMet ? 'text-emerald-600' : 'text-slate-300'}`} />
                </div>
                <div className="text-sm font-bold font-tabular mt-1">
                  {data.profile.totalFollowers.toLocaleString()} / {data.eligibility.minFollowers.toLocaleString()}
                </div>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">ন্যূনতম বৈধ ভিউ</span>
                  <CheckCircle2 className={`w-4 h-4 ${data.eligibility.viewsMet ? 'text-emerald-600' : 'text-slate-300'}`} />
                </div>
                <div className="text-sm font-bold font-tabular mt-1">
                  {data.profile.validViews.toLocaleString()} / {data.eligibility.minViews.toLocaleString()}
                </div>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">কপিরাইট ও নীতিমালা</span>
                  <CheckCircle2 className={`w-4 h-4 ${data.eligibility.cleanStanding ? 'text-emerald-600' : 'text-red-600'}`} />
                </div>
                <div className="text-sm font-bold font-tabular mt-1">
                  {data.profile.copyrightStrikes} স্ট্রাইক · {data.profile.guidelineViolations} ভায়োলেশন
                </div>
              </div>
            </div>
          </div>

          {/* Top Performing Posts */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-900 mb-3">সেরা পারফর্মিং সংবাদ</h2>
            <div className="divide-y divide-slate-100">
              {data.topPosts.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => onOpenArticle(p.slug)}
                    className="text-sm font-medium text-slate-900 hover:text-red-700 text-left truncate"
                  >
                    {p.title}
                  </button>
                  <div className="text-xs text-slate-500 font-tabular shrink-0">
                    {p.validViewsCount.toLocaleString()} ভিউ · {p.likesCount.toLocaleString()} লাইক
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'posts' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'all', label: 'সব' },
              { id: 'published', label: 'প্রকাশিত' },
              { id: 'pending_review', label: 'রিভিউতে' },
              { id: 'draft', label: 'খসড়া' },
              { id: 'rejected', label: 'রিজেক্টেড' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPostFilter(f.id as typeof postFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  postFilter === f.id ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="divide-y divide-slate-100">
            {filteredPosts.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">এই বিভাগে কোনো সংবাদ নেই।</p>
            ) : (
              filteredPosts.map((p) => (
                <div key={p.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <button
                      type="button"
                      onClick={() => onOpenArticle(p.slug)}
                      className="text-sm font-semibold text-slate-900 hover:text-red-700 text-left"
                    >
                      {p.title}
                    </button>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p.postType} · {p.district} · স্ট্যাটাস: <span className="font-semibold">{p.status}</span>
                    </p>
                    {p.rejectionReason && (
                      <p className="text-xs text-red-700 mt-1">রিজেকশনের কারণ: {p.rejectionReason}</p>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-tabular shrink-0 flex items-center gap-3">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{p.validViewsCount.toLocaleString()} ভিউ</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'withdraw' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleWithdraw} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-700" />
              টাকা উত্তোলনের অনুরোধ (ন্যূনতম ৳{data.eligibility.minWithdrawal})
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">পেমেন্ট মেথড</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'bkash' | 'nagad' | 'bank')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="bkash">bKash (বিকাশ)</option>
                <option value="nagad">Nagad (নগদ)</option>
                <option value="bank">Bank Account (ব্যাংক অ্যাকাউন্ট)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">অ্যাকাউন্ট হোল্ডারের নাম</label>
              <input
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {paymentMethod === 'bank' ? 'ব্যাংক অ্যাকাউন্ট নম্বর ও শাখা' : 'মোবাইল নম্বর'}
              </label>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">পরিমাণ (BDT ৳)</label>
              <input
                type="number"
                required
                min={data.eligibility.minWithdrawal}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-tabular"
              />
              <p className="text-[11px] text-slate-500 mt-1 font-tabular">
                উত্তোলনযোগ্য ব্যালেন্স: ৳{data.earnings.withdrawableBalance.toLocaleString()}
              </p>
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              পেমেন্ট রিকোয়েস্ট পাঠান
            </button>
          </form>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">পেমেন্ট ও আয় লেজার হিস্ট্রি</h2>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {data.withdrawals.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">এখনো কোনো উত্তোলনের রেকর্ড নেই।</p>
              ) : (
                data.withdrawals.map((w) => (
                  <div key={w.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 uppercase">{w.paymentMethod}</span> · {w.accountNumber}
                      {w.transactionRef && (
                        <div className="text-[11px] text-emerald-700 font-tabular">Ref: {w.transactionRef}</div>
                      )}
                    </div>
                    <div className="text-right font-tabular">
                      <div className="font-bold text-slate-900">৳{w.amountBdt}</div>
                      <div className="text-[11px] text-slate-500">{w.status}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'verification' && (
        <form onSubmit={handleVerifyApply} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-w-xl">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-sky-600" />
            অফিশিয়াল ভেরিফিকেশন ব্যাজের আবেদন
          </h2>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ভেরিফিকেশন ধরন</label>
            <select
              value={verificationType}
              onChange={(e) => setVerificationType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="verified_creator">Verified Creator</option>
              <option value="local_reporter">Local Reporter</option>
              <option value="journalist">Journalist</option>
              <option value="official_org">Official Organization</option>
              <option value="government">Government / Institution</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">জাতীয় পরিচয়পত্র (NID) / প্রেস কার্ড নম্বর *</label>
            <input
              type="text"
              required
              value={nidOrPressId}
              onChange={(e) => setNidOrPressId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">প্রতিষ্ঠান / মিডিয়ার নাম (যদি থাকে)</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ডকুমেন্ট নোটস / লিংক</label>
            <textarea
              rows={3}
              value={docNotes}
              onChange={(e) => setDocNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">
            আবেদন জমা দিন
          </button>
        </form>
      )}

      {tab === 'settings' && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-w-2xl">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-700" />
            প্রোফাইল ও টু-ফ্যাক্টর নিরাপত্তা সেটিংস
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">পূর্ণ নাম</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-700">প্রোফাইল ছবি</label>
                <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800">
                  <Upload className="w-3 h-3" />
                  গ্যালারি থেকে নিন
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.currentTarget.value = '';
                      if (!file) return;
                      setErr(null);
                      try {
                        const uri = await processGalleryImageFile(file, { maxDimension: 512, quality: 0.85, maxOutputBytes: 450 * 1024 });
                        setAvatarUrl(uri);
                      } catch (uploadErr: unknown) {
                        setErr(uploadErr instanceof Error ? uploadErr.message : 'ছবি আপলোড ব্যর্থ হয়েছে');
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              {avatarUrl && (
                <img src={avatarUrl} alt="প্রোফাইল প্রিভিউ" className="w-14 h-14 rounded-full object-cover border border-slate-300" />
              )}
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="অথবা ছবির URL..."
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              />
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-700">কভার ছবি</label>
                <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800">
                  <Upload className="w-3 h-3" />
                  গ্যালারি থেকে নিন
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.currentTarget.value = '';
                      if (!file) return;
                      setErr(null);
                      try {
                        const uri = await processGalleryImageFile(file, { maxDimension: 1280, quality: 0.82 });
                        setCoverUrl(uri);
                      } catch (uploadErr: unknown) {
                        setErr(uploadErr instanceof Error ? uploadErr.message : 'কভার ছবি আপলোড ব্যর্থ হয়েছে');
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              {coverUrl && (
                <img src={coverUrl} alt="কভার প্রিভিউ" className="w-full h-14 rounded-md object-cover border border-slate-300" />
              )}
              <input
                type="text"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="অথবা কভার ছবির URL..."
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">বায়ো</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select
              value={division}
              onChange={(e) => {
                const d = BANGLADESH_LOCATIONS.find((x) => x.name === e.target.value) || BANGLADESH_LOCATIONS[0];
                setDivision(d.name);
                setDistrict(d.districts[0].name);
                setUpazila(d.districts[0].upazilas[0]);
              }}
              className="rounded-lg border border-slate-300 px-2 py-2 text-xs bg-white"
            >
              {BANGLADESH_LOCATIONS.map((d) => <option key={d.name} value={d.name}>{d.bnName}</option>)}
            </select>
            <select
              value={district}
              onChange={(e) => {
                const dt = divObj.districts.find((x) => x.name === e.target.value) || divObj.districts[0];
                setDistrict(dt.name);
                setUpazila(dt.upazilas[0]);
              }}
              className="rounded-lg border border-slate-300 px-2 py-2 text-xs bg-white"
            >
              {divObj.districts.map((d) => <option key={d.name} value={d.name}>{d.bnName}</option>)}
            </select>
            <select
              value={upazila}
              onChange={(e) => setUpazila(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-2 text-xs bg-white"
            >
              {distObj.upazilas.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <input
              type="text"
              value={unionWard}
              onChange={(e) => setUnionWard(e.target.value)}
              placeholder="ইউনিয়ন/ওয়ার্ড"
              className="rounded-lg border border-slate-300 px-2 py-2 text-xs"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={twoFactorEnabled}
              onChange={(e) => setTwoFactorEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            Two-Factor Authentication (2FA) সক্রিয় রাখুন
          </label>
          <div>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">
              পরিবর্তন সংরক্ষণ করুন
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
