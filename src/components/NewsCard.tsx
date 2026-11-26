import React, { useState } from 'react';
import {
  BadgeCheck,
  Bookmark,
  Eye,
  Flag,
  MessageSquare,
  Newspaper,
  Share2,
  ThumbsUp,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import type { NewsPost } from '../types.ts';
import { REACTION_TYPES } from '../lib/bangladesh-locations.ts';

interface NewsCardProps {
  post: NewsPost;
  onOpenArticle: (slug: string) => void;
  onOpenProfile: (username: string) => void;
  onReact: (postId: number, type: string) => void;
  onSave: (postId: number) => void;
  onShare: (post: NewsPost) => void;
  onFollow: (authorId: number) => void;
  onReport: (post: NewsPost) => void;
  onFilterTag: (tag: string) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  post,
  onOpenArticle,
  onOpenProfile,
  onReact,
  onSave,
  onShare,
  onFollow,
  onReport,
  onFilterTag,
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const activeReaction = REACTION_TYPES.find((r) => r.key === post.myReaction);
  const publishedDate = new Date(post.publishedAt).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <article className="rounded-xl bg-white border border-slate-200 overflow-hidden transition-colors hover:border-slate-300">
      {/* Author Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onOpenProfile(post.author.username)}
            className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0"
          >
            {post.author.avatarUrl ? (
              <img
                src={post.author.avatarUrl}
                alt={post.author.fullName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-slate-600">
                {post.author.fullName.slice(0, 1)}
              </div>
            )}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onOpenProfile(post.author.username)}
                className="text-sm font-semibold text-slate-900 hover:underline truncate"
              >
                {post.author.fullName}
              </button>
              {post.author.verificationType !== 'none' && (
                <BadgeCheck className="w-4 h-4 text-sky-600 shrink-0" aria-label="Verified Creator" />
              )}
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500 font-medium">Level {post.author.creatorLevel}</span>
            </div>
            {/* Unboxed clean metadata with typographic separators */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 flex-wrap">
              <span>{post.locationText || `${post.upazila || ''}, ${post.district || ''}`}</span>
              <span aria-hidden="true">·</span>
              <span>{publishedDate}</span>
              <span aria-hidden="true">·</span>
              <span>{post.postType}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onFollow(post.author.id)}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            post.isFollowingAuthor
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              : 'text-red-700 border border-red-200 hover:bg-red-50'
          }`}
        >
          {post.isFollowingAuthor ? (
            <>
              <UserCheck className="w-3.5 h-3.5" />
              ফলোয়িং
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              ফলো
            </>
          )}
        </button>
      </div>

      {/* Headline & Summary */}
      <div className="px-5 pb-3">
        {post.isBreaking && (
          <div className="mb-1.5 text-xs font-bold tracking-wide text-red-700">
            ব্রেকিং নিউজ · সদ্যপ্রাপ্ত
          </div>
        )}
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug text-balance">
          <button
            type="button"
            onClick={() => onOpenArticle(post.slug)}
            className="text-left hover:text-red-800 transition-colors"
          >
            {post.title}
          </button>
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-3">
          {post.summary || post.description}
        </p>

        {/* Clean inline hashtag text links (Zero-pill discipline) */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-2.5 flex items-center gap-3 flex-wrap text-xs text-sky-700">
            {post.tags.slice(0, 5).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onFilterTag(tag)}
                className="hover:underline font-medium"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Featured Image with Zero-Broken-Image Policy */}
      {post.featuredImage && (
        <button
          type="button"
          onClick={() => onOpenArticle(post.slug)}
          className="block w-full text-left bg-slate-100 border-y border-slate-100"
        >
          {!imgFailed ? (
            <img
              src={post.featuredImage}
              alt={post.title}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="w-full aspect-16/9 object-cover"
            />
          ) : (
            <div className="w-full aspect-16/9 bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-6 text-slate-500">
              <Newspaper className="w-8 h-8 mb-2 text-slate-400" />
              <span className="text-xs font-medium text-center max-w-sm">{post.title}</span>
            </div>
          )}
          {post.mediaCaption && (
            <div className="px-5 py-2 text-xs text-slate-500 bg-slate-50/80 border-t border-slate-100">
              {post.mediaCaption}
            </div>
          )}
        </button>
      )}

      {/* Metrics Summary Strip */}
      <div className="px-5 py-2.5 flex items-center justify-between text-xs text-slate-500 border-b border-slate-100">
        <div className="flex items-center gap-3 font-tabular">
          <span>{post.likesCount.toLocaleString()} রিয়্যাকশন</span>
          <span>·</span>
          <span>{post.commentsCount.toLocaleString()} মন্তব্য</span>
          <span>·</span>
          <span>{post.sharesCount.toLocaleString()} শেয়ার</span>
        </div>
        <div className="flex items-center gap-1 font-tabular">
          <Eye className="w-3.5 h-3.5 text-slate-400" />
          <span>{post.validViewsCount.toLocaleString()} পঠিত</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-3 py-1.5 flex items-center justify-between gap-1 relative">
        <div
          className="relative"
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setShowReactions(false)}
        >
          <button
            type="button"
            onClick={() => onReact(post.id, activeReaction ? activeReaction.key : 'like')}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeReaction ? 'text-red-700 bg-red-50' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {activeReaction ? (
              <span className="text-sm">{activeReaction.emoji}</span>
            ) : (
              <ThumbsUp className="w-4 h-4" />
            )}
            <span>{activeReaction ? activeReaction.label : 'Like'}</span>
          </button>

          {showReactions && (
            <div className="absolute bottom-full left-0 mb-1 z-20 flex items-center gap-1 rounded-xl bg-white border border-slate-200 shadow-lg px-2 py-1.5">
              {REACTION_TYPES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => {
                    onReact(post.id, r.key);
                    setShowReactions(false);
                  }}
                  title={r.label}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-lg transition-transform hover:scale-110"
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpenArticle(post.slug)}
          className="min-h-[40px] px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap"
        >
          <MessageSquare className="w-4 h-4" />
          <span>মন্তব্য</span>
        </button>

        {!post.sharingDisabled && (
          <button
            type="button"
            onClick={() => onShare(post)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            <Share2 className="w-4 h-4" />
            <span>শেয়ার</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onSave(post.id)}
          className={`min-h-[40px] px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 text-xs font-medium transition-colors whitespace-nowrap ${
            post.isSaved ? 'text-sky-700 bg-sky-50' : 'text-slate-600 hover:bg-slate-100'
          }`}
          aria-label="Save post"
        >
          <Bookmark className="w-4 h-4" />
          <span className="hidden sm:inline">{post.isSaved ? 'সেভড' : 'সেভ'}</span>
        </button>

        <button
          type="button"
          onClick={() => onReport(post)}
          className="min-h-[40px] px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-700 transition-colors whitespace-nowrap"
          aria-label="Report news"
        >
          <Flag className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
};
