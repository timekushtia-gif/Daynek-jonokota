import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Copyright,
  Eye,
  Flag,
  MapPin,
  MessageSquare,
  Send,
  Share2,
  Trash2,
} from 'lucide-react';
import type { NewsPost, PostComment } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { REACTION_TYPES } from '../lib/bangladesh-locations.ts';
import { AdSenseSlot } from './AdSenseSlot.tsx';

interface ArticleDetailViewProps {
  slug: string;
  onBack: () => void;
  onOpenProfile: (username: string) => void;
  onRequireAuth: () => void;
  onReportPost: (post: NewsPost) => void;
  onSharePost?: (post: NewsPost) => void;
  adsenseConfig?: {
    enabled?: boolean;
    publisherId?: string;
    articleSlot?: string;
    articleFormat?: string;
    articleEnabled?: boolean;
    multiplexSlot?: string;
    multiplexEnabled?: boolean;
  };
}

export const ArticleDetailView: React.FC<ArticleDetailViewProps> = ({
  slug,
  onBack,
  onOpenProfile,
  onRequireAuth,
  onReportPost,
  onSharePost,
  adsenseConfig,
}) => {
  const { user, apiFetch } = useAuth();
  const [post, setPost] = useState<NewsPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Copyright claim modal state
  const [showCopyrightModal, setShowCopyrightModal] = useState(false);
  const [claimName, setClaimName] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimUrl, setClaimUrl] = useState('');
  const [claimDesc, setClaimDesc] = useState('');
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ post: NewsPost; comments: PostComment[] }>(`/api/posts/by-slug/${encodeURIComponent(slug)}`);
        if (!active) return;
        setPost(data.post);
        setComments(data.comments);

        // Dynamic SEO meta tags update
        document.title = data.post.seoTitle || `${data.post.title} | জনকথা`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && data.post.seoDescription) {
          metaDesc.setAttribute('content', data.post.seoDescription);
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : 'সংবাদটি লোড করা যায়নি');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
      document.title = 'জনকথা (Jonokotha) — স্থানীয় সংবাদ ও নাগরিক সাংবাদিকতা প্ল্যাটফর্ম';
    };
  }, [slug, apiFetch]);

  const handleReact = async (type: string) => {
    if (!user) return onRequireAuth();
    if (!post) return;
    try {
      const res = await apiFetch<{ myReaction: string | null; delta: number }>(`/api/posts/${post.id}/react`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      setPost((p) => (p ? { ...p, myReaction: res.myReaction, likesCount: Math.max(0, p.likesCount + res.delta) } : p));
    } catch {
      // handled silently
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return onRequireAuth();
    if (!post || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ comment: PostComment }>(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText.trim(), parentId: replyTo }),
      });
      setComments((prev) => [res.comment, ...prev]);
      setPost((p) => (p ? { ...p, commentsCount: p.commentsCount + 1 } : p));
      setCommentText('');
      setReplyTo(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'মন্তব্য পোস্ট করা যায়নি');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!post) return;
    try {
      await apiFetch(`/api/posts/${post.id}/comments/${commentId}`, { method: 'DELETE' });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      // ignore
    }
  };

  const handleCopyrightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return onRequireAuth();
    if (!post) return;
    try {
      await apiFetch(`/api/posts/${post.id}/copyright`, {
        method: 'POST',
        body: JSON.stringify({
          claimantName: claimName,
          claimantEmail: claimEmail,
          originalSourceUrl: claimUrl,
          description: claimDesc,
        }),
      });
      setClaimMsg('আপনার কপিরাইট অভিযোগটি নথিভুক্ত হয়েছে। অ্যাডমিন দ্রুত যাচাই করবেন।');
      setClaimName('');
      setClaimEmail('');
      setClaimUrl('');
      setClaimDesc('');
    } catch (err: unknown) {
      setClaimMsg(err instanceof Error ? err.message : 'অভিযোগ জমা দেওয়া যায়নি');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 animate-pulse space-y-4">
        <div className="h-5 w-32 bg-slate-200 rounded" />
        <div className="h-8 w-3/4 bg-slate-200 rounded" />
        <div className="h-64 bg-slate-100 rounded-lg" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
        <p className="text-sm text-red-700">{error || 'সংবাদটি পাওয়া যায়নি'}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium"
        >
          ফিডে ফিরে যান
        </button>
      </div>
    );
  }

  const rootComments = comments.filter((c) => !c.parentId);
  const repliesByParent = comments.reduce<Record<number, PostComment[]>>((acc, c) => {
    if (c.parentId) {
      acc[c.parentId] = acc[c.parentId] || [];
      acc[c.parentId].push(c);
    }
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        সংবাদ ফিডে ফিরুন
      </button>

      <article className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
            {post.isBreaking && <span className="font-bold text-red-700">ব্রেকিং নিউজ</span>}
            {post.isBreaking && <span>·</span>}
            <span className="font-medium text-slate-700">{post.postType}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {post.locationText || `${post.upazila}, ${post.district}`}
            </span>
            {post.eventOccurredAt && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  ঘটনার সময়: {post.eventOccurredAt}
                </span>
              </>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight text-balance">
            {post.title}
          </h1>

          {/* Author & metrics */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-y border-slate-100">
            <button
              type="button"
              onClick={() => onOpenProfile(post.author.username)}
              className="flex items-center gap-3 text-left"
            >
              <img
                src={post.author.avatarUrl || '/src/assets/images/avatar_citizen_reporter_1795635478721.jpg'}
                alt={post.author.fullName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-slate-200"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-900">{post.author.fullName}</span>
                  {post.author.verificationType !== 'none' && <BadgeCheck className="w-4 h-4 text-sky-600" />}
                </div>
                <p className="text-xs text-slate-500">@{post.author.username} · {post.author.district}</p>
              </div>
            </button>

            <div className="flex items-center gap-4 text-xs text-slate-500 font-tabular">
              <span className="inline-flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {post.validViewsCount.toLocaleString()} বৈধ ভিউ
              </span>
              <span>{post.likesCount.toLocaleString()} রিয়্যাকশন</span>
              <span>{post.commentsCount.toLocaleString()} মন্তব্য</span>
            </div>
          </div>

          {post.featuredImage && (
            <figure className="space-y-2">
              <img
                src={post.featuredImage}
                alt={post.title}
                referrerPolicy="no-referrer"
                className="w-full rounded-lg object-cover max-h-[460px]"
              />
              {post.mediaCaption && (
                <figcaption className="text-xs text-slate-500 italic">{post.mediaCaption}</figcaption>
              )}
            </figure>
          )}

          {post.videoUrl && (
            <div className="rounded-lg overflow-hidden bg-slate-950">
              <video controls src={post.videoUrl} className="w-full max-h-[440px]" />
            </div>
          )}

          <div className="prose prose-slate max-w-2xl text-[15px] sm:text-base leading-relaxed text-slate-800 whitespace-pre-line">
            {post.description}
          </div>

          {post.galleryImages && post.galleryImages.length > 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {post.galleryImages.slice(1).map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`${post.title} gallery ${i + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-36 object-cover rounded-lg border border-slate-200"
                />
              ))}
            </div>
          )}

          {(post.sourceReference || (post.gpsLat && post.gpsLng)) && (
            <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
              {post.sourceReference && <p>তথ্যসূত্র: {post.sourceReference}</p>}
              {post.gpsLat && post.gpsLng && (
                <p className="font-tabular">GPS স্থানাঙ্ক: {post.gpsLat}, {post.gpsLng}</p>
              )}
            </div>
          )}

          {/* Reactions + Report + Copyright */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {REACTION_TYPES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => handleReact(r.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    post.myReaction === r.key
                      ? 'border-red-300 bg-red-50 text-red-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="mr-1">{r.emoji}</span>
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!post.sharingDisabled && (
                <button
                  type="button"
                  onClick={() => {
                    if (onSharePost) {
                      onSharePost(post);
                    } else {
                      navigator.clipboard?.writeText(window.location.href);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  শেয়ার করুন
                </button>
              )}
              <button
                type="button"
                onClick={() => onReportPost(post)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-700"
              >
                <Flag className="w-3.5 h-3.5" />
                রিপোর্ট
              </button>
              <button
                type="button"
                onClick={() => setShowCopyrightModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Copyright className="w-3.5 h-3.5" />
                কপিরাইট অভিযোগ
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* In-Article & Multiplex Google AdSense Placements */}
      <AdSenseSlot
        enabled={Boolean(adsenseConfig?.enabled && adsenseConfig?.articleEnabled)}
        publisherId={adsenseConfig?.publisherId}
        slotId={adsenseConfig?.articleSlot}
        format={adsenseConfig?.articleFormat || 'in-article'}
        label="In-Article Ad"
      />
      <AdSenseSlot
        enabled={Boolean(adsenseConfig?.enabled && adsenseConfig?.multiplexEnabled)}
        publisherId={adsenseConfig?.publisherId}
        slotId={adsenseConfig?.multiplexSlot}
        format="autorelaxed"
        label="Recommended Ads"
      />

      {/* Comments Section */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-red-700" />
            পাঠক মন্তব্য ({comments.length})
          </h3>
        </div>

        {post.commentsDisabled ? (
          <p className="text-xs text-slate-500">এই সংবাদে মন্তব্য করা অ্যাডমিন কর্তৃক বন্ধ রাখা হয়েছে।</p>
        ) : (
          <form onSubmit={handleSubmitComment} className="space-y-2">
            {replyTo && (
              <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg">
                <span>মন্তব্যের উত্তর দিচ্ছেন (#{replyTo})</span>
                <button type="button" onClick={() => setReplyTo(null)} className="text-red-700 font-medium">
                  বাতিল
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={user ? 'আপনার গঠনমূলক মতামত লিখুন...' : 'মন্তব্য করতে সাইন ইন করুন'}
                className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:border-red-700"
              />
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                পাঠান
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-100">
          {rootComments.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">এখনো কোনো মন্তব্য নেই। প্রথম মন্তব্য করুন।</p>
          ) : (
            rootComments.map((c) => (
              <div key={c.id} className="py-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <img
                      src={c.author.avatarUrl || '/src/assets/images/avatar_citizen_reporter_1795635478721.jpg'}
                      alt={c.author.fullName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-semibold text-slate-900">{c.author.fullName}</span>
                        {c.isPinned && <span className="text-red-700 font-semibold">· পিন করা</span>}
                        {c.aiFlagged && <span className="text-amber-700">· রিভিউ চিহ্নিত</span>}
                      </div>
                      <p className="text-sm text-slate-700 mt-1">{c.content}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                        <button type="button" onClick={() => setReplyTo(c.id)} className="hover:text-slate-900 font-medium">
                          উত্তর দিন
                        </button>
                        {(user?.id === c.userId || ['super_admin', 'admin', 'moderator'].includes(user?.role || '')) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            className="inline-flex items-center gap-1 text-red-700 hover:underline"
                          >
                            <Trash2 className="w-3 h-3" /> মুছুন
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {(repliesByParent[c.id] || []).map((rep) => (
                  <div key={rep.id} className="ml-10 pl-3 border-l border-slate-200 flex items-start gap-2.5 pt-2">
                    <img
                      src={rep.author.avatarUrl || '/src/assets/images/avatar_citizen_reporter_1795635478721.jpg'}
                      alt={rep.author.fullName}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-900">{rep.author.fullName}</span>
                      <p className="text-xs text-slate-700 mt-0.5">{rep.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </section>

      {showCopyrightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">কপিরাইট অভিযোগ দাখিল</h3>
            {claimMsg && <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg">{claimMsg}</p>}
            <form onSubmit={handleCopyrightSubmit} className="space-y-3">
              <input
                type="text"
                required
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
                placeholder="স্বত্বাধিকারীর নাম"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                required
                value={claimEmail}
                onChange={(e) => setClaimEmail(e.target.value)}
                placeholder="যোগাযোগের ইমেইল"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="url"
                required
                value={claimUrl}
                onChange={(e) => setClaimUrl(e.target.value)}
                placeholder="মূল সোর্স URL (https://...)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                required
                rows={3}
                value={claimDesc}
                onChange={(e) => setClaimDesc(e.target.value)}
                placeholder="কপিরাইট লঙ্ঘনের বিবরণ লিখুন"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCopyrightModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium"
                >
                  বন্ধ করুন
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold"
                >
                  অভিযোগ জমা দিন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
