import React, { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Eye, Heart, MapPin, MessageCircle, UserCheck, UserPlus } from 'lucide-react';
import type { NewsPost } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { CREATOR_LEVELS } from '../lib/bangladesh-locations.ts';
import { NewsCard } from './NewsCard.tsx';

interface PublicProfileData {
  id: number;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  division: string | null;
  district: string | null;
  upazila: string | null;
  unionWard: string | null;
  areaDetails: string | null;
  verificationType: string;
  isFeaturedCreator: boolean;
  creatorLevel: number;
  monetizationStatus: string;
  totalFollowers: number;
  totalFollowing: number;
  totalPosts: number;
  totalViews: number;
  validViews: number;
  totalLikes: number;
  totalEarningsBdt: number;
  isFollowing: boolean;
}

interface PublicProfileViewProps {
  username: string;
  onBack: () => void;
  onOpenArticle: (slug: string) => void;
  onRequireAuth: () => void;
  onReportPost: (post: NewsPost) => void;
  onFilterTag: (tag: string) => void;
  onSharePost?: (post: NewsPost) => void;
}

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({
  username,
  onBack,
  onOpenArticle,
  onRequireAuth,
  onReportPost,
  onFilterTag,
  onSharePost,
}) => {
  const { user, apiFetch } = useAuth();
  const [creator, setCreator] = useState<PublicProfileData | null>(null);
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ creator: PublicProfileData; posts: NewsPost[] }>(
          `/api/creators/${encodeURIComponent(username)}`
        );
        if (!active) return;
        setCreator(res.creator);
        setPosts(res.posts);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : 'প্রোফাইল পাওয়া যায়নি');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [username, apiFetch]);

  const handleFollow = async () => {
    if (!user) return onRequireAuth();
    if (!creator) return;
    try {
      const res = await apiFetch<{ isFollowing: boolean }>(`/api/creators/${creator.id}/follow`, { method: 'POST' });
      setCreator((c) =>
        c
          ? {
              ...c,
              isFollowing: res.isFollowing,
              totalFollowers: Math.max(0, c.totalFollowers + (res.isFollowing ? 1 : -1)),
            }
          : null
      );
    } catch {
      // ignore
    }
  };

  if (loading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 animate-pulse h-64" />;
  }

  if (error || !creator) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
        <p className="text-sm text-red-700">{error || 'প্রোফাইল পাওয়া যায়নি'}</p>
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs">
          ফিরে যান
        </button>
      </div>
    );
  }

  const levelObj = CREATOR_LEVELS.find((l) => l.level === creator.creatorLevel) || CREATOR_LEVELS[0];

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        হোম ফিডে ফিরুন
      </button>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Cover Photo */}
        <div className="h-44 sm:h-56 bg-slate-200 relative">
          {creator.coverUrl ? (
            <img
              src={creator.coverUrl}
              alt={`${creator.fullName} cover`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-slate-800 to-slate-900" />
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 relative z-10">
            <div className="flex items-end gap-4">
              <img
                src={creator.avatarUrl || '/src/assets/images/avatar_citizen_reporter_1795635478721.jpg'}
                alt={creator.fullName}
                referrerPolicy="no-referrer"
                className="w-24 h-24 rounded-full object-cover border-4 border-white bg-white shadow-sm"
              />
              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900">{creator.fullName}</h1>
                  {creator.verificationType !== 'none' && (
                    <BadgeCheck className="w-5 h-5 text-sky-600" aria-label="Verified" />
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  @{creator.username} · Level {creator.creatorLevel} ({levelObj.bnName}) · মনিটাইজেশন: {creator.monetizationStatus}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFollow}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  creator.isFollowing
                    ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    : 'bg-red-700 text-white hover:bg-red-800'
                }`}
              >
                {creator.isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {creator.isFollowing ? 'ফলোয়িং' : 'ফলো করুন'}
              </button>
              <button
                type="button"
                onClick={() => setContactOpen(!contactOpen)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <MessageCircle className="w-4 h-4" />
                বার্তা
              </button>
            </div>
          </div>

          {contactOpen && (
            <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
              সাংবাদিক/ক্রিয়েটর @{creator.username}-এর সাথে নিউজ টিপস শেয়ার করতে এই এলাকার রিপোর্ট বা মন্তব্য বিভাগে উল্লেখ করুন।
            </div>
          )}

          {creator.bio && <p className="mt-4 text-sm text-slate-700 leading-relaxed max-w-2xl">{creator.bio}</p>}

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
            <MapPin className="w-3.5 h-3.5 text-red-700" />
            <span>
              {[creator.unionWard, creator.upazila, creator.district, creator.division].filter(Boolean).join(', ')}
            </span>
            {creator.areaDetails && (
              <>
                <span>·</span>
                <span>{creator.areaDetails}</span>
              </>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 mt-5 pt-5 border-t border-slate-100">
            <div>
              <div className="text-xs text-slate-500">ফলোয়ার</div>
              <div className="text-base font-bold text-slate-900 font-tabular">{creator.totalFollowers.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">ফলোয়িং</div>
              <div className="text-base font-bold text-slate-900 font-tabular">{creator.totalFollowing.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">মোট সংবাদ</div>
              <div className="text-base font-bold text-slate-900 font-tabular">{creator.totalPosts.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 flex items-center gap-1"><Eye className="w-3 h-3" /> বৈধ ভিউ</div>
              <div className="text-base font-bold text-slate-900 font-tabular">{creator.validViews.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 flex items-center gap-1"><Heart className="w-3 h-3" /> মোট লাইক</div>
              <div className="text-base font-bold text-slate-900 font-tabular">{creator.totalLikes.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">মোট আয়</div>
              <div className="text-base font-bold text-emerald-700 font-tabular">৳{creator.totalEarningsBdt.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">প্রকাশিত সংবাদসমূহ ({posts.length})</h2>
        {posts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            এই ক্রিয়েটর এখনো কোনো সংবাদ প্রকাশ করেননি।
          </div>
        ) : (
          posts.map((p) => (
            <NewsCard
              key={p.id}
              post={p}
              onOpenArticle={onOpenArticle}
              onOpenProfile={() => {}}
              onReact={async (postId, type) => {
                if (!user) return onRequireAuth();
                await apiFetch(`/api/posts/${postId}/react`, { method: 'POST', body: JSON.stringify({ type }) });
              }}
              onSave={async (postId) => {
                if (!user) return onRequireAuth();
                await apiFetch(`/api/posts/${postId}/save`, { method: 'POST' });
              }}
              onShare={(post) => {
                if (onSharePost) {
                  onSharePost(post);
                } else {
                  navigator.clipboard?.writeText(`${window.location.origin}/news/${post.slug}`);
                }
              }}
              onFollow={handleFollow}
              onReport={onReportPost}
              onFilterTag={onFilterTag}
            />
          ))
        )}
      </div>
    </div>
  );
};
