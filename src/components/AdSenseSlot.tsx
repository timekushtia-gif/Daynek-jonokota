import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const PUB_ID_REGEX = /^ca-pub-\d{10,20}$/;
const SLOT_ID_REGEX = /^\d{6,20}$/;

export function useAdSenseScript(publisherId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !publisherId || !PUB_ID_REGEX.test(publisherId.trim())) {
      return;
    }

    const cleanId = publisherId.trim();
    const existing = document.querySelector<HTMLScriptElement>('script[data-jonokotha-adsense="true"]');
    if (existing) {
      if (existing.dataset.clientId === cleanId) return;
      existing.remove();
    }

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cleanId)}`;
    script.dataset.jonokothaAdsense = 'true';
    script.dataset.clientId = cleanId;
    document.head.appendChild(script);
  }, [publisherId, enabled]);
}

interface AdSenseSlotProps {
  publisherId?: string;
  slotId?: string;
  format?: string;
  enabled?: boolean;
  label?: string;
  className?: string;
}

export const AdSenseSlot: React.FC<AdSenseSlotProps> = ({
  publisherId,
  slotId,
  format = 'auto',
  enabled = true,
  label = 'Google AdSense',
  className = '',
}) => {
  const pushedRef = useRef(false);
  const cleanPub = publisherId?.trim() || '';
  const cleanSlot = slotId?.trim() || '';
  const validConfig = enabled && PUB_ID_REGEX.test(cleanPub) && SLOT_ID_REGEX.test(cleanSlot);

  useEffect(() => {
    if (!validConfig || pushedRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      // AdSense script still loading or blocked by browser extension
    }
  }, [validConfig, cleanPub, cleanSlot]);

  if (!validConfig) return null;

  const isInArticle = format === 'in-article';

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-3 text-center overflow-hidden ${className}`}>
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">{label} · বিজ্ঞাপন</div>
      <ins
        className="adsbygoogle block w-full min-h-[90px]"
        data-ad-client={cleanPub}
        data-ad-slot={cleanSlot}
        data-ad-format={isInArticle ? 'fluid' : format}
        {...(isInArticle ? { 'data-ad-layout': 'in-article' } : { 'data-full-width-responsive': 'true' })}
      />
    </div>
  );
};
