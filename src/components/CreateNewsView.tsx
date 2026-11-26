import React, { useState } from 'react';
import { Sparkles, Eye, Send, Save, MapPin, CheckCircle2, ImagePlus, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BANGLADESH_LOCATIONS, POST_TYPES } from '../lib/bangladesh-locations.ts';
import { processGalleryImageFile } from '../lib/image-upload.ts';

interface CreateNewsViewProps {
  onPublished: (slug: string) => void;
  onRequireAuth: () => void;
}

export const CreateNewsView: React.FC<CreateNewsViewProps> = ({ onPublished, onRequireAuth }) => {
  const { user, apiFetch } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [summary, setSummary] = useState('');
  const [postType, setPostType] = useState('Local News');
  const [isBreaking, setIsBreaking] = useState(false);

  const [division, setDivision] = useState(user?.division || 'Dhaka');
  const [district, setDistrict] = useState(user?.district || 'Dhaka');
  const [upazila, setUpazila] = useState(user?.upazila || 'Savar');
  const [unionWard, setUnionWard] = useState(user?.unionWard || '');
  const [locationText, setLocationText] = useState('');
  const [gpsLat, setGpsLat] = useState('');
  const [gpsLng, setGpsLng] = useState('');

  const [featuredImage, setFeaturedImage] = useState('/src/assets/images/news_dhaka_metro_1795635477163.jpg');
  const [uploadedGalleryImages, setUploadedGalleryImages] = useState<string[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [galleryInput, setGalleryInput] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [eventOccurredAt, setEventOccurredAt] = useState('');
  const [tagsInput, setTagsInput] = useState('বাংলাদেশ, স্থানীয়_সংবাদ');
  const [keywords, setKeywords] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  const [previewMode, setPreviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    summary: string;
    titleSuggestions: string[];
    correctedBody: string;
    suggestedTags: string[];
    keywords: string;
    riskScore: number;
    moderationNote: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const divObj = BANGLADESH_LOCATIONS.find((d) => d.name === division) || BANGLADESH_LOCATIONS[0];
  const distObj = divObj.districts.find((d) => d.name === district) || divObj.districts[0];

  const handleDetectGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setGpsLat(pos.coords.latitude.toFixed(5));
      setGpsLng(pos.coords.longitude.toFixed(5));
    });
  };

  const handleAiAssist = async () => {
    if (!user) return onRequireAuth();
    setAiLoading(true);
    setError(null);
    try {
      const res = await apiFetch<NonNullable<typeof aiResult>>('/api/posts/ai/editorial-assist', {
        method: 'POST',
        body: JSON.stringify({ title, description, category: postType, locationText: `${upazila}, ${district}` }),
      });
      setAiResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI সহকারী চালু করা যায়নি।');
    } finally {
      setAiLoading(false);
    }
  };

  const handleFeaturedGalleryPick = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setUploadingMedia(true);
    try {
      const dataUri = await processGalleryImageFile(file, { maxDimension: 1280, quality: 0.82 });
      setFeaturedImage(dataUri);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'গ্যালারি থেকে ছবি আপলোড করা যায়নি।');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleMultiGalleryPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploadingMedia(true);
    try {
      const remainingSlots = Math.max(0, 7 - uploadedGalleryImages.length);
      const selected = Array.from(files).slice(0, remainingSlots);
      if (selected.length === 0) {
        setError('সর্বোচ্চ ৭টি অতিরিক্ত গ্যালারি ছবি যোগ করা যাবে।');
        return;
      }
      const processed = await Promise.all(
        selected.map((f) => processGalleryImageFile(f, { maxDimension: 1200, quality: 0.78 }))
      );
      setUploadedGalleryImages((prev) => [...prev, ...processed].slice(0, 7));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'গ্যালারির ছবিগুলো প্রসেস করা যায়নি।');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSubmit = async (action: 'submit' | 'draft') => {
    if (!user) return onRequireAuth();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const urlGalleryImages = galleryInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const combinedGallery = Array.from(
        new Set([featuredImage, ...uploadedGalleryImages, ...urlGalleryImages].filter(Boolean))
      ).slice(0, 8);
      const tags = tagsInput
        .split(',')
        .map((s) => s.trim().replace(/^#/, ''))
        .filter(Boolean);

      const res = await apiFetch<{ post: { slug: string; status: string } }>('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          summary,
          category: postType,
          postType,
          action,
          isBreaking,
          division,
          district,
          upazila,
          unionWard,
          locationText,
          gpsLat,
          gpsLng,
          featuredImage,
          galleryImages: combinedGallery,
          videoUrl: videoUrl || undefined,
          mediaCaption,
          sourceReference,
          eventOccurredAt,
          tags,
          keywords,
          seoTitle,
          seoDescription,
        }),
      });

      if (res.post.status === 'published') {
        onPublished(res.post.slug);
      } else {
        setSuccessMsg(
          action === 'draft'
            ? 'খসড়া (Draft) সংরক্ষিত হয়েছে। ক্রিয়েটর ড্যাশবোর্ড থেকে পরে প্রকাশ করতে পারবেন।'
            : 'সংবাদটি মডারেটর/অ্যাডমিন রিভিউয়ের জন্য জমা হয়েছে।'
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'সংবাদ জমা দেওয়া যায়নি।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">নতুন সংবাদ প্রতিবেদন লিখুন</h1>
          <p className="text-xs text-slate-500 mt-0.5">সঠিক তথ্য, স্থান ও সূত্রসহ আপনার এলাকার নাগরিক সংবাদ প্রকাশ করুন</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewMode(!previewMode)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Eye className="w-3.5 h-3.5" />
            {previewMode ? 'এডিটর মোড' : 'প্রিভিউ দেখুন'}
          </button>
          <button
            type="button"
            disabled={aiLoading}
            onClick={handleAiAssist}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            {aiLoading ? 'AI বিশ্লেষণ চলছে...' : 'AI সম্পাদকীয় সহায়তা'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>}
      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {aiResult && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">AI সম্পাদকীয় পরামর্শ (চূড়ান্ত সিদ্ধান্ত আপনার ও অ্যাডমিনের)</span>
            <span className="text-xs font-tabular font-semibold text-slate-600">ঝুঁকি স্কোর: {aiResult.riskScore}/100</span>
          </div>
          {aiResult.titleSuggestions.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600">শিরোনাম প্রস্তাবনা (ক্লিক করে ব্যবহার করুন):</p>
              <div className="flex flex-col gap-1.5">
                {aiResult.titleSuggestions.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTitle(t)}
                    className="text-left text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:border-red-400"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {aiResult.summary && (
              <button
                type="button"
                onClick={() => setSummary(aiResult.summary)}
                className="text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100"
              >
                AI সারসংক্ষেপ যোগ করুন
              </button>
            )}
            {aiResult.correctedBody && (
              <button
                type="button"
                onClick={() => setDescription(aiResult.correctedBody)}
                className="text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100"
              >
                বানান সংশোধিত লেখা প্রয়োগ করুন
              </button>
            )}
            {aiResult.suggestedTags.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTagsInput(aiResult.suggestedTags.join(', '));
                  setKeywords(aiResult.keywords);
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100"
              >
                অটো-ট্যাগ ও SEO কীওয়ার্ড বসান
              </button>
            )}
          </div>
          <p className="text-xs text-slate-600">{aiResult.moderationNote}</p>
        </div>
      )}

      {previewMode ? (
        <div className="rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="text-xs text-slate-500">
            {isBreaking && <span className="text-red-700 font-bold mr-2">ব্রেকিং নিউজ ·</span>}
            {postType} · {upazila}, {district}
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{title || 'সংবাদের শিরোনাম'}</h2>
          {featuredImage && <img src={featuredImage} alt={title} className="w-full max-h-80 object-cover rounded-lg" />}
          {uploadedGalleryImages.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {uploadedGalleryImages.map((img, i) => (
                <img key={i} src={img} alt="" className="w-full h-24 object-cover rounded-lg border border-slate-200" />
              ))}
            </div>
          )}
          <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{description || 'সংবাদের বিস্তারিত...'}</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">সংবাদের শিরোনাম *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="যেমন: কুষ্টিয়ার কুমারখালীতে নতুন সেতু নির্মাণের কাজ শুরু"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">সংবাদের ধরন / ক্যাটাগরি *</label>
              <select
                value={postType}
                onChange={(e) => setPostType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white"
              >
                {POST_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">বিস্তারিত প্রতিবেদন *</label>
            <textarea
              rows={7}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ঘটনার বিবরণ, স্থান, সময় ও প্রত্যক্ষদর্শীর বক্তব্য লিখুন..."
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">সংক্ষিপ্ত সারসংক্ষেপ</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="ফিডে দেখানোর জন্য ১-২ লাইনের সারসংক্ষেপ"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
            />
          </div>

          {/* Location Hierarchy */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-red-700" />
                ঘটনার স্থান ও GPS তথ্য
              </span>
              <button
                type="button"
                onClick={handleDetectGps}
                className="text-xs font-medium text-sky-700 hover:underline"
              >
                বর্তমান GPS লোকেশন নিন
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <select
                value={division}
                onChange={(e) => {
                  const d = BANGLADESH_LOCATIONS.find((x) => x.name === e.target.value) || BANGLADESH_LOCATIONS[0];
                  setDivision(d.name);
                  setDistrict(d.districts[0].name);
                  setUpazila(d.districts[0].upazilas[0]);
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
                  const dt = divObj.districts.find((x) => x.name === e.target.value) || divObj.districts[0];
                  setDistrict(dt.name);
                  setUpazila(dt.upazilas[0]);
                }}
                className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs bg-white"
              >
                {divObj.districts.map((d) => (
                  <option key={d.name} value={d.name}>{d.bnName}</option>
                ))}
              </select>
              <select
                value={upazila}
                onChange={(e) => setUpazila(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs bg-white"
              >
                {distObj.upazilas.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <input
                type="text"
                value={unionWard}
                onChange={(e) => setUnionWard(e.target.value)}
                placeholder="ইউনিয়ন / ওয়ার্ড"
                className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs bg-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="সুনির্দিষ্ট স্থান (যেমন: বাজার রোড)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
              />
              <input
                type="text"
                value={eventOccurredAt}
                onChange={(e) => setEventOccurredAt(e.target.value)}
                placeholder="ঘটনার তারিখ ও সময় (২০২৬-১১-২৫ সকাল ১০টা)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
              />
              <input
                type="text"
                value={gpsLat && gpsLng ? `${gpsLat}, ${gpsLng}` : ''}
                readOnly
                placeholder="GPS স্থানাঙ্ক (ঐচ্ছিক)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs bg-slate-100 font-tabular"
              />
            </div>
          </div>

          {/* Media & Gallery Photo Upload */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5">
                <ImagePlus className="w-4 h-4 text-red-700" />
                সংবাদের ছবি ও মিডিয়া (সরাসরি গ্যালারি থেকে আপলোড করুন)
              </div>
              {uploadingMedia && <span className="text-[11px] font-medium text-emerald-700">ছবি প্রসেস হচ্ছে...</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Featured Photo Gallery Upload */}
              <div className="bg-white rounded-lg border border-slate-200 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-800">প্রধান ছবি (Featured Photo)</label>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">
                    <Upload className="w-3.5 h-3.5" />
                    গ্যালারি থেকে ছবি নিন
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => {
                        handleFeaturedGalleryPick(e.target.files?.[0] || null);
                        e.currentTarget.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {featuredImage && (
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                    <img src={featuredImage} alt="প্রধান ছবি প্রিভিউ" className="w-full h-40 object-cover" />
                    <button
                      type="button"
                      onClick={() => setFeaturedImage('')}
                      className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-900/80 text-white text-[11px] font-semibold hover:bg-red-700"
                    >
                      মুছুন
                    </button>
                  </div>
                )}

                <input
                  type="text"
                  value={featuredImage}
                  onChange={(e) => setFeaturedImage(e.target.value)}
                  placeholder="অথবা ছবির URL দিন (/src/assets/... বা https://...)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                />
                <div className="flex flex-wrap gap-2 text-[11px] text-sky-700">
                  <span className="text-slate-400">দ্রুত নমুনা:</span>
                  <button type="button" onClick={() => setFeaturedImage('/src/assets/images/news_dhaka_metro_1795635477163.jpg')} className="hover:underline">ঢাকা</button>
                  <button type="button" onClick={() => setFeaturedImage('/src/assets/images/news_savar_monsoon_1795635478388.jpg')} className="hover:underline">বৃষ্টি</button>
                  <button type="button" onClick={() => setFeaturedImage('/src/assets/images/news_kushtia_harvest_1795635479082.jpg')} className="hover:underline">কৃষি</button>
                  <button type="button" onClick={() => setFeaturedImage('/src/assets/images/news_campus_innovation_1795635478448.jpg')} className="hover:underline">ক্যাম্পাস</button>
                </div>
              </div>

              {/* Multiple Gallery Photos Upload */}
              <div className="bg-white rounded-lg border border-slate-200 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-800">
                    অতিরিক্ত গ্যালারি ছবি ({uploadedGalleryImages.length}/7)
                  </label>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 text-xs font-semibold hover:bg-slate-100">
                    <ImagePlus className="w-3.5 h-3.5 text-red-700" />
                    একাধিক ছবি যোগ করুন
                    <input
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => {
                        handleMultiGalleryPick(e.target.files);
                        e.currentTarget.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {uploadedGalleryImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedGalleryImages.map((imgSrc, idx) => (
                      <div key={idx} className="relative rounded-md overflow-hidden border border-slate-200 h-20 bg-slate-100">
                        <img src={imgSrc} alt={`গ্যালারি ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setUploadedGalleryImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-red-700"
                          aria-label="Remove gallery photo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 py-5 text-center border border-dashed border-slate-200 rounded-lg">
                    ফোন বা কম্পিউটারের গ্যালারি থেকে সংবাদের একাধিক ছবি এখানে যোগ করতে পারেন।
                  </p>
                )}

                <input
                  type="text"
                  value={galleryInput}
                  onChange={(e) => setGalleryInput(e.target.value)}
                  placeholder="অথবা অতিরিক্ত ছবির URL (কমা দিয়ে)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ভিডিও URL (ঐচ্ছিক)</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ছবির ক্যাপশন</label>
              <input
                type="text"
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                placeholder="ছবির বিবরণ ও ফটোগ্রাফারের নাম"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">তথ্যসূত্র / কপিরাইট ক্রেডিট</label>
              <input
                type="text"
                value={sourceReference}
                onChange={(e) => setSourceReference(e.target.value)}
                placeholder="নিজস্ব প্রতিবেদন / প্রত্যক্ষদর্শী / অফিসিয়াল সূত্র"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">হ্যাশট্যাগ (কমা দিয়ে)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="ঢাকা, সাভার, BreakingNews"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
          </div>

          {/* SEO Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <input
              type="text"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="SEO Title (ঐচ্ছিক)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="SEO Meta Description (ঐচ্ছিক)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Keywords (কমা দিয়ে)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          {(user?.verificationType !== 'none' || ['super_admin', 'admin', 'news_editor'].includes(user?.role || '')) && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-red-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isBreaking}
                onChange={(e) => setIsBreaking(e.target.checked)}
                className="rounded border-slate-300 text-red-700"
              />
              ব্রেকিং নিউজ টিকার ও হাইলাইট হিসেবে চিহ্নিত করুন
            </label>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleSubmit('draft')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          <Save className="w-3.5 h-3.5" />
          খসড়া সংরক্ষণ (Draft)
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleSubmit('submit')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
        >
          <Send className="w-3.5 h-3.5" />
          {submitting ? 'জমা হচ্ছে...' : 'প্রকাশের জন্য জমা দিন'}
        </button>
      </div>
    </div>
  );
};
