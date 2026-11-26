import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Check,
  Code2,
  Coins,
  Eye,
  EyeOff,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Lock,
  LogOut,
  Megaphone,
  Power,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  Upload,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { processGalleryImageFile } from '../lib/image-upload.ts';
import type { Advertisement, NewsPost, UserProfile } from '../types.ts';

interface AdminOverviewResponse {
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalCreators: number;
    verifiedUsers: number;
    totalPosts: number;
    pendingPosts: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalRevenue: number;
    creatorRevenue: number;
    platformRevenue: number;
    totalPayments: number;
    pendingPayments: number;
    suspiciousViewsCount: number;
  };
  users: UserProfile[];
  posts: (NewsPost & { authorName: string; authorUsername: string })[];
  reports: { id: number; targetType: string; targetId: number; reason: string; details: string | null; status: string; createdAt: string }[];
  withdrawals: {
    id: number;
    creatorId: number;
    creatorName: string;
    creatorUsername: string;
    paymentMethod: string;
    accountName: string;
    accountNumber: string;
    amountBdt: string;
    status: string;
    transactionRef: string | null;
  }[];
  advertisements: Advertisement[];
  verifications: {
    id: number;
    userName: string;
    userUsername: string;
    verificationType: string;
    nidOrPressId: string;
    organizationName: string | null;
    status: string;
  }[];
  copyrightClaims: {
    id: number;
    postId: number;
    claimantName: string;
    originalSourceUrl: string;
    description: string;
    status: string;
  }[];
  suspiciousViews: {
    id: number;
    postId: number;
    viewerIpHash: string;
    fraudReason: string | null;
    createdAt: string;
  }[];
  auditLogs: {
    id: number;
    actorEmail: string | null;
    actorRole: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    createdAt: string;
  }[];
  settings: Record<string, unknown>;
}

interface AdminDashboardViewProps {
  onSettingsUpdated?: () => void;
  onOpenProfile?: (username: string) => void;
}

const ADMIN_ROLES = ['super_admin', 'admin', 'news_editor', 'moderator', 'finance_manager', 'support_manager'];

const BRAND_COLOR_OPTIONS = [
  { hex: '#b91c1c', label: 'ক্রিমসন রেড', swatchClass: 'bg-red-700' },
  { hex: '#0f172a', label: 'এডিটোরিয়াল স্লেট', swatchClass: 'bg-slate-900' },
  { hex: '#047857', label: 'সবুজ বাংলা', swatchClass: 'bg-emerald-700' },
  { hex: '#1d4ed8', label: 'রয়েল ব্লু', swatchClass: 'bg-blue-700' },
  { hex: '#9a3412', label: 'টেরাকোটা', swatchClass: 'bg-orange-800' },
  { hex: '#6d28d9', label: 'ডিপ ভায়োলেট', swatchClass: 'bg-violet-700' },
];

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onSettingsUpdated,
  onOpenProfile,
}) => {
  const { apiFetch, user, setSessionAuth, logout } = useAuth();
  const isAdminUser = Boolean(user && ADMIN_ROLES.includes(user.role));

  // Admin Passcode Gate State
  const [gateStatus, setGateStatus] = useState<{ envConfigured: boolean; claimed: boolean } | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [confirmPasscodeInput, setConfirmPasscodeInput] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);

  // Dashboard Data State
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [section, setSection] = useState<
    'analytics' | 'users' | 'posts' | 'reports' | 'ads' | 'adsense' | 'payments' | 'fraud' | 'settings'
  >('analytics');

  // Creator Monitoring Search & Inspector
  const [creatorSearch, setCreatorSearch] = useState('');
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'creators' | 'monetized' | 'suspended'>('all');
  const [inspectedUserId, setInspectedUserId] = useState<number | null>(null);
  const [inspectFullName, setInspectFullName] = useState('');
  const [inspectBio, setInspectBio] = useState('');
  const [inspectLevel, setInspectLevel] = useState('1');
  const [inspectStrikes, setInspectStrikes] = useState('0');
  const [inspectViolations, setInspectViolations] = useState('0');
  const [creditAmount, setCreditAmount] = useState('500');
  const [creditNote, setCreditNote] = useState('Admin Revenue Bonus');
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<number | null>(null);

  // Ad creation state
  const [adTitle, setAdTitle] = useState('');
  const [advertiserName, setAdvertiserName] = useState('');
  const [adType, setAdType] = useState('native');
  const [adPlacement, setAdPlacement] = useState('feed');
  const [adCategory, setAdCategory] = useState('All');
  const [adDistrict, setAdDistrict] = useState('All');
  const [adDestUrl, setAdDestUrl] = useState('https://example.com');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [adBudget, setAdBudget] = useState('10000');

  // Payment Transaction Ref input per withdrawal
  const [txRefs, setTxRefs] = useState<Record<number, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});

  // Settings, AdSense & Passcode Change state
  const [settingsDraft, setSettingsDraft] = useState<Record<string, string>>({});
  const [newAdminPasscode, setNewAdminPasscode] = useState('');
  const [adsenseRawCode, setAdsenseRawCode] = useState('');
  const [adsenseTargetSlot, setAdsenseTargetSlot] = useState<'auto_detect' | 'header' | 'feed' | 'sidebar' | 'article' | 'multiplex' | 'footer'>('auto_detect');

  const fetchGateStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/admin-gate/status');
      if (res.ok) {
        const json = (await res.json()) as { envConfigured: boolean; claimed: boolean };
        setGateStatus(json);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadOverview = useCallback(async () => {
    if (!isAdminUser) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetch<AdminOverviewResponse>('/api/admin/overview');
      setData(res);
      const sMap: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.settings)) {
        sMap[k] = String(v ?? '');
      }
      setSettingsDraft(sMap);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'অ্যাডমিন প্যানেল লোড করা যায়নি');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, isAdminUser]);

  useEffect(() => {
    fetchGateStatus();
  }, [fetchGateStatus]);

  useEffect(() => {
    if (isAdminUser) {
      loadOverview();
    }
  }, [isAdminUser, loadOverview]);

  const handleClaimPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);
    if (passcodeInput.trim().length < 8) {
      setGateError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
      return;
    }
    if (passcodeInput !== confirmPasscodeInput) {
      setGateError('দুটি পাসওয়ার্ড মেলেনি।');
      return;
    }
    setGateLoading(true);
    try {
      const res = await fetch('/api/auth/admin-gate/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcodeInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'অ্যাডমিন পাসওয়ার্ড সেট করা যায়নি');
      setPasscodeInput('');
      setConfirmPasscodeInput('');
      setSessionAuth(json.token, json.user as UserProfile);
      await fetchGateStatus();
    } catch (e: unknown) {
      setGateError(e instanceof Error ? e.message : 'সেটআপ ব্যর্থ হয়েছে');
    } finally {
      setGateLoading(false);
    }
  };

  const handleUnlockPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);
    setGateLoading(true);
    try {
      const res = await fetch('/api/auth/admin-gate/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcodeInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'পাসওয়ার্ড সঠিক নয়');
      setPasscodeInput('');
      setSessionAuth(json.token, json.user as UserProfile);
    } catch (e: unknown) {
      setGateError(e instanceof Error ? e.message : 'আনলক ব্যর্থ হয়েছে');
    } finally {
      setGateLoading(false);
    }
  };

  const handleChangeAdminPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/admin-gate/change-passcode', {
        method: 'POST',
        body: JSON.stringify({ newPasscode: newAdminPasscode }),
      });
      setNewAdminPasscode('');
      setMsg(res.message || 'অ্যাডমিন পাসওয়ার্ড আপডেট হয়েছে।');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে');
    }
  };

  const moderatePost = async (postId: number, payload: Record<string, unknown>) => {
    setMsg(null);
    setErr(null);
    try {
      await apiFetch(`/api/admin/posts/${postId}/moderate`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setMsg('সংবাদ মডারেশন আপডেট হয়েছে।');
      await loadOverview();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'অ্যাকশন ব্যর্থ হয়েছে');
    }
  };

  const deletePost = async (postId: number) => {
    setMsg(null);
    setErr(null);
    try {
      await apiFetch(`/api/admin/posts/${postId}`, { method: 'DELETE' });
      setConfirmDeletePostId(null);
      setMsg('সংবাদটি স্থায়ীভাবে মুছে ফেলা হয়েছে।');
      await loadOverview();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'মুছে ফেলা যায়নি');
    }
  };

  const updateUser = async (userId: number, payload: Record<string, unknown>) => {
    setMsg(null);
    setErr(null);
    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setMsg('ক্রিয়েটর / ব্যবহারকারীর তথ্য আপডেট হয়েছে।');
      await loadOverview();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'আপডেট ব্যর্থ হয়েছে');
    }
  };

  const handleCreditCreator = async (creatorId: number) => {
    setMsg(null);
    setErr(null);
    try {
      await apiFetch('/api/admin/ledger/credit', {
        method: 'POST',
        body: JSON.stringify({
          creatorId,
          grossAmountBdt: Number(creditAmount),
          note: creditNote,
        }),
      });
      setMsg('ক্রিয়েটরের লেজারে রেভিনিউ যুক্ত হয়েছে।');
      await loadOverview();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'ক্রেডিট করা যায়নি');
    }
  };

  const processWithdrawal = async (wId: number, status: string) => {
    setMsg(null);
    setErr(null);
    try {
      await apiFetch(`/api/admin/withdrawals/${wId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, transactionRef: txRefs[wId] || undefined }),
      });
      setMsg(`পেমেন্ট স্ট্যাটাস (${status}) আপডেট হয়েছে।`);
      await loadOverview();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'পেমেন্ট প্রসেস ব্যর্থ হয়েছে');
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      await apiFetch('/api/admin/ads', {
        method: 'POST',
        body: JSON.stringify({
          title: adTitle,
          advertiserName,
          adType,
          placement: adPlacement,
          targetCategory: adCategory,
          targetDistrict: adDistrict,
          imageUrl: adImageUrl || undefined,
          destinationUrl: adDestUrl,
          budgetBdt: Number(adBudget),
        }),
      });
      setAdTitle('');
      setAdvertiserName('');
      setAdImageUrl('');
      setMsg('নতুন বিজ্ঞাপন ক্যাম্পেইন চালু হয়েছে।');
      await loadOverview();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'বিজ্ঞাপন তৈরি ব্যর্থ হয়েছে');
    }
  };

  const buildSettingsPayload = (draft: Record<string, string>): Record<string, unknown> => ({
    ...draft,
    min_followers_monetization: Number(draft.min_followers_monetization || 1000),
    min_views_monetization: Number(draft.min_views_monetization || 10000),
    min_withdrawal_bdt: Number(draft.min_withdrawal_bdt || 500),
    creator_revenue_share_pct: Number(draft.creator_revenue_share_pct || 60),
    breaking_ticker_enabled: draft.breaking_ticker_enabled !== 'false',
    ads_enabled: draft.ads_enabled !== 'false',
    comments_enabled: draft.comments_enabled !== 'false',
    registration_enabled: draft.registration_enabled !== 'false',
    creator_monetization_enabled: draft.creator_monetization_enabled !== 'false',
    adsense_enabled: draft.adsense_enabled === 'true',
    adsense_auto_ads_enabled: draft.adsense_auto_ads_enabled !== 'false',
    adsense_header_enabled: draft.adsense_header_enabled !== 'false',
    adsense_feed_enabled: draft.adsense_feed_enabled !== 'false',
    adsense_sidebar_enabled: draft.adsense_sidebar_enabled !== 'false',
    adsense_article_enabled: draft.adsense_article_enabled !== 'false',
    adsense_multiplex_enabled: draft.adsense_multiplex_enabled !== 'false',
    adsense_footer_enabled: draft.adsense_footer_enabled !== 'false',
  });

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: buildSettingsPayload(settingsDraft) }),
      });
      setMsg('ওয়েবসাইট কাস্টমাইজেশন, AdSense ও প্ল্যাটফর্ম সেটিংস সংরক্ষিত হয়েছে।');
      await loadOverview();
      onSettingsUpdated?.();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'সেটিংস সেভ ব্যর্থ হয়েছে');
    }
  };

  const handleQuickSettingToggle = async (key: string, nextBool: boolean, successLabel: string) => {
    setMsg(null);
    setErr(null);
    const nextDraft = { ...settingsDraft, [key]: nextBool ? 'true' : 'false' };
    setSettingsDraft(nextDraft);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: { [key]: nextBool } }),
      });
      setMsg(successLabel);
      await loadOverview();
      onSettingsUpdated?.();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'সেটিংস পরিবর্তন ব্যর্থ হয়েছে');
    }
  };

  const handleParseAdSenseSnippet = () => {
    setErr(null);
    setMsg(null);
    const snippet = adsenseRawCode.trim();
    if (!snippet) {
      setErr('প্রথমে Google AdSense থেকে পাওয়া কোড এখানে পেস্ট করুন।');
      return;
    }

    const pubMatch = snippet.match(/ca-pub-\d{10,20}|pub-\d{10,20}/i);
    const slotMatch = snippet.match(/data-ad-slot=["']?(\d{6,20})["']?/i);
    const formatMatch = snippet.match(/data-ad-format=["']?([a-zA-Z-]+)["']?/i);
    const layoutMatch = snippet.match(/data-ad-layout=["']?([a-zA-Z-]+)["']?/i);

    if (!pubMatch && !slotMatch) {
      setErr('কোডের ভেতর সঠিক Google AdSense Publisher ID (ca-pub-...) বা data-ad-slot পাওয়া যায়নি।');
      return;
    }

    const updates: Record<string, string> = {};
    if (pubMatch) {
      const normalizedPub = pubMatch[0].toLowerCase().startsWith('pub-')
        ? `ca-${pubMatch[0].toLowerCase()}`
        : pubMatch[0].toLowerCase();
      updates.adsense_publisher_id = normalizedPub;
      updates.adsense_enabled = 'true';
    }

    if (slotMatch) {
      const detectedFormat =
        layoutMatch?.[1]?.toLowerCase() === 'in-article'
          ? 'in-article'
          : formatMatch?.[1]?.toLowerCase() || 'auto';

      let target: 'header' | 'feed' | 'sidebar' | 'article' | 'multiplex' | 'footer' = 'feed';
      if (adsenseTargetSlot !== 'auto_detect') {
        target = adsenseTargetSlot;
      } else if (detectedFormat === 'in-article') {
        target = 'article';
      } else if (detectedFormat === 'autorelaxed') {
        target = 'multiplex';
      } else if (detectedFormat === 'fluid') {
        target = 'feed';
      } else {
        target = 'header';
      }

      updates[`adsense_${target}_slot`] = slotMatch[1];
      updates[`adsense_${target}_format`] = detectedFormat;
      updates[`adsense_${target}_enabled`] = 'true';
    }

    setSettingsDraft((prev) => ({ ...prev, ...updates }));
    setAdsenseRawCode('');
    setMsg('Google AdSense কোড থেকে Publisher ID ও Slot নিরাপদে যুক্ত হয়েছে — এখন "AdSense সেটিংস সংরক্ষণ করুন" বাটনে ক্লিক করুন।');
  };

  const handleLogoFileUpload = async (file: File | null) => {
    if (!file) return;
    setErr(null);
    setMsg(null);
    try {
      const uri = await processGalleryImageFile(file, {
        maxDimension: 512,
        quality: 0.88,
        maxOutputBytes: 450 * 1024,
      });
      setSettingsDraft((s) => ({ ...s, site_logo_url: uri }));
      setMsg('লোগো ছবি প্রিভিউতে যুক্ত হয়েছে — স্থায়ী করতে "সব কাস্টমাইজেশন ও সেটিংস সংরক্ষণ করুন" চাপুন।');
    } catch (uploadErr: unknown) {
      setErr(uploadErr instanceof Error ? uploadErr.message : 'লোগো আপলোড ব্যর্থ হয়েছে');
    }
  };

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = creatorSearch.trim().toLowerCase();
    return data.users.filter((u) => {
      if (creatorFilter === 'creators' && u.role !== 'creator' && u.totalPosts === 0) return false;
      if (creatorFilter === 'monetized' && u.monetizationStatus !== 'monetized') return false;
      if (creatorFilter === 'suspended' && u.accountStatus === 'active') return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q) ||
        (u.district || '').toLowerCase().includes(q)
      );
    });
  }, [data, creatorSearch, creatorFilter]);

  const inspectedUser = useMemo(
    () => (data && inspectedUserId ? data.users.find((u) => u.id === inspectedUserId) || null : null),
    [data, inspectedUserId]
  );

  useEffect(() => {
    if (!inspectedUser) return;
    setInspectFullName(inspectedUser.fullName);
    setInspectBio(inspectedUser.bio || '');
    setInspectLevel(String(inspectedUser.creatorLevel || 1));
    setInspectStrikes(String(inspectedUser.copyrightStrikes || 0));
    setInspectViolations(String(inspectedUser.guidelineViolations || 0));
  }, [inspectedUser]);

  const inspectedUserPosts = useMemo(
    () => (data && inspectedUser ? data.posts.filter((p) => p.authorId === inspectedUser.id) : []),
    [data, inspectedUser]
  );

  const inspectedUserWithdrawals = useMemo(
    () => (data && inspectedUser ? data.withdrawals.filter((w) => w.creatorId === inspectedUser.id) : []),
    [data, inspectedUser]
  );

  // Admin Passcode Gate View (when user is not yet logged in with an admin role)
  if (!isAdminUser) {
    const needsFirstRunClaim = gateStatus && !gateStatus.envConfigured && !gateStatus.claimed;
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-900 text-white p-6 space-y-2">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Lock className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold">
              {needsFirstRunClaim ? 'প্রথমবার অ্যাডমিন পাসওয়ার্ড সেটআপ' : 'অ্যাডমিন প্যানেল লগইন'}
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              {needsFirstRunClaim
                ? 'কন্টেন্ট ক্রিয়েটরদের পর্যবেক্ষণ এবং সম্পূর্ণ ওয়েবসাইট কাস্টমাইজেশন সুরক্ষিত রাখতে আপনার অ্যাডমিন পাসওয়ার্ড সেট করুন।'
                : 'অ্যাডমিন কন্ট্রোল প্যানেলে প্রবেশ করতে নির্ধারিত অ্যাডমিন পাসওয়ার্ড দিন।'}
            </p>
          </div>

          <div className="p-6 space-y-4">
            {gateError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                {gateError}
              </div>
            )}

            <form onSubmit={needsFirstRunClaim ? handleClaimPasscode : handleUnlockPasscode} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {needsFirstRunClaim ? 'নতুন অ্যাডমিন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)' : 'অ্যাডমিন প্যানেল পাসওয়ার্ড'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    required
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-10 py-2 text-sm focus:outline-none focus:border-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 p-0.5"
                    aria-label="Toggle passcode visibility"
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {needsFirstRunClaim && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">পাসওয়ার্ড পুনরায় লিখুন</label>
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    required
                    value={confirmPasscodeInput}
                    onChange={(e) => setConfirmPasscodeInput(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={gateLoading}
                className="w-full py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60"
              >
                {gateLoading
                  ? 'যাচাই হচ্ছে...'
                  : needsFirstRunClaim
                  ? 'পাসওয়ার্ড সেট করুন ও প্রবেশ করুন'
                  : 'অ্যাডমিন প্যানেল আনলক করুন'}
              </button>
            </form>

            {user && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">
                  সাইন-ইন: <span className="font-semibold text-slate-800">@{user.username}</span> ({user.role})
                </p>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 shrink-0"
                >
                  <LogOut className="w-3 h-3" />
                  লগআউট
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading && !data) return <div className="bg-white rounded-xl border border-slate-200 p-8 animate-pulse h-96" />;
  if (err && !data) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-8 text-center space-y-2">
        <ShieldAlert className="w-8 h-8 text-red-700 mx-auto" />
        <p className="text-sm font-semibold text-red-800">{err}</p>
        <p className="text-xs text-slate-500">আপনার বর্তমান রোল: {user?.role || 'guest'}</p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">অ্যাডমিন ও মডারেশন কন্ট্রোল প্যানেল</h1>
          <p className="text-xs text-slate-300 mt-0.5">
            রোল: <span className="font-semibold text-white uppercase">{user?.role}</span> · সব ক্রিয়েটর, মনিটাইজেশন, Google AdSense ও ওয়েবসাইট নিয়ন্ত্রণ সক্রিয়
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-tabular">
          <span>মোট ইউজার: {data.stats.totalUsers}</span>
          <span>·</span>
          <span>ক্রিয়েটর: {data.stats.totalCreators}</span>
          <span>·</span>
          <span>পেন্ডিং সংবাদ: {data.stats.pendingPosts}</span>
          <button
            type="button"
            onClick={logout}
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            লগআউট
          </button>
        </div>
      </div>

      {/* Admin Sub-Nav */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg overflow-x-auto">
        {[
          { id: 'analytics', label: 'অ্যানালিটিক্স', icon: BarChart3 },
          { id: 'users', label: `ক্রিয়েটর ও মনিটাইজেশন (${data.users.length})`, icon: Users },
          { id: 'posts', label: `নিউজ মডারেশন (${data.posts.length})`, icon: Check },
          { id: 'reports', label: `রিপোর্ট ও ব্যাজ`, icon: AlertTriangle },
          { id: 'adsense', label: 'Google AdSense ও আয়', icon: Code2 },
          { id: 'ads', label: `ক্যাম্পেইন বিজ্ঞাপন (${data.advertisements.length})`, icon: Megaphone },
          { id: 'payments', label: `পেমেন্ট (${data.withdrawals.length})`, icon: Wallet },
          { id: 'fraud', label: `অ্যান্টি-ফ্রড ও অডিট`, icon: ShieldAlert },
          { id: 'settings', label: 'লোগো ও সাইট কাস্টমাইজেশন', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id as typeof section)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                section === item.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{err}</div>}
      {msg && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{msg}</div>}

      {section === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">মোট ব্যবহারকারী / ক্রিয়েটর</div>
              <div className="text-2xl font-bold font-tabular mt-1">{data.stats.totalUsers} / {data.stats.totalCreators}</div>
              <div className="text-[11px] text-slate-500">সক্রিয়: {data.stats.activeUsers} · ভেরিফায়েড: {data.stats.verifiedUsers}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">মোট সংবাদ ও ভিউ</div>
              <div className="text-2xl font-bold font-tabular mt-1">{data.stats.totalViews.toLocaleString()}</div>
              <div className="text-[11px] text-slate-500">{data.stats.totalPosts} সংবাদ · {data.stats.totalLikes.toLocaleString()} লাইক</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">মোট প্ল্যাটফর্ম রেভিনিউ</div>
              <div className="text-2xl font-bold text-slate-900 font-tabular mt-1">৳{data.stats.totalRevenue.toLocaleString()}</div>
              <div className="text-[11px] text-slate-500">ক্রিয়েটর: ৳{data.stats.creatorRevenue} · প্ল্যাটফর্ম: ৳{data.stats.platformRevenue}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">পেমেন্ট ও বকেয়া</div>
              <div className="text-2xl font-bold text-emerald-700 font-tabular mt-1">৳{data.stats.totalPayments.toLocaleString()}</div>
              <div className="text-[11px] text-amber-700">পেন্ডিং উত্তোলন: ৳{data.stats.pendingPayments.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-900 mb-4">রেভিনিউ শেয়ার ও এনগেজমেন্ট বিভাজন</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-slate-500">ক্রিয়েটর শেয়ার</div>
                <div className="text-lg font-bold font-tabular mt-1 text-emerald-700">৳{data.stats.creatorRevenue.toLocaleString()}</div>
                <div className="h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-emerald-600 w-[60%]" />
                </div>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-slate-500">প্ল্যাটফর্ম শেয়ার</div>
                <div className="text-lg font-bold font-tabular mt-1 text-slate-900">৳{data.stats.platformRevenue.toLocaleString()}</div>
                <div className="h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-slate-800 w-[40%]" />
                </div>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-slate-500">মন্তব্য ও শেয়ার</div>
                <div className="text-lg font-bold font-tabular mt-1">{data.stats.totalComments} মন্তব্য · {data.stats.totalShares} শেয়ার</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'users' && (
        <div className="space-y-4">
          {/* Global Creator Monetization Control Banner */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-700" />
                প্ল্যাটফর্মব্যাপী ক্রিয়েটর মনিটাইজেশন নিয়ন্ত্রণ
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                এখান থেকে পুরো প্ল্যাটফর্মের ক্রিয়েটর মনিটাইজেশন এবং নিচের টেবিল থেকে যেকোনো প্রোফাইলের মনিটাইজেশন আলাদাভাবে চালু বা বন্ধ করুন।
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleQuickSettingToggle(
                  'creator_monetization_enabled',
                  settingsDraft.creator_monetization_enabled === 'false',
                  settingsDraft.creator_monetization_enabled === 'false'
                    ? 'গ্লোবাল ক্রিয়েটর মনিটাইজেশন চালু করা হয়েছে।'
                    : 'গ্লোবাল ক্রিয়েটর মনিটাইজেশন বন্ধ করা হয়েছে।'
                )
              }
              className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                settingsDraft.creator_monetization_enabled !== 'false'
                  ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                  : 'bg-red-700 text-white hover:bg-red-800'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {settingsDraft.creator_monetization_enabled !== 'false'
                ? 'ক্রিয়েটর মনিটাইজেশন: চালু (ON)'
                : 'ক্রিয়েটর মনিটাইজেশন: বন্ধ (OFF)'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={creatorSearch}
                onChange={(e) => setCreatorSearch(e.target.value)}
                placeholder="নাম, ইউজারনেম, ইমেইল, ফোন বা জেলা দিয়ে ক্রিয়েটর খুঁজুন..."
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-slate-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={creatorFilter}
                onChange={(e) => setCreatorFilter(e.target.value as typeof creatorFilter)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
              >
                <option value="all">সকল অ্যাকাউন্ট ({data.users.length})</option>
                <option value="creators">শুধু কন্টেন্ট ক্রিয়েটর</option>
                <option value="monetized">মনিটাইজড ক্রিয়েটর</option>
                <option value="suspended">সাসপেন্ডেড / ব্যানড</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3">ক্রিয়েটর / ব্যবহারকারী</th>
                  <th className="px-4 py-3">এলাকা</th>
                  <th className="px-4 py-3">পারফরম্যান্স (ফলোয়ার · ভিউ · পোস্ট)</th>
                  <th className="px-4 py-3">আয় ও ব্যালেন্স</th>
                  <th className="px-4 py-3">রোল ও প্রোফাইল মনিটাইজেশন</th>
                  <th className="px-4 py-3">অবস্থা ও পর্যবেক্ষণ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const userPostsCount = data.posts.filter((p) => p.authorId === u.id).length;
                  const isMonetized = u.monetizationStatus === 'monetized';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 flex items-center gap-1">
                          {u.fullName}
                          {u.verificationType !== 'none' && <BadgeCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                        </div>
                        <div className="text-slate-500">@{u.username} · {u.email}</div>
                        {u.phone && <div className="text-[11px] text-slate-400 font-tabular">{u.phone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div>{u.upazila}, {u.district}</div>
                        {u.unionWard && <div className="text-[11px] text-slate-400">{u.unionWard}</div>}
                      </td>
                      <td className="px-4 py-3 font-tabular">
                        <div>{u.totalFollowers.toLocaleString()} ফলোয়ার · {u.validViews.toLocaleString()} ভিউ</div>
                        <div className="text-[11px] text-slate-500">
                          পোস্ট: {userPostsCount} · স্ট্রাইক: {u.copyrightStrikes}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-tabular">
                        <div className="font-semibold text-emerald-700">
                          ৳{(u.approvedEarningsBdt ?? 0).toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          উত্তোলনযোগ্য: ৳{(u.withdrawableBalanceBdt ?? 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 space-y-1.5">
                        <select
                          value={u.role}
                          onChange={(e) => updateUser(u.id, { role: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                        >
                          {['user', 'creator', 'support_manager', 'finance_manager', 'moderator', 'news_editor', 'admin', 'super_admin'].map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1">
                          <select
                            value={u.monetizationStatus}
                            onChange={(e) => updateUser(u.id, { monetizationStatus: e.target.value })}
                            className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                          >
                            {['not_eligible', 'eligible', 'under_review', 'monetized', 'suspended', 'disabled'].map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => updateUser(u.id, { monetizationStatus: isMonetized ? 'disabled' : 'monetized' })}
                            className={`px-2 py-1 rounded text-[11px] font-semibold whitespace-nowrap ${
                              isMonetized
                                ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                                : 'bg-emerald-700 text-white hover:bg-emerald-800'
                            }`}
                          >
                            {isMonetized ? 'বন্ধ করুন' : 'চালু করুন'}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={u.accountStatus}
                            onChange={(e) => updateUser(u.id, { accountStatus: e.target.value })}
                            className="rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                          >
                            <option value="active">active</option>
                            <option value="suspended">suspended</option>
                            <option value="banned">banned</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => updateUser(u.id, { isFeaturedCreator: !u.isFeaturedCreator })}
                            className={`px-2 py-1 rounded border text-[11px] whitespace-nowrap ${
                              u.isFeaturedCreator ? 'bg-amber-100 border-amber-300 text-amber-900' : 'border-slate-300 text-slate-700'
                            }`}
                          >
                            {u.isFeaturedCreator ? 'Featured ✓' : 'Feature'}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectedUserId(u.id)}
                          className="w-full px-2.5 py-1.5 rounded bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800 inline-flex items-center justify-center gap-1"
                        >
                          <UserCheck className="w-3 h-3" />
                          বিস্তারিত পর্যবেক্ষণ ও নিয়ন্ত্রণ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === 'posts' && (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {data.posts.map((p) => (
            <div key={p.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  <span className="font-semibold text-slate-800">{p.status}</span>
                  <span>·</span>
                  <span>{p.authorName} (@{p.authorUsername})</span>
                  <span>·</span>
                  <span>{p.district}</span>
                  <span>·</span>
                  <span className="font-tabular">ভিউ: {p.validViewsCount.toLocaleString()} · রিপোর্ট: {p.reportsCount}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{p.title}</h3>
                {p.featuredImage && (
                  <p className="text-[11px] text-slate-500 truncate">Media: {p.featuredImage} · Source: {p.sourceReference || 'N/A'}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moderatePost(p.id, { status: 'published' })}
                  className="px-2.5 py-1.5 rounded-md bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => moderatePost(p.id, { isBreaking: !p.isBreaking })}
                  className={`px-2.5 py-1.5 rounded-md border text-xs font-medium ${
                    p.isBreaking ? 'bg-red-700 text-white border-red-700' : 'border-slate-300 text-slate-700'
                  }`}
                >
                  {p.isBreaking ? 'Breaking ✓' : 'Breaking'}
                </button>
                <button
                  type="button"
                  onClick={() => moderatePost(p.id, { status: 'hidden' })}
                  className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hide
                </button>
                <input
                  type="text"
                  value={rejectReasons[p.id] || ''}
                  onChange={(e) => setRejectReasons((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder="রিজেক্ট কারণ..."
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs w-32"
                />
                <button
                  type="button"
                  onClick={() => moderatePost(p.id, { status: 'rejected', rejectionReason: rejectReasons[p.id] || 'Policy review' })}
                  className="px-2.5 py-1.5 rounded-md bg-amber-700 text-white text-xs font-medium"
                >
                  Reject
                </button>
                {confirmDeletePostId === p.id ? (
                  <button
                    type="button"
                    onClick={() => deletePost(p.id)}
                    className="px-2.5 py-1.5 rounded-md bg-red-700 text-white text-xs font-semibold"
                  >
                    নিশ্চিত মুছুন
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeletePostId(p.id)}
                    className="p-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50"
                    title="সংবাদ মুছে ফেলুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {section === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">রিপোর্ট কিউ ({data.reports.length})</h2>
            {data.reports.map((r) => (
              <div key={r.id} className="p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="font-semibold text-red-700">{r.reason} · {r.targetType} #{r.targetId}</div>
                {r.details && <p className="text-slate-600">{r.details}</p>}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500">Status: {r.status}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'action_taken' }) });
                        await loadOverview();
                      }}
                      className="px-2 py-1 rounded bg-slate-900 text-white"
                    >
                      Action Taken
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'dismissed' }) });
                        await loadOverview();
                      }}
                      className="px-2 py-1 rounded border border-slate-300"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">কপিরাইট অভিযোগ ({data.copyrightClaims.length})</h2>
            {data.copyrightClaims.map((c) => (
              <div key={c.id} className="p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="font-semibold">{c.claimantName} · Post #{c.postId}</div>
                <p className="text-slate-600">{c.description}</p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/copyright/${c.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'upheld', adminAction: 'suspend_monetization' }),
                      });
                      await loadOverview();
                    }}
                    className="px-2 py-1 rounded bg-red-700 text-white"
                  >
                    Strike + Hide
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/copyright/${c.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'dismissed' }),
                      });
                      await loadOverview();
                    }}
                    className="px-2 py-1 rounded border border-slate-300"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">ভেরিফিকেশন আবেদন ({data.verifications.length})</h2>
            {data.verifications.map((v) => (
              <div key={v.id} className="p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="font-semibold">{v.userName} (@{v.userUsername})</div>
                <div className="text-slate-600">{v.verificationType} · ID: {v.nidOrPressId}</div>
                <div className="flex items-center justify-between pt-1">
                  <span>{v.status}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/verifications/${v.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: 'approved' }),
                        });
                        await loadOverview();
                      }}
                      className="px-2 py-1 rounded bg-emerald-700 text-white"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/verifications/${v.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: 'rejected' }),
                        });
                        await loadOverview();
                      }}
                      className="px-2 py-1 rounded border border-slate-300"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'ads' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleCreateAd} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">নতুন বিজ্ঞাপন যোগ করুন</h2>
            <input
              type="text"
              required
              value={adTitle}
              onChange={(e) => setAdTitle(e.target.value)}
              placeholder="বিজ্ঞাপনের শিরোনাম"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
            <input
              type="text"
              required
              value={advertiserName}
              onChange={(e) => setAdvertiserName(e.target.value)}
              placeholder="বিজ্ঞাপনদাতা প্রতিষ্ঠানের নাম"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <select value={adType} onChange={(e) => setAdType(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs bg-white">
                <option value="banner">Banner Ad</option>
                <option value="native">Native Ad</option>
                <option value="feed">Feed Ad</option>
                <option value="article">Article Ad</option>
                <option value="video">Video Ad</option>
                <option value="sidebar">Sidebar Ad</option>
                <option value="sponsored_news">Sponsored News</option>
                <option value="featured_post">Featured Post</option>
              </select>
              <select value={adPlacement} onChange={(e) => setAdPlacement(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs bg-white">
                <option value="feed">Feed</option>
                <option value="sidebar">Sidebar</option>
                <option value="article">Article</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={adCategory} onChange={(e) => setAdCategory(e.target.value)} placeholder="Category (All)" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
              <input type="text" value={adDistrict} onChange={(e) => setAdDistrict(e.target.value)} placeholder="District (All)" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
            </div>
            <input type="url" required value={adDestUrl} onChange={(e) => setAdDestUrl(e.target.value)} placeholder="Destination URL" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-700">বিজ্ঞাপনের ছবি (ঐচ্ছিক)</span>
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
                        const uri = await processGalleryImageFile(file, { maxDimension: 1024, quality: 0.82 });
                        setAdImageUrl(uri);
                      } catch (uploadErr: unknown) {
                        setErr(uploadErr instanceof Error ? uploadErr.message : 'বিজ্ঞাপনের ছবি আপলোড ব্যর্থ হয়েছে');
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              {adImageUrl && <img src={adImageUrl} alt="বিজ্ঞাপন প্রিভিউ" className="w-full h-24 object-cover rounded border border-slate-200" />}
              <input
                type="text"
                value={adImageUrl}
                onChange={(e) => setAdImageUrl(e.target.value)}
                placeholder="অথবা ছবির URL দিন..."
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              />
            </div>
            <input type="number" required value={adBudget} onChange={(e) => setAdBudget(e.target.value)} placeholder="Budget (BDT)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-tabular" />
            <button type="submit" className="w-full py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold">ক্যাম্পেইন চালু করুন</button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">সক্রিয় ও পূর্ববর্তী বিজ্ঞাপন</h2>
            <div className="divide-y divide-slate-100">
              {data.advertisements.map((ad) => (
                <div key={ad.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{ad.title}</div>
                    <div className="text-slate-500">
                      {ad.advertiserName} · {ad.adType} ({ad.placement}) · জেলা: {ad.targetDistrict} · বাজেট: ৳{ad.budgetBdt}
                    </div>
                    <div className="text-slate-500 font-tabular mt-0.5">
                      ইম্প্রেশন: {ad.impressionsCount.toLocaleString()} · ক্লিক: {ad.clicksCount.toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/ads/${ad.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: ad.status === 'active' ? 'paused' : 'active' }),
                      });
                      await loadOverview();
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium border ${
                      ad.status === 'active' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    {ad.status === 'active' ? 'Active' : 'Paused'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'payments' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">ক্রিয়েটর পেমেন্ট ও উত্তোলন পরিচালনা</h2>
          <div className="divide-y divide-slate-100">
            {data.withdrawals.map((w) => (
              <div key={w.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900">
                    {w.creatorName} (@{w.creatorUsername}) — <span className="font-tabular">৳{w.amountBdt}</span>
                  </div>
                  <div className="text-slate-500">
                    {w.paymentMethod.toUpperCase()} · {w.accountName} · {w.accountNumber} · Status: <strong>{w.status}</strong>
                  </div>
                  {w.transactionRef && <div className="text-emerald-700 font-tabular">Transaction ID: {w.transactionRef}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={txRefs[w.id] || ''}
                    onChange={(e) => setTxRefs((prev) => ({ ...prev, [w.id]: e.target.value }))}
                    placeholder="Transaction Ref ID"
                    className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-tabular"
                  />
                  <button
                    type="button"
                    onClick={() => processWithdrawal(w.id, 'paid')}
                    className="px-3 py-1.5 rounded bg-emerald-700 text-white font-semibold"
                  >
                    Mark Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => processWithdrawal(w.id, 'rejected')}
                    className="px-3 py-1.5 rounded border border-red-300 text-red-700 font-semibold inline-flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'fraud' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">অ্যান্টি-ফ্রড: সন্দেহজনক ট্রাফিক ও বট ভিউ</h2>
            {data.suspiciousViews.length === 0 ? (
              <p className="text-xs text-slate-500">বর্তমানে কোনো সন্দেহজনক ট্রাফিক শনাক্ত হয়নি।</p>
            ) : (
              data.suspiciousViews.map((sv) => (
                <div key={sv.id} className="p-2.5 rounded border border-amber-200 bg-amber-50 text-xs">
                  Post #{sv.postId} · IP Hash: <span className="font-tabular">{sv.viewerIpHash}</span> · {sv.fraudReason}
                </div>
              ))
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">নিরাপত্তা অডিট লগ (Audit Logs)</h2>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {data.auditLogs.map((log) => (
                <div key={log.id} className="py-2 text-xs">
                  <div className="font-semibold text-slate-900">{log.action} · {log.targetType} #{log.targetId}</div>
                  <div className="text-slate-500">{log.actorEmail} ({log.actorRole})</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'adsense' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Master Switches */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-700" />
                  Google AdSense ও ওয়েবসাইট মনিটাইজেশন কন্ট্রোল সেন্টার
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  এক ক্লিকে Google AdSense, Auto Ads এবং ক্রিয়েটর মনিটাইজেশন চালু বা বন্ধ করুন এবং যেকোনো অ্যাড স্লটের কোড বসান।
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleQuickSettingToggle(
                    'adsense_enabled',
                    settingsDraft.adsense_enabled !== 'true',
                    settingsDraft.adsense_enabled !== 'true'
                      ? 'Google AdSense চালু করা হয়েছে।'
                      : 'Google AdSense বন্ধ করা হয়েছে।'
                  )
                }
                className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                  settingsDraft.adsense_enabled === 'true'
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                    : 'bg-slate-800 text-white hover:bg-slate-900'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                {settingsDraft.adsense_enabled === 'true' ? 'AdSense: চালু (ON)' : 'AdSense: বন্ধ (OFF)'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {[
                { key: 'adsense_enabled', label: 'Google AdSense মাস্টার সুইচ', defaultFalse: true },
                { key: 'adsense_auto_ads_enabled', label: 'Google Auto Ads স্ক্রিপ্ট' },
                { key: 'ads_enabled', label: 'সাইটের সব বিজ্ঞাপন (All Ads)' },
                { key: 'creator_monetization_enabled', label: 'ক্রিয়েটর মনিটাইজেশন সিস্টেম' },
              ].map((item) => {
                const enabled = item.defaultFalse
                  ? settingsDraft[item.key] === 'true'
                  : settingsDraft[item.key] !== 'false';
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSettingsDraft((s) => ({ ...s, [item.key]: enabled ? 'false' : 'true' }))}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      enabled ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="font-semibold">{item.label}</div>
                    <div className="text-[11px] mt-0.5">{enabled ? 'সক্রিয় (ON)' : 'বন্ধ (OFF)'}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Google AdSense Publisher ID</label>
                <input
                  type="text"
                  value={settingsDraft.adsense_publisher_id || ''}
                  onChange={(e) => setSettingsDraft((s) => ({ ...s, adsense_publisher_id: e.target.value }))}
                  placeholder="ca-pub-1234567890123456"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-tabular"
                />
              </div>
              <div className="flex items-end">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  শুধু Publisher ID দিলেই নিরাপদভাবে অফিসিয়াল Google AdSense স্ক্রিপ্ট হেডারে যুক্ত হবে। সব ধরনের Ad Unit নিচের বক্সে পেস্ট বা সেট করতে পারবেন।
                </p>
              </div>
            </div>
          </div>

          {/* Smart Google AdSense Code Snippet Extractor */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Google AdSense কোড স্নিপেট পেস্ট করে স্বয়ংক্রিয়ভাবে সেট করুন</h3>
            <p className="text-slate-500">
              Google AdSense ড্যাশবোর্ড থেকে পাওয়া যেকোনো কোড (&lt;script&gt; বা &lt;ins class="adsbygoogle"...&gt;) এখানে পেস্ট করলে সিস্টেম নিরাপদভাবে আপনার Publisher ID ও Ad Slot বসিয়ে দেবে।
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={adsenseTargetSlot}
                onChange={(e) => setAdsenseTargetSlot(e.target.value as typeof adsenseTargetSlot)}
                className="rounded-lg border border-slate-300 px-3 py-2 bg-white"
              >
                <option value="auto_detect">স্বয়ংক্রিয় প্লেসমেন্ট নির্বাচন</option>
                <option value="header">Header Banner Ad</option>
                <option value="feed">In-Feed Ad (পোস্টের মাঝে)</option>
                <option value="sidebar">Sidebar Ad</option>
                <option value="article">In-Article Ad (সংবাদের ভেতরে)</option>
                <option value="multiplex">Multiplex / Matched Content</option>
                <option value="footer">Footer Banner Ad</option>
              </select>
              <button
                type="button"
                onClick={handleParseAdSenseSnippet}
                className="sm:col-span-2 px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
              >
                কোড বিশ্লেষণ করে সংশ্লিষ্ট AdSense স্লটে বসিয়ে নিন
              </button>
            </div>
            <textarea
              rows={4}
              value={adsenseRawCode}
              onChange={(e) => setAdsenseRawCode(e.target.value)}
              placeholder={'উদাহরণ: <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-..." crossorigin="anonymous"></script>\n<ins class="adsbygoogle" data-ad-client="ca-pub-..." data-ad-slot="1234567890" data-ad-format="auto"></ins>'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-[11px]"
            />
          </div>

          {/* All 6 AdSense Placement Units */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">সব ধরনের Google AdSense অ্যাড স্লট (Slot Configuration)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {[
                { key: 'header', title: '১. হেডার ব্যানার (Display Banner)', defaultFmt: 'horizontal' },
                { key: 'feed', title: '২. ইন-ফিড অ্যাড (In-Feed Native)', defaultFmt: 'fluid' },
                { key: 'sidebar', title: '৩. সাইডবার অ্যাড (Sidebar Rectangle)', defaultFmt: 'rectangle' },
                { key: 'article', title: '৪. ইন-আর্টিকেল অ্যাড (In-Article)', defaultFmt: 'in-article' },
                { key: 'multiplex', title: '৫. মাল্টিপ্লেক্স অ্যাড (Multiplex Grid)', defaultFmt: 'autorelaxed' },
                { key: 'footer', title: '৬. ফুটার ব্যানার (Footer Responsive)', defaultFmt: 'auto' },
              ].map((slot) => {
                const enabledKey = `adsense_${slot.key}_enabled`;
                const slotKey = `adsense_${slot.key}_slot`;
                const formatKey = `adsense_${slot.key}_format`;
                const isSlotEnabled = settingsDraft[enabledKey] !== 'false';

                return (
                  <div key={slot.key} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{slot.title}</span>
                      <button
                        type="button"
                        onClick={() => setSettingsDraft((s) => ({ ...s, [enabledKey]: isSlotEnabled ? 'false' : 'true' }))}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                          isSlotEnabled ? 'bg-emerald-700 text-white' : 'bg-slate-300 text-slate-700'
                        }`}
                      >
                        {isSlotEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">Ad Slot ID (সংখ্যা)</label>
                        <input
                          type="text"
                          value={settingsDraft[slotKey] || ''}
                          onChange={(e) => setSettingsDraft((s) => ({ ...s, [slotKey]: e.target.value }))}
                          placeholder="যেমন: 9876543210"
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-tabular"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">Ad Format</label>
                        <select
                          value={settingsDraft[formatKey] || slot.defaultFmt}
                          onChange={(e) => setSettingsDraft((s) => ({ ...s, [formatKey]: e.target.value }))}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
                        >
                          <option value="auto">auto (Responsive)</option>
                          <option value="horizontal">horizontal (Banner)</option>
                          <option value="rectangle">rectangle (Box)</option>
                          <option value="fluid">fluid (In-Feed)</option>
                          <option value="in-article">in-article (Article)</option>
                          <option value="autorelaxed">autorelaxed (Multiplex)</option>
                          <option value="vertical">vertical (Skyscraper)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ads.txt Manager */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">ads.txt ভেরিফিকেশন ফাইল (/ads.txt)</h3>
                <p className="text-slate-500">Google AdSense অনুমোদনের জন্য ads.txt কন্টেন্ট এখান থেকে সরাসরি আপডেট করুন।</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const pub = (settingsDraft.adsense_publisher_id || 'ca-pub-0000000000000000').replace(/^ca-/, '');
                    setSettingsDraft((s) => ({
                      ...s,
                      adsense_ads_txt: `google.com, ${pub}, DIRECT, f08c47fec0942fa0`,
                    }));
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 font-semibold hover:bg-slate-100"
                >
                  ডিফল্ট ads.txt তৈরি করুন
                </button>
                <a
                  href="/ads.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  /ads.txt দেখুন
                </a>
              </div>
            </div>
            <textarea
              rows={3}
              value={settingsDraft.adsense_ads_txt || ''}
              onChange={(e) => setSettingsDraft((s) => ({ ...s, adsense_ads_txt: e.target.value }))}
              placeholder="google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-[11px]"
            />
          </div>

          <button type="submit" className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">
            AdSense ও মনিটাইজেশন সেটিংস সংরক্ষণ করুন
          </button>
        </form>
      )}

      {section === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <form onSubmit={handleSaveSettings} className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 space-y-6">
            {/* 1. Website Branding, Logo Upload & Visual Customization */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Globe className="w-4 h-4 text-slate-800" />
                <h2 className="text-sm font-bold text-slate-900">ওয়েবসাইট লোগো, ব্র্যান্ডিং ও সম্পূর্ণ ডিজাইন কাস্টমাইজেশন</h2>
              </div>

              {/* Website Logo Upload & Preview Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {settingsDraft.site_logo_url ? (
                      <img
                        src={settingsDraft.site_logo_url}
                        alt="Website logo preview"
                        className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 p-1"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-white border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-slate-900">ওয়েবসাইট লোগো</div>
                      <p className="text-[11px] text-slate-500">ডিভাইস থেকে লোগো আপলোড করুন (সর্বোচ্চ 400KB) অথবা নিচে লোগো URL দিন।</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800">
                      <Upload className="w-3.5 h-3.5" />
                      লোগো আপলোড
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => handleLogoFileUpload(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                    {settingsDraft.site_logo_url && (
                      <button
                        type="button"
                        onClick={() => setSettingsDraft((s) => ({ ...s, site_logo_url: '' }))}
                        className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold"
                      >
                        মুছুন
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">লোগো ইমেজ URL / Data URI</label>
                    <input
                      type="text"
                      value={settingsDraft.site_logo_url || ''}
                      onChange={(e) => setSettingsDraft((s) => ({ ...s, site_logo_url: e.target.value }))}
                      placeholder="https://... বা /icon.svg"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">হেডারে লোগো প্রদর্শন মোড</label>
                    <select
                      value={settingsDraft.logo_display_mode || 'logo_and_text'}
                      onChange={(e) => setSettingsDraft((s) => ({ ...s, logo_display_mode: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    >
                      <option value="logo_and_text">লোগো + ওয়েবসাইটের নাম</option>
                      <option value="logo_only">শুধু লোগো</option>
                      <option value="text_only">শুধু ওয়েবসাইটের নাম</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">সাইটের নাম</label>
                  <input
                    type="text"
                    value={settingsDraft.site_name || ''}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, site_name: e.target.value }))}
                    placeholder="জনকথা (Jonokotha)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">সাইটের ট্যাগলাইন / স্লোগান</label>
                  <input
                    type="text"
                    value={settingsDraft.site_tagline || ''}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, site_tagline: e.target.value }))}
                    placeholder="জনগণের সংবাদ, নিজের এলাকার কথা"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">প্রাইমারি থিম কালার</label>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {BRAND_COLOR_OPTIONS.map((c) => {
                      const active = (settingsDraft.brand_color || '#b91c1c').toLowerCase() === c.hex;
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setSettingsDraft((s) => ({ ...s, brand_color: c.hex }))}
                          title={c.label}
                          className={`w-7 h-7 rounded-md ${c.swatchClass} ${
                            active ? 'ring-2 ring-offset-2 ring-slate-900' : 'opacity-80 hover:opacity-100'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">হোমপেজ ঘোষণা ব্যানার (খালি রাখলে দেখাবে না)</label>
                  <input
                    type="text"
                    value={settingsDraft.hero_announcement || ''}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, hero_announcement: e.target.value }))}
                    placeholder="যেমন: নতুন নাগরিক সাংবাদিকরা এখনই সাইন আপ করে প্রতি সংবাদের ভিউ থেকে আয় শুরু করুন!"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">ফুটার পরিচিতি / সম্পর্কে বিবরণ</label>
                  <textarea
                    rows={2}
                    value={settingsDraft.footer_about || ''}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, footer_about: e.target.value }))}
                    placeholder="বাংলাদেশের ৬৪ জেলার নাগরিক সাংবাদিকদের স্বাধীন ও যাচাইকৃত সংবাদ প্ল্যাটফর্ম।"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">ফুটার টেক্সট / কপিরাইট</label>
                  <input
                    type="text"
                    value={settingsDraft.footer_text || ''}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, footer_text: e.target.value }))}
                    placeholder="© ২০২৬ জনকথা — বাংলাদেশের স্বাধীন নাগরিক সাংবাদিকতা ও স্থানীয় সংবাদ নেটওয়ার্ক।"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* 2. SEO & Social Links */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">এসইও, যোগাযোগ ও সোশ্যাল মিডিয়া</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">SEO টাইটেল</label>
                  <input
                    type="text"
                    value={settingsDraft.seo_title || ''}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, seo_title: e.target.value }))}
                    placeholder="জনকথা | বাংলাদেশের নাগরিক সাংবাদিকতা প্ল্যাটফর্ম"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">যোগাযোগের ইমেইল</label>
                  <input
                    type="email"
                    value={settingsDraft.contact_email || ''}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, contact_email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">SEO মেটা বিবরণ</label>
                  <input
                    type="text"
                    value={settingsDraft.seo_description || ''}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, seo_description: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Facebook পেজ URL</label>
                  <input
                    type="url"
                    value={settingsDraft.facebook_url || ''}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, facebook_url: e.target.value }))}
                    placeholder="https://facebook.com/..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">YouTube চ্যানেল URL</label>
                  <input
                    type="url"
                    value={settingsDraft.youtube_url || ''}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, youtube_url: e.target.value }))}
                    placeholder="https://youtube.com/..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">X / Twitter URL</label>
                  <input
                    type="url"
                    value={settingsDraft.x_url || ''}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, x_url: e.target.value }))}
                    placeholder="https://x.com/..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* 3. Feature Toggles & Monetization Rules */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">ফিচার নিয়ন্ত্রণ ও মনিটাইজেশন নীতিমালা</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {[
                  { key: 'breaking_ticker_enabled', label: 'ব্রেকিং নিউজ টিকার' },
                  { key: 'ads_enabled', label: 'বিজ্ঞাপন প্রদর্শন' },
                  { key: 'adsense_enabled', label: 'Google AdSense', defaultFalse: true },
                  { key: 'creator_monetization_enabled', label: 'ক্রিয়েটর মনিটাইজেশন' },
                  { key: 'comments_enabled', label: 'মন্তব্য ব্যবস্থা' },
                  { key: 'registration_enabled', label: 'নতুন সাইন আপ চালু' },
                ].map((toggle) => {
                  const enabled = toggle.defaultFalse
                    ? settingsDraft[toggle.key] === 'true'
                    : settingsDraft[toggle.key] !== 'false';
                  return (
                    <button
                      key={toggle.key}
                      type="button"
                      onClick={() => setSettingsDraft((s) => ({ ...s, [toggle.key]: enabled ? 'false' : 'true' }))}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        enabled ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="font-semibold">{toggle.label}</div>
                      <div className="text-[11px] mt-0.5">{enabled ? 'সক্রিয় (ON)' : 'বন্ধ (OFF)'}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">মনিটাইজেশন ন্যূনতম ফলোয়ার</label>
                  <input
                    type="number"
                    value={settingsDraft.min_followers_monetization || '1000'}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, min_followers_monetization: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-tabular"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">মনিটাইজেশন ন্যূনতম বৈধ ভিউ</label>
                  <input
                    type="number"
                    value={settingsDraft.min_views_monetization || '10000'}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, min_views_monetization: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-tabular"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">ন্যূনতম উত্তোলন সীমা (BDT)</label>
                  <input
                    type="number"
                    value={settingsDraft.min_withdrawal_bdt || '500'}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, min_withdrawal_bdt: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-tabular"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">ক্রিয়েটর রেভিনিউ শেয়ার (%)</label>
                  <input
                    type="number"
                    value={settingsDraft.creator_revenue_share_pct || '60'}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, creator_revenue_share_pct: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-tabular"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">পোস্ট অনুমোদন মোড</label>
                  <select
                    value={settingsDraft.post_approval_mode || 'auto_verified_manual_new'}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, post_approval_mode: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                  >
                    <option value="auto_verified_manual_new">ভেরিফায়েড অটো / নতুন ম্যানুয়াল</option>
                    <option value="manual_all">সব পোস্ট অ্যাডমিন অনুমোদন সাপেক্ষ</option>
                    <option value="auto_all">স্বয়ংক্রিয় প্রকাশ</option>
                  </select>
                </div>
              </div>
            </div>

            <button type="submit" className="px-6 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">
              সব কাস্টমাইজেশন ও সেটিংস সংরক্ষণ করুন
            </button>
          </form>

          {/* Admin Passcode Security Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <KeyRound className="w-4 h-4 text-slate-800" />
              <h3 className="text-sm font-bold text-slate-900">অ্যাডমিন প্যানেল পাসওয়ার্ড</h3>
            </div>
            {gateStatus?.envConfigured ? (
              <p className="text-xs text-slate-600 leading-relaxed">
                বর্তমানে অ্যাডমিন পাসওয়ার্ড এনভায়রনমেন্ট সিক্রেট (<span className="font-semibold">ADMIN_PANEL_PASSCODE</span>) থেকে পরিচালিত হচ্ছে। পরিবর্তন করতে AI Studio Settings → Secrets ব্যবহার করুন।
              </p>
            ) : (
              <form onSubmit={handleChangeAdminPasscode} className="space-y-3 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  সুপার অ্যাডমিন হিসেবে এখান থেকে প্যানেল পাসওয়ার্ড পরিবর্তন করতে পারবেন (নিরাপদ scrypt হ্যাশে সংরক্ষিত হবে)।
                </p>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newAdminPasscode}
                  onChange={(e) => setNewAdminPasscode(e.target.value)}
                  placeholder="নতুন অ্যাডমিন পাসওয়ার্ড (৮+ অক্ষর)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg border border-slate-300 bg-slate-50 font-semibold text-slate-900 hover:bg-slate-100"
                >
                  পাসওয়ার্ড আপডেট করুন
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Creator Detailed Inspector Modal */}
      {inspectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={inspectedUser.avatarUrl || '/src/assets/images/avatar_citizen_reporter_1795635478721.jpg'}
                  alt={inspectedUser.fullName}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-bold text-sm flex items-center gap-1.5 truncate">
                    {inspectedUser.fullName}
                    {inspectedUser.verificationType !== 'none' && <BadgeCheck className="w-4 h-4 text-sky-400 shrink-0" />}
                  </div>
                  <div className="text-xs text-slate-300 truncate">
                    @{inspectedUser.username} · {inspectedUser.email} {inspectedUser.phone ? `· ${inspectedUser.phone}` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedUserId(null)}
                className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
                aria-label="Close inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs">
              {/* Creator Stats & Location Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-tabular">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">ফলোয়ার</span>
                  <span className="text-base font-bold">{inspectedUser.totalFollowers.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">বৈধ ভিউ</span>
                  <span className="text-base font-bold">{inspectedUser.validViews.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">প্রকাশিত সংবাদ</span>
                  <span className="text-base font-bold">{inspectedUserPosts.length}</span>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-emerald-700 block">অনুমোদিত আয়</span>
                  <span className="text-base font-bold text-emerald-800">৳{(inspectedUser.approvedEarningsBdt ?? 0).toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">উত্তোলনযোগ্য</span>
                  <span className="text-base font-bold">৳{(inspectedUser.withdrawableBalanceBdt ?? 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-900">এলাকা ও প্রোফাইল তথ্য</div>
                  <p className="text-slate-600">
                    {inspectedUser.division} → {inspectedUser.district} → {inspectedUser.upazila}
                    {inspectedUser.unionWard ? ` (${inspectedUser.unionWard})` : ''}
                  </p>
                  {inspectedUser.areaDetails && <p className="text-slate-500">{inspectedUser.areaDetails}</p>}
                  {inspectedUser.bio && <p className="text-slate-700 pt-1">{inspectedUser.bio}</p>}
                  {onOpenProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedUserId(null);
                        onOpenProfile(inspectedUser.username);
                      }}
                      className="text-red-700 font-semibold hover:underline pt-1 inline-block"
                    >
                      পাবলিক প্রোফাইল (/profile/{inspectedUser.username}) দেখুন →
                    </button>
                  )}
                </div>

                {/* Direct Admin Controls + 1-Click Monetization & Profile Edit */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-900">প্রোফাইল মনিটাইজেশন</div>
                      <div className="text-[11px] text-slate-500">বর্তমান অবস্থা: {inspectedUser.monetizationStatus}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateUser(inspectedUser.id, {
                          monetizationStatus: inspectedUser.monetizationStatus === 'monetized' ? 'disabled' : 'monetized',
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1 ${
                        inspectedUser.monetizationStatus === 'monetized'
                          ? 'bg-red-700 text-white hover:bg-red-800'
                          : 'bg-emerald-700 text-white hover:bg-emerald-800'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {inspectedUser.monetizationStatus === 'monetized' ? 'মনিটাইজেশন বন্ধ করুন' : 'মনিটাইজেশন চালু করুন'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">অ্যাকাউন্ট রোল</label>
                      <select
                        value={inspectedUser.role}
                        onChange={(e) => updateUser(inspectedUser.id, { role: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
                      >
                        {['user', 'creator', 'support_manager', 'finance_manager', 'moderator', 'news_editor', 'admin', 'super_admin'].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">মনিটাইজেশন</label>
                      <select
                        value={inspectedUser.monetizationStatus}
                        onChange={(e) => updateUser(inspectedUser.id, { monetizationStatus: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
                      >
                        {['not_eligible', 'eligible', 'under_review', 'monetized', 'suspended', 'disabled'].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">ভেরিফিকেশন ব্যাজ</label>
                      <select
                        value={inspectedUser.verificationType}
                        onChange={(e) => updateUser(inspectedUser.id, { verificationType: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
                      >
                        <option value="none">none</option>
                        <option value="local_reporter">local_reporter</option>
                        <option value="verified_creator">verified_creator</option>
                        <option value="official_org">official_org</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">অ্যাকাউন্ট স্ট্যাটাস</label>
                      <select
                        value={inspectedUser.accountStatus}
                        onChange={(e) => updateUser(inspectedUser.id, { accountStatus: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
                      >
                        <option value="active">active</option>
                        <option value="suspended">suspended</option>
                        <option value="banned">banned</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Creator Profile & Strikes */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="font-bold text-slate-900">ক্রিয়েটর প্রোফাইল, লেভেল ও স্ট্রাইক সম্পাদনা</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">পূর্ণ নাম</label>
                    <input
                      type="text"
                      value={inspectFullName}
                      onChange={(e) => setInspectFullName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">ক্রিয়েটর লেভেল (1–5)</label>
                    <select
                      value={inspectLevel}
                      onChange={(e) => setInspectLevel(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white font-tabular"
                    >
                      {[1, 2, 3, 4, 5].map((lv) => (
                        <option key={lv} value={lv}>Level {lv}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">স্ট্রাইক</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={inspectStrikes}
                        onChange={(e) => setInspectStrikes(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">ভায়োলেশন</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={inspectViolations}
                        onChange={(e) => setInspectViolations(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-tabular"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">বায়ো / পরিচিতি</label>
                    <input
                      type="text"
                      value={inspectBio}
                      onChange={(e) => setInspectBio(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        updateUser(inspectedUser.id, {
                          fullName: inspectFullName,
                          bio: inspectBio,
                          creatorLevel: Number(inspectLevel),
                          copyrightStrikes: Number(inspectStrikes),
                          guidelineViolations: Number(inspectViolations),
                        })
                      }
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
                    >
                      প্রোফাইল সেভ করুন
                    </button>
                  </div>
                </div>
              </div>

              {/* Credit Revenue Share / Bonus */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-700" />
                  ক্রিয়েটরের আয়ের লেজারে বোনাস / রেভিনিউ যোগ করুন
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="মোট পরিমাণ (BDT)"
                    className="rounded-lg border border-slate-300 px-3 py-2 font-tabular sm:w-40"
                  />
                  <input
                    type="text"
                    value={creditNote}
                    onChange={(e) => setCreditNote(e.target.value)}
                    placeholder="নোট (যেমন: মাসিক বিজ্ঞাপন রেভিনিউ শেয়ার)"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => handleCreditCreator(inspectedUser.id)}
                    className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 whitespace-nowrap"
                  >
                    রেভিনিউ ক্রেডিট করুন
                  </button>
                </div>
              </div>

              {/* Creator's Posts */}
              <div className="space-y-2.5">
                <h3 className="font-bold text-slate-900">ক্রিয়েটরের প্রকাশিত ও পেন্ডিং সংবাদসমূহ ({inspectedUserPosts.length})</h3>
                {inspectedUserPosts.length === 0 ? (
                  <p className="text-slate-500">এই ক্রিয়েটর এখনো কোনো সংবাদ পোস্ট করেননি।</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {inspectedUserPosts.map((p) => (
                      <div key={p.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{p.title}</div>
                          <div className="text-slate-500 font-tabular">
                            স্ট্যাটাস: <strong>{p.status}</strong> · {p.category} · ভিউ: {p.validViewsCount.toLocaleString()} · লাইক: {p.likesCount}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => moderatePost(p.id, { status: 'published' })}
                            className="px-2 py-1 rounded bg-emerald-700 text-white font-medium"
                          >
                            Publish
                          </button>
                          <button
                            type="button"
                            onClick={() => moderatePost(p.id, { status: 'hidden' })}
                            className="px-2 py-1 rounded border border-slate-300"
                          >
                            Hide
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePost(p.id)}
                            className="px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Creator's Withdrawals */}
              {inspectedUserWithdrawals.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="font-bold text-slate-900">উত্তোলন অনুরোধ ({inspectedUserWithdrawals.length})</h3>
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {inspectedUserWithdrawals.map((w) => (
                      <div key={w.id} className="p-3 flex items-center justify-between gap-2 font-tabular">
                        <div>
                          <span className="font-bold">৳{w.amountBdt}</span> · {w.paymentMethod.toUpperCase()} ({w.accountNumber}) · স্ট্যাটাস:{' '}
                          <strong>{w.status}</strong>
                        </div>
                        {w.status === 'pending' && (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => processWithdrawal(w.id, 'paid')}
                              className="px-2.5 py-1 rounded bg-emerald-700 text-white font-semibold"
                            >
                              Mark Paid
                            </button>
                            <button
                              type="button"
                              onClick={() => processWithdrawal(w.id, 'rejected')}
                              className="px-2.5 py-1 rounded border border-red-300 text-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
