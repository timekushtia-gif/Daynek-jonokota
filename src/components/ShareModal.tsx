import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Mail, MessageCircle, Share2, X } from 'lucide-react';
import type { NewsPost } from '../types.ts';

interface ShareModalProps {
  post: NewsPost | null;
  siteName?: string;
  onClose: () => void;
  onRecordShare: (post: NewsPost) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ post, siteName = 'জনকথা', onClose, onRecordShare }) => {
  const [copied, setCopied] = useState(false);

  if (!post) return null;

  const shareUrl = `${window.location.origin}/news/${encodeURIComponent(post.slug)}`;
  const shareTitle = `${post.title} — ${siteName}`;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(shareTitle);
  const encodedCombined = encodeURIComponent(`${shareTitle}\n${shareUrl}`);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      onRecordShare(post);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: shareTitle,
        text: post.summary || post.title,
        url: shareUrl,
      });
      onRecordShare(post);
    } catch {
      // user cancelled native share sheet
    }
  };

  const platforms = [
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      badgeClass: 'bg-blue-600 text-white',
    },
    {
      name: 'WhatsApp',
      href: `https://api.whatsapp.com/send?text=${encodedCombined}`,
      badgeClass: 'bg-emerald-600 text-white',
    },
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      badgeClass: 'bg-sky-600 text-white',
    },
    {
      name: 'X (Twitter)',
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      badgeClass: 'bg-slate-900 text-white',
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      badgeClass: 'bg-blue-800 text-white',
    },
    {
      name: 'Email',
      href: `mailto:?subject=${encodedTitle}&body=${encodedCombined}`,
      badgeClass: 'bg-slate-700 text-white',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-red-700" />
            <h3 className="text-sm font-bold text-slate-900">যেকোনো প্ল্যাটফর্মে সংবাদ শেয়ার করুন</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close share dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <p className="text-xs font-bold text-slate-900 line-clamp-2">{post.title}</p>
            <p className="text-[11px] text-slate-500 truncate">{shareUrl}</p>
          </div>

          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 inline-flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              ফোন বা ডিভাইসের সব অ্যাপে শেয়ার করুন (Messenger, IMO, Viber...)
            </button>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {platforms.map((p) => (
              <a
                key={p.name}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onRecordShare(post)}
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-between gap-1.5 hover:opacity-90 transition-opacity ${p.badgeClass}`}
              >
                <span className="truncate">{p.name}</span>
                <ExternalLink className="w-3 h-3 shrink-0 opacity-80" />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 font-tabular"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="text-emerald-700">কপি হয়েছে</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>লিঙ্ক কপি</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <a
              href={`sms:?body=${encodedCombined}`}
              onClick={() => onRecordShare(post)}
              className="inline-flex items-center gap-1 hover:text-slate-800 hover:underline"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              SMS দিয়ে পাঠান
            </a>
            <a
              href={`mailto:?subject=${encodedTitle}&body=${encodedCombined}`}
              onClick={() => onRecordShare(post)}
              className="inline-flex items-center gap-1 hover:text-slate-800 hover:underline"
            >
              <Mail className="w-3.5 h-3.5" />
              ইমেইল করুন
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
