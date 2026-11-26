import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Compass,
  ExternalLink,
  Flame,
  Home,
  LogOut,
  MapPin,
  PenSquare,
  Search,
  TrendingUp,
  User as UserIcon,
  BadgeCheck,
  Wallet,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { NewsCard } from './components/NewsCard.tsx';
import { ArticleDetailView } from './components/ArticleDetailView.tsx';
import { CreateNewsView } from './components/CreateNewsView.tsx';
import { PublicProfileView } from './components/PublicProfileView.tsx';
import { CreatorDashboardView } from './components/CreatorDashboardView.tsx';
import { AdminDashboardView } from './components/AdminDashboardView.tsx';
import { CreatorSignupView } from './components/CreatorSignupView.tsx';
import { LegalPagesView } from './components/LegalPagesView.tsx';
import { ShareModal } from './components/ShareModal.tsx';
import { AdSenseSlot, useAdSenseScript } from './components/AdSenseSlot.tsx';
import { OfflineIndicator, PWAInstallButton } from './hooks/usePWAInstall.tsx';
import { BANGLADESH_LOCATIONS, POST_TYPES, REPORT_REASONS } from './lib/bangladesh-locations.ts';
import type { Advertisement, NewsPost, NotificationItem, PostAuthor, PublicSiteSettings } from './types.ts';

function isSafeClientUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.trim()) return false;
  const trimmed = url.trim();
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length <= 600_000) {
    return true;
  }
  if (trimmed.startsWith('/')) return !trimmed.startsWith('//');
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const THEME_PRESETS: Record<
  string,
  { text: string; bg: string; bgHover: string; tickerBg: string; tickerText: string }
> = {
  '#b91c1c': { text: 'text-red-700', bg: 'bg-red-700', bgHover: 'hover:bg-red-800', tickerBg: 'bg-red-800 border-red-900', tickerText: 'text-red-800' },
  '#0f172a': { text: 'text-slate-900', bg: 'bg-slate-900', bgHover: 'hover:bg-slate-800', tickerBg: 'bg-slate-900 border-slate-950', tickerText: 'text-slate-900' },
  '#047857': { text: 'text-emerald-700', bg: 'bg-emerald-700', bgHover: 'hover:bg-emerald-800', tickerBg: 'bg-emerald-800 border-emerald-900', tickerText: 'text-emerald-800' },
  '#1d4ed8': { text: 'text-blue-700', bg: 'bg-blue-700', bgHover: 'hover:bg-blue-800', tickerBg: 'bg-blue-800 border-blue-900', tickerText: 'text-blue-800' },
  '#9a3412': { text: 'text-orange-800', bg: 'bg-orange-800', bgHover: 'hover:bg-orange-900', tickerBg: 'bg-orange-900 border-orange-950', tickerText: 'text-orange-900' },
  '#6d28d9': { text: 'text-violet-700', bg: 'bg-violet-700', bgHover: 'hover:bg-violet-800', tickerBg: 'bg-violet-800 border-violet-900', tickerText: 'text-violet-800' },
};

type RouteView =
  | { type: 'feed' }
  | { type: 'explore' }
  | { type: 'article'; slug: string }
  | { type: 'profile'; username: string }
  | { type: 'create' }
  | { type: 'creator' }
  | { type: 'signup' }
  | { type: 'admin' }
  | { type: 'legal' };

function parseRouteFromLocation(): RouteView {
  const p = window.location.pathname;
  if (p.startsWith('/news/')) {
    const slug = decodeURIComponent(p.slice('/news/'.length));
    if (slug) return { type: 'article', slug };
  }
  if (p.startsWith('/profile/')) {
    const username = decodeURIComponent(p.slice('/profile/'.length));
    if (username) return { type: 'profile', username };
  }
  if (p === '/create') return { type: 'create' };
  if (p === '/creator') return { type: 'creator' };
  if (p === '/signup') return { type: 'signup' };
  if (p === '/admin') return { type: 'admin' };
  if (p === '/legal') return { type: 'legal' };
  if (p === '/explore') return { type: 'explore' };
  return { type: 'feed' };
}

function PlatformShell() {
  const { user, apiFetch, logout } = useAuth();
  const [route, setRoute] = useState<RouteView>(() => parseRouteFromLocation());
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Feed & Filters
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [selectedUpazila, setSelectedUpazila] = useState('All');
  const [selectedHashtag, setSelectedHashtag] = useState('');
  const [sortMode, setSortMode] = useState<'feed' | 'latest' | 'popular' | 'most_viewed' | 'most_shared' | 'saved'>('feed');

  // Highlights & Ads
  const [breakingNews, setBreakingNews] = useState<{ id: number; title: string; slug: string; district: string | null }[]>([]);
  const [popularCreators, setPopularCreators] = useState<PostAuthor[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [mostViewed, setMostViewed] = useState<{ id: number; title: string; slug: string; validViewsCount: number }[]>([]);
  const [feedAds, setFeedAds] = useState<Advertisement[]>([]);
  const [sidebarAds, setSidebarAds] = useState<Advertisement[]>([]);

  // Notifications
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Site Customization Settings & Share Modal
  const [siteSettings, setSiteSettings] = useState<PublicSiteSettings>({});
  const [shareTarget, setShareTarget] = useState<NewsPost | null>(null);

  // Report modal
  const [reportTarget, setReportTarget] = useState<NewsPost | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  const fetchPublicSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/posts/public-settings');
      if (res.ok) {
        const json = (await res.json()) as { settings: PublicSiteSettings };
        setSiteSettings(json.settings || {});
      }
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    fetchPublicSettings();
  }, [fetchPublicSettings]);

  useEffect(() => {
    const docTitle = String(siteSettings.seo_title || siteSettings.site_name || 'জনকথা (Jonokotha)');
    document.title = docTitle;
    if (siteSettings.seo_description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', String(siteSettings.seo_description));
    }
  }, [siteSettings.seo_title, siteSettings.site_name, siteSettings.seo_description]);

  const theme = useMemo(() => {
    const key = String(siteSettings.brand_color || '#b91c1c').toLowerCase();
    return THEME_PRESETS[key] || THEME_PRESETS['#b91c1c'];
  }, [siteSettings.brand_color]);

  const breakingTickerEnabled =
    siteSettings.breaking_ticker_enabled !== false && siteSettings.breaking_ticker_enabled !== 'false';
  const adsEnabled = siteSettings.ads_enabled !== false && siteSettings.ads_enabled !== 'false';
  const adsenseEnabled =
    adsEnabled && (siteSettings.adsense_enabled === true || siteSettings.adsense_enabled === 'true');
  const adsensePubId = String(siteSettings.adsense_publisher_id || '');
  const logoDisplayMode = String(siteSettings.logo_display_mode || 'logo_and_text');
  const hasLogo = isSafeClientUrl(siteSettings.site_logo_url);

  useAdSenseScript(adsensePubId, adsenseEnabled);

  const navigate = useCallback((next: RouteView, urlPath: string) => {
    setRoute(next);
    window.history.pushState({}, '', urlPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(parseRouteFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const fetchFeed = useCallback(async () => {
    setLoadingFeed(true);
    setFeedError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (selectedCategory !== 'All') params.set('category', selectedCategory);
      if (selectedDistrict !== 'All') params.set('district', selectedDistrict);
      if (selectedUpazila !== 'All') params.set('upazila', selectedUpazila);
      if (selectedHashtag) params.set('hashtag', selectedHashtag);
      params.set('sort', sortMode);

      const res = await apiFetch<{ posts: NewsPost[] }>(`/api/posts?${params.toString()}`);
      setPosts(res.posts);
    } catch (e: unknown) {
      setFeedError(e instanceof Error ? e.message : 'সংবাদ ফিড লোড করা যায়নি');
    } finally {
      setLoadingFeed(false);
    }
  }, [apiFetch, searchQuery, selectedCategory, selectedDistrict, selectedUpazila, selectedHashtag, sortMode]);

  const fetchHighlightsAndAds = useCallback(async () => {
    try {
      const [hl, fAds, sAds] = await Promise.all([
        apiFetch<{
          breakingNews: { id: number; title: string; slug: string; district: string | null }[];
          popularCreators: PostAuthor[];
          trendingHashtags: { tag: string; count: number }[];
          mostViewed: { id: number; title: string; slug: string; validViewsCount: number }[];
        }>('/api/posts/highlights'),
        apiFetch<{ ads: Advertisement[] }>(`/api/creators/ads/active?placement=feed&district=${encodeURIComponent(selectedDistrict)}`),
        apiFetch<{ ads: Advertisement[] }>(`/api/creators/ads/active?placement=sidebar&district=${encodeURIComponent(selectedDistrict)}`),
      ]);
      setBreakingNews(hl.breakingNews);
      setPopularCreators(hl.popularCreators);
      setTrendingHashtags(hl.trendingHashtags);
      setMostViewed(hl.mostViewed);
      setFeedAds(fAds.ads);
      setSidebarAds(sAds.ads);
    } catch {
      // non-blocking
    }
  }, [apiFetch, selectedDistrict]);

  useEffect(() => {
    if (route.type === 'feed' || route.type === 'explore') {
      fetchFeed();
    }
  }, [route.type, fetchFeed]);

  useEffect(() => {
    fetchHighlightsAndAds();
  }, [fetchHighlightsAndAds]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch<{ notifications: NotificationItem[] }>('/api/creators/me/notifications');
      setNotifications(res.notifications);
    } catch {
      // ignore
    }
  }, [user, apiFetch]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const allDistricts = useMemo(
    () => BANGLADESH_LOCATIONS.flatMap((d) => d.districts),
    []
  );

  const selectedDistObj = useMemo(
    () => allDistricts.find((d) => d.name === selectedDistrict),
    [allDistricts, selectedDistrict]
  );

  const isAdminUser = Boolean(
    user && ['super_admin', 'admin', 'news_editor', 'moderator', 'finance_manager', 'support_manager'].includes(user.role)
  );

  const handleReact = async (postId: number, type: string) => {
    if (!user) return setAuthModalOpen(true);
    try {
      const res = await apiFetch<{ myReaction: string | null; delta: number }>(`/api/posts/${postId}/react`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, myReaction: res.myReaction, likesCount: Math.max(0, p.likesCount + res.delta) }
            : p
        )
      );
    } catch {
      // ignore
    }
  };

  const handleSave = async (postId: number) => {
    if (!user) return setAuthModalOpen(true);
    try {
      const res = await apiFetch<{ isSaved: boolean }>(`/api/posts/${postId}/save`, { method: 'POST' });
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isSaved: res.isSaved } : p)));
    } catch {
      // ignore
    }
  };

  const recordPostShare = useCallback(
    async (post: NewsPost) => {
      try {
        await apiFetch(`/api/posts/${post.id}/share`, { method: 'POST' });
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, sharesCount: p.sharesCount + 1 } : p)));
      } catch {
        // ignore
      }
    },
    [apiFetch]
  );

  const handleShare = (post: NewsPost) => {
    setShareTarget(post);
  };

  const handleFollow = async (authorId: number) => {
    if (!user) return setAuthModalOpen(true);
    try {
      const res = await apiFetch<{ isFollowing: boolean }>(`/api/creators/${authorId}/follow`, { method: 'POST' });
      setPosts((prev) =>
        prev.map((p) => (p.author.id === authorId ? { ...p, isFollowingAuthor: res.isFollowing } : p))
      );
    } catch {
      // ignore
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return setAuthModalOpen(true);
    if (!reportTarget) return;
    try {
      const res = await apiFetch<{ message: string }>(`/api/posts/${reportTarget.id}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: reportReason, details: reportDetails }),
      });
      setReportStatus(res.message);
      setReportDetails('');
    } catch (err: unknown) {
      setReportStatus(err instanceof Error ? err.message : 'রিপোর্ট পাঠানো যায়নি');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-20 md:pb-0">
      {/* Top Bar Contract: Single Row, 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark & Custom Logo */}
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              setSelectedDistrict('All');
              setSelectedHashtag('');
              setSearchQuery('');
              navigate({ type: 'feed' }, '/');
            }}
            className={`font-editorial text-xl font-bold tracking-tight ${theme.text} whitespace-nowrap shrink-0 inline-flex items-center gap-2`}
          >
            {hasLogo && logoDisplayMode !== 'text_only' && (
              <img
                src={String(siteSettings.site_logo_url)}
                alt={String(siteSettings.site_name || 'জনকথা')}
                className="h-8 max-w-[120px] rounded object-contain shrink-0"
              />
            )}
            {(logoDisplayMode !== 'logo_only' || !hasLogo) && (
              <span>{String(siteSettings.site_name || 'জনকথা')}</span>
            )}
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => navigate({ type: 'feed' }, '/')}
              className={`hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0 ${
                route.type === 'feed' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              হোম ফিড
            </button>
            <button
              type="button"
              onClick={() => {
                if (user?.district) setSelectedDistrict(user.district);
                setSortMode('feed');
                navigate({ type: 'feed' }, '/');
              }}
              className="hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              আমার এলাকা
            </button>
            <button
              type="button"
              onClick={() => (user ? navigate({ type: 'creator' }, '/creator') : setAuthModalOpen(true))}
              className={`hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0 ${
                route.type === 'creator' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              ক্রিয়েটর স্টুডিও
            </button>
            <button
              type="button"
              onClick={() => navigate({ type: 'admin' }, '/admin')}
              className={`hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0 ${
                route.type === 'admin' ? `${theme.text} font-semibold` : ''
              }`}
            >
              {isAdminUser ? 'অ্যাডমিন প্যানেল' : 'অ্যাডমিন'}
            </button>
            <button
              type="button"
              onClick={() => navigate({ type: 'legal' }, '/legal')}
              className={`hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0 ${
                route.type === 'legal' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              নীতিমালা
            </button>
          </nav>

          {/* Zone 3: Primary Actions ("আয় করুন" + "সংবাদ লিখুন") + Notifications */}
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen);
                    if (!notificationsOpen && unreadCount > 0) {
                      apiFetch('/api/creators/me/notifications/read', { method: 'POST' }).then(() =>
                        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
                      );
                    }
                  }}
                  className="relative min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full ${theme.bg} text-[10px] font-bold text-white flex items-center justify-center font-tabular`}>
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white border border-slate-200 shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between text-xs font-bold">
                      <span>নোটিফিকেশন</span>
                      <button type="button" onClick={() => setNotificationsOpen(false)} className="text-slate-400 hover:text-slate-700">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-xs text-slate-500 text-center">নতুন কোনো নোটিফিকেশন নেই।</p>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className="p-3 text-xs hover:bg-slate-50">
                            <div className="font-semibold text-slate-900">{n.title}</div>
                            <div className="text-slate-600 mt-0.5">{n.body}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate({ type: 'signup' }, '/signup')}
              className="px-2.5 sm:px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
            >
              <Wallet className="w-3.5 h-3.5" />
              আয় করুন
            </button>

            <button
              type="button"
              onClick={() => (user ? navigate({ type: 'create' }, '/create') : setAuthModalOpen(true))}
              className={`px-2.5 sm:px-3.5 py-2 rounded-lg ${theme.bg} text-white text-xs font-semibold ${theme.bgHover} transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5`}
            >
              <PenSquare className="w-3.5 h-3.5" />
              {user ? 'সংবাদ লিখুন' : 'লগইন'}
            </button>

            {user && (
              <button
                type="button"
                onClick={logout}
                title="লগআউট করুন"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>লগআউট</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Breaking News Ticker */}
      {breakingTickerEnabled && breakingNews.length > 0 && (
        <div className={`${theme.tickerBg} text-white border-b overflow-hidden`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-9 flex items-center gap-4">
            <span className={`text-[11px] font-bold tracking-wider uppercase bg-white ${theme.tickerText} px-2 py-0.5 rounded-sm shrink-0`}>
              ব্রেকিং
            </span>
            <div className="flex-1 overflow-hidden whitespace-nowrap">
              <div className="animate-ticker gap-10 text-xs font-medium">
                {[...breakingNews, ...breakingNews].map((b, idx) => (
                  <button
                    key={`${b.id}-${idx}`}
                    type="button"
                    onClick={() => navigate({ type: 'article', slug: b.slug }, `/news/${b.slug}`)}
                    className="hover:underline inline-flex items-center gap-2 shrink-0"
                  >
                    <span>{b.title}</span>
                    {b.district && <span className="text-white/75">({b.district})</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {adsenseEnabled &&
          siteSettings.adsense_header_enabled !== false &&
          siteSettings.adsense_header_enabled !== 'false' &&
          Boolean(siteSettings.adsense_header_slot) && (
            <AdSenseSlot
              publisherId={adsensePubId}
              slotId={String(siteSettings.adsense_header_slot || '')}
              format={String(siteSettings.adsense_header_format || 'horizontal')}
              enabled={adsenseEnabled}
              label="হেডার বিজ্ঞাপন"
              className="mb-5"
            />
          )}

        {Boolean(siteSettings.hero_announcement) && (route.type === 'feed' || route.type === 'explore') && (
          <div className="mb-5 rounded-xl bg-white border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-800">{String(siteSettings.hero_announcement)}</p>
            <button
              type="button"
              onClick={() => navigate({ type: 'signup' }, '/signup')}
              className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap shrink-0"
            >
              আয় করুন ও সংবাদ প্রকাশ করুন →
            </button>
          </div>
        )}

        {route.type === 'article' && (
          <div className="max-w-3xl mx-auto">
            <ArticleDetailView
              slug={route.slug}
              onBack={() => navigate({ type: 'feed' }, '/')}
              onOpenProfile={(username) => navigate({ type: 'profile', username }, `/profile/${username}`)}
              onRequireAuth={() => setAuthModalOpen(true)}
              onReportPost={(post) => {
                setReportTarget(post);
                setReportStatus(null);
              }}
              onSharePost={(post) => setShareTarget(post)}
              adsenseConfig={{
                enabled: adsenseEnabled,
                publisherId: adsensePubId,
                articleSlot: String(siteSettings.adsense_article_slot || ''),
                articleFormat: String(siteSettings.adsense_article_format || 'in-article'),
                articleEnabled:
                  siteSettings.adsense_article_enabled !== false &&
                  siteSettings.adsense_article_enabled !== 'false',
                multiplexSlot: String(siteSettings.adsense_multiplex_slot || ''),
                multiplexEnabled:
                  siteSettings.adsense_multiplex_enabled !== false &&
                  siteSettings.adsense_multiplex_enabled !== 'false',
              }}
            />
          </div>
        )}

        {route.type === 'profile' && (
          <div className="max-w-3xl mx-auto">
            <PublicProfileView
              username={route.username}
              onBack={() => navigate({ type: 'feed' }, '/')}
              onOpenArticle={(slug) => navigate({ type: 'article', slug }, `/news/${slug}`)}
              onRequireAuth={() => setAuthModalOpen(true)}
              onReportPost={(post) => {
                setReportTarget(post);
                setReportStatus(null);
              }}
              onSharePost={(post) => setShareTarget(post)}
              onFilterTag={(tag) => {
                setSelectedHashtag(tag);
                navigate({ type: 'feed' }, '/');
              }}
            />
          </div>
        )}

        {route.type === 'signup' && (
          <CreatorSignupView
            siteSettings={siteSettings}
            onSignupSuccess={() => navigate({ type: 'create' }, '/create')}
            onOpenCreatorStudio={() => navigate({ type: 'creator' }, '/creator')}
            onOpenLogin={() => setAuthModalOpen(true)}
            onBackToFeed={() => navigate({ type: 'feed' }, '/')}
          />
        )}

        {route.type === 'create' && (
          <div className="max-w-4xl mx-auto">
            <CreateNewsView
              onPublished={(slug) => navigate({ type: 'article', slug }, `/news/${slug}`)}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          </div>
        )}

        {route.type === 'creator' && (
          <CreatorDashboardView
            onOpenArticle={(slug) => navigate({ type: 'article', slug }, `/news/${slug}`)}
            onCreatePost={() => navigate({ type: 'create' }, '/create')}
          />
        )}

        {route.type === 'admin' && (
          <AdminDashboardView
            onSettingsUpdated={fetchPublicSettings}
            onOpenProfile={(username) => navigate({ type: 'profile', username }, `/profile/${username}`)}
          />
        )}

        {route.type === 'legal' && <LegalPagesView onBack={() => navigate({ type: 'feed' }, '/')} />}

        {(route.type === 'feed' || route.type === 'explore') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Sidebar: Location Filter + Categories + PWA */}
            <aside className="hidden lg:block lg:col-span-3 space-y-5 sticky top-20">
              {user && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatarUrl || '/src/assets/images/avatar_citizen_reporter_1795635478721.jpg'}
                      alt={user.fullName}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => navigate({ type: 'profile', username: user.username }, `/profile/${user.username}`)}
                        className="text-sm font-bold text-slate-900 hover:underline truncate block"
                      >
                        {user.fullName}
                      </button>
                      <p className="text-xs text-slate-500 truncate">@{user.username} · {user.district}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs font-tabular">
                    <div>
                      <span className="text-slate-500 block">ফলোয়ার</span>
                      <span className="font-bold">{user.totalFollowers.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">বৈধ ভিউ</span>
                      <span className="font-bold">{user.validViews.toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full py-1.5 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    লগআউট করুন
                  </button>
                </div>
              )}

              {/* Location-Based Filter */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-700" />
                    এলাকাভিত্তিক সংবাদ
                  </h2>
                  {selectedDistrict !== 'All' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDistrict('All');
                        setSelectedUpazila('All');
                      }}
                      className="text-[11px] text-red-700 hover:underline"
                    >
                      রিসেট
                    </button>
                  )}
                </div>
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value);
                    setSelectedUpazila('All');
                  }}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs bg-white"
                >
                  <option value="All">সারা বাংলাদেশ (সব জেলা)</option>
                  {allDistricts.map((d) => (
                    <option key={d.name} value={d.name}>{d.bnName} ({d.name})</option>
                  ))}
                </select>
                {selectedDistObj && (
                  <select
                    value={selectedUpazila}
                    onChange={(e) => setSelectedUpazila(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs bg-white"
                  >
                    <option value="All">সব উপজেলা / থানা</option>
                    {selectedDistObj.upazilas.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* News Categories */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
                <h2 className="text-xs font-bold text-slate-900 pb-2 border-b border-slate-100">সংবাদ বিভাগ</h2>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('All')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                    selectedCategory === 'All' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  সকল বিভাগ
                </button>
                <div className="max-h-72 overflow-y-auto space-y-0.5 pt-1">
                  {POST_TYPES.map((pt) => (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => setSelectedCategory(pt.value)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        selectedCategory === pt.value ? 'bg-slate-900 text-white font-medium' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <PWAInstallButton />
                <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                  <button type="button" onClick={() => navigate({ type: 'legal' }, '/legal')} className="hover:underline">
                    নীতিমালা ও শর্তাবলি
                  </button>
                  <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="hover:underline">
                    XML Sitemap
                  </a>
                  <a href="/news-sitemap.xml" target="_blank" rel="noreferrer" className="hover:underline">
                    News Sitemap
                  </a>
                </div>
              </div>
            </aside>

            {/* Center Social News Feed */}
            <section className="lg:col-span-6 space-y-5">
              {/* Search & Sort Controls */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="সংবাদ, জেলা, হ্যাশট্যাগ বা সাংবাদিক খুঁজুন..."
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-red-700"
                  />
                </div>

                {/* Mobile quick location/category selectors */}
                <div className="flex lg:hidden gap-2">
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
                  >
                    <option value="All">সব জেলা</option>
                    {allDistricts.map((d) => (
                      <option key={d.name} value={d.name}>{d.bnName}</option>
                    ))}
                  </select>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
                  >
                    <option value="All">সব বিভাগ</option>
                    {POST_TYPES.map((pt) => (
                      <option key={pt.value} value={pt.value}>{pt.value}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {[
                    { id: 'feed', label: 'আমার ফিড' },
                    { id: 'latest', label: 'সর্বশেষ' },
                    { id: 'popular', label: 'জনপ্রিয়' },
                    { id: 'most_viewed', label: 'সর্বাধিক পঠিত' },
                    { id: 'most_shared', label: 'সর্বাধিক শেয়ার' },
                    ...(user ? [{ id: 'saved', label: 'সেভড' }] : []),
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSortMode(s.id as typeof sortMode)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                        sortMode === s.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {selectedHashtag && (
                  <div className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    <span>হ্যাশট্যাগ ফিল্টার: <strong>#{selectedHashtag}</strong></span>
                    <button type="button" onClick={() => setSelectedHashtag('')} className="text-red-700 font-medium">
                      মুছুন
                    </button>
                  </div>
                )}
              </div>

              {feedError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">{feedError}</div>
              )}

              {loadingFeed ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse space-y-3">
                      <div className="h-4 w-1/3 bg-slate-200 rounded" />
                      <div className="h-6 w-5/6 bg-slate-200 rounded" />
                      <div className="h-44 bg-slate-100 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
                  <p className="text-sm font-medium text-slate-700">নির্বাচিত ফিল্টারে কোনো সংবাদ পাওয়া যায়নি।</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSelectedDistrict('All');
                      setSelectedHashtag('');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium"
                  >
                    সব সংবাদ দেখুন
                  </button>
                </div>
              ) : (
                posts.map((post, idx) => (
                  <React.Fragment key={post.id}>
                    <NewsCard
                      post={post}
                      onOpenArticle={(slug) => navigate({ type: 'article', slug }, `/news/${slug}`)}
                      onOpenProfile={(username) => navigate({ type: 'profile', username }, `/profile/${username}`)}
                      onReact={handleReact}
                      onSave={handleSave}
                      onShare={handleShare}
                      onFollow={handleFollow}
                      onReport={(p) => {
                        setReportTarget(p);
                        setReportStatus(null);
                      }}
                      onFilterTag={(tag) => setSelectedHashtag(tag)}
                    />

                    {/* Native Feed Advertisement or Google AdSense In-Feed after 2nd post */}
                    {adsEnabled && idx === 1 && feedAds[0] && (
                      <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>স্পন্সরড · {feedAds[0].advertiserName}</span>
                          <span>বিজ্ঞাপন</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{feedAds[0].title}</h3>
                        {feedAds[0].imageUrl && (
                          <img
                            src={feedAds[0].imageUrl}
                            alt={feedAds[0].title}
                            referrerPolicy="no-referrer"
                            className="w-full h-40 object-cover rounded-lg"
                          />
                        )}
                        <a
                          href={feedAds[0].destinationUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() =>
                            apiFetch(`/api/creators/ads/${feedAds[0].id}/event`, {
                              method: 'POST',
                              body: JSON.stringify({ event: 'click' }),
                            })
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:underline"
                        >
                          বিস্তারিত জানুন <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}

                    {adsenseEnabled &&
                      (idx === 1 || idx === 4) &&
                      siteSettings.adsense_feed_enabled !== false &&
                      siteSettings.adsense_feed_enabled !== 'false' &&
                      Boolean(siteSettings.adsense_feed_slot) && (
                        <AdSenseSlot
                          publisherId={adsensePubId}
                          slotId={String(siteSettings.adsense_feed_slot || '')}
                          format={String(siteSettings.adsense_feed_format || 'fluid')}
                          enabled={adsenseEnabled}
                          label="ইন-ফিড বিজ্ঞাপন"
                        />
                      )}
                  </React.Fragment>
                ))
              )}
            </section>

            {/* Right Rail: Popular Creators, Trending Hashtags, Most Viewed, Sidebar Ad */}
            <aside className="hidden lg:block lg:col-span-3 space-y-5 sticky top-20">
              {/* Popular & Featured Creators */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Flame className="w-3.5 h-3.5 text-red-700" />
                  জনপ্রিয় ও ফিচার্ড ক্রিয়েটর
                </h2>
                <div className="space-y-3">
                  {popularCreators.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => navigate({ type: 'profile', username: c.username }, `/profile/${c.username}`)}
                        className="flex items-center gap-2.5 min-w-0 text-left"
                      >
                        <img
                          src={c.avatarUrl || '/src/assets/images/avatar_citizen_reporter_1795635478721.jpg'}
                          alt={c.fullName}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-slate-900 truncate">{c.fullName}</span>
                            {c.verificationType !== 'none' && <BadgeCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                          </div>
                          <span className="text-[11px] text-slate-500 font-tabular block">
                            {(c.totalFollowers ?? 0).toLocaleString()} ফলোয়ার · {c.district}
                          </span>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trending Hashtags */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <TrendingUp className="w-3.5 h-3.5 text-red-700" />
                  ট্রেন্ডিং হ্যাশট্যাগ
                </h2>
                <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs">
                  {trendingHashtags.map((h) => (
                    <button
                      key={h.tag}
                      type="button"
                      onClick={() => setSelectedHashtag(h.tag)}
                      className="text-sky-700 hover:underline font-medium"
                    >
                      #{h.tag} <span className="text-slate-400 font-tabular">({h.count})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Most Viewed */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h2 className="text-xs font-bold text-slate-900 pb-2 border-b border-slate-100">সর্বাধিক পঠিত</h2>
                <div className="divide-y divide-slate-100">
                  {mostViewed.map((mv, i) => (
                    <button
                      key={mv.id}
                      type="button"
                      onClick={() => navigate({ type: 'article', slug: mv.slug }, `/news/${mv.slug}`)}
                      className="w-full text-left py-2.5 flex items-start gap-2.5 hover:text-red-700"
                    >
                      <span className="text-xs font-bold text-slate-400 font-tabular">{i + 1}.</span>
                      <span className="text-xs font-medium text-slate-800 leading-snug">{mv.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sidebar Ad */}
              {adsEnabled && sidebarAds[0] && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="text-[10px] text-slate-400">বিজ্ঞাপন · {sidebarAds[0].advertiserName}</div>
                  <h3 className="text-xs font-bold text-slate-900">{sidebarAds[0].title}</h3>
                  <a
                    href={sidebarAds[0].destinationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"
                  >
                    ভিজিট করুন <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {adsenseEnabled &&
                siteSettings.adsense_sidebar_enabled !== false &&
                siteSettings.adsense_sidebar_enabled !== 'false' &&
                Boolean(siteSettings.adsense_sidebar_slot) && (
                  <AdSenseSlot
                    publisherId={adsensePubId}
                    slotId={String(siteSettings.adsense_sidebar_slot || '')}
                    format={String(siteSettings.adsense_sidebar_format || 'rectangle')}
                    enabled={adsenseEnabled}
                    label="সাইডবার বিজ্ঞাপন"
                  />
                )}
            </aside>
          </div>
        )}

        {adsenseEnabled &&
          siteSettings.adsense_footer_enabled !== false &&
          siteSettings.adsense_footer_enabled !== 'false' &&
          Boolean(siteSettings.adsense_footer_slot) && (
            <AdSenseSlot
              publisherId={adsensePubId}
              slotId={String(siteSettings.adsense_footer_slot || '')}
              format={String(siteSettings.adsense_footer_format || 'auto')}
              enabled={adsenseEnabled}
              label="ফুটার বিজ্ঞাপন"
              className="mt-8"
            />
          )}
      </main>

      {/* Customizable Platform Footer */}
      <footer className="bg-white border-t border-slate-200 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-600">
          <div className="space-y-1.5 max-w-lg">
            <div className={`font-editorial text-base font-bold ${theme.text} inline-flex items-center gap-2`}>
              {hasLogo && (
                <img
                  src={String(siteSettings.site_logo_url)}
                  alt={String(siteSettings.site_name || 'জনকথা')}
                  className="h-6 max-w-[90px] rounded object-contain shrink-0"
                />
              )}
              <span>{String(siteSettings.site_name || 'জনকথা')}</span>
            </div>
            <p className="text-slate-500">
              {String(siteSettings.site_tagline || 'জনগণের সংবাদ, নিজের এলাকার কথা')}
            </p>
            {Boolean(siteSettings.footer_about) && (
              <p className="text-xs text-slate-600 leading-relaxed">{String(siteSettings.footer_about)}</p>
            )}
            <p className="text-[11px] text-slate-400">
              {String(siteSettings.footer_text || '© ২০২৬ জনকথা — স্বাধীন নাগরিক সাংবাদিকতা ও স্থানীয় সংবাদ প্ল্যাটফর্ম।')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => navigate({ type: 'signup' }, '/signup')} className="font-semibold text-emerald-700 hover:underline">
              আয় করুন
            </button>
            <button type="button" onClick={() => navigate({ type: 'admin' }, '/admin')} className="font-semibold text-slate-800 hover:underline">
              অ্যাডমিন প্যানেল
            </button>
            <button type="button" onClick={() => navigate({ type: 'legal' }, '/legal')} className="hover:underline">
              নীতিমালা ও শর্তাবলি
            </button>
            {siteSettings.contact_email && (
              <a href={`mailto:${String(siteSettings.contact_email)}`} className="hover:underline">
                {String(siteSettings.contact_email)}
              </a>
            )}
            {isSafeClientUrl(siteSettings.facebook_url) && (
              <a href={siteSettings.facebook_url} target="_blank" rel="noreferrer" className="hover:underline">
                Facebook
              </a>
            )}
            {isSafeClientUrl(siteSettings.youtube_url) && (
              <a href={siteSettings.youtube_url} target="_blank" rel="noreferrer" className="hover:underline">
                YouTube
              </a>
            )}
            {isSafeClientUrl(siteSettings.x_url) && (
              <a href={siteSettings.x_url} target="_blank" rel="noreferrer" className="hover:underline">
                X
              </a>
            )}
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation (Home, Explore, Create, Notifications, Profile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 h-14">
        <button
          type="button"
          onClick={() => navigate({ type: 'feed' }, '/')}
          className={`flex flex-col items-center justify-center text-[10px] font-medium ${
            route.type === 'feed' ? 'text-red-700' : 'text-slate-600'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="mt-0.5">হোম</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setSortMode('popular');
            navigate({ type: 'explore' }, '/explore');
          }}
          className={`flex flex-col items-center justify-center text-[10px] font-medium ${
            route.type === 'explore' ? 'text-red-700' : 'text-slate-600'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="mt-0.5">এক্সপ্লোর</span>
        </button>
        <button
          type="button"
          onClick={() => (user ? navigate({ type: 'create' }, '/create') : setAuthModalOpen(true))}
          className={`flex flex-col items-center justify-center text-[10px] font-medium ${
            route.type === 'create' ? 'text-red-700' : 'text-slate-600'
          }`}
        >
          <PenSquare className="w-5 h-5" />
          <span className="mt-0.5">প্রকাশ</span>
        </button>
        <button
          type="button"
          onClick={() => (user ? setNotificationsOpen(!notificationsOpen) : setAuthModalOpen(true))}
          className="relative flex flex-col items-center justify-center text-[10px] font-medium text-slate-600"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-4 w-3.5 h-3.5 rounded-full bg-red-700 text-[9px] text-white flex items-center justify-center font-tabular">
              {unreadCount}
            </span>
          )}
          <span className="mt-0.5">বার্তা</span>
        </button>
        <button
          type="button"
          onClick={() => (user ? navigate({ type: 'creator' }, '/creator') : setAuthModalOpen(true))}
          className={`flex flex-col items-center justify-center text-[10px] font-medium ${
            route.type === 'creator' ? 'text-red-700' : 'text-slate-600'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="mt-0.5">প্রোফাইল</span>
        </button>
      </nav>

      {/* Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">সংবাদ রিপোর্ট করুন</h3>
              <button type="button" onClick={() => setReportTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            {reportStatus ? (
              <div className="space-y-3">
                <p className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-lg">{reportStatus}</p>
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="w-full py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                >
                  ঠিক আছে
                </button>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-3">
                <p className="text-xs text-slate-500 truncate">{reportTarget.title}</p>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <textarea
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="অতিরিক্ত বিবরণ লিখুন (ঐচ্ছিক)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReportTarget(null)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium"
                  >
                    বাতিল
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold">
                    রিপোর্ট জমা দিন
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <ShareModal
        post={shareTarget}
        siteName={String(siteSettings.site_name || 'জনকথা')}
        onClose={() => setShareTarget(null)}
        onRecordShare={recordPostShare}
      />
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PlatformShell />
    </AuthProvider>
  );
}
