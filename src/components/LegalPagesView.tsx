import React, { useState } from 'react';
import { ArrowLeft, Shield } from 'lucide-react';

const POLICY_DOCS = [
  {
    id: 'privacy',
    title: 'Privacy Policy (গোপনীয়তা নীতি)',
    body: 'জনকথা ব্যবহারকারীর ব্যক্তিগত তথ্য, ইমেইল, মোবাইল নম্বর ও এলাকার তথ্য সর্বোচ্চ নিরাপত্তার সাথে সংরক্ষণ করে। কোনো ব্যক্তিগত তথ্য তৃতীয় পক্ষের কাছে বিক্রি করা হয় না। অ্যাকাউন্ট নিরাপত্তা ও অ্যান্টি-ফ্রড যাচাইয়ের জন্য কেবল এনক্রিপ্টেড আইপি হ্যাশ ও সেশন ডেটা ব্যবহৃত হয়।',
  },
  {
    id: 'terms',
    title: 'Terms & Conditions (শর্তাবলি)',
    body: 'এই প্ল্যাটফর্মে প্রকাশিত প্রতিটি সংবাদের প্রাথমিক দায়িত্ব সংশ্লিষ্ট নাগরিক সাংবাদিক বা কন্টেন্ট ক্রিয়েটরের। ভুয়া খবর, গুজব বা মানহানিকর তথ্য প্রকাশ করলে অ্যাকাউন্ট স্থগিত বা বাতিল করা হতে পারে।',
  },
  {
    id: 'guidelines',
    title: 'Community Guidelines (কমিউনিটি গাইডলাইন)',
    body: 'ঘৃণাত্মক বক্তব্য, সহিংসতা উসকানি, শিশু নির্যাতন, স্প্যামিং বা ভুয়া জরুরি সংবাদ প্রকাশ সম্পূর্ণ নিষিদ্ধ। প্রতিটি প্রতিবেদনে সঠিক স্থান, তারিখ এবং তথ্যসূত্র উল্লেখ করা আবশ্যক।',
  },
  {
    id: 'copyright',
    title: 'Copyright Policy (কপিরাইট নীতিমালা)',
    body: 'অন্যের ছবি, ভিডিও বা লেখা ব্যবহার করলে অবশ্যই মূল সোর্স উল্লেখ ও অনুমতি থাকতে হবে। কপিরাইট স্বত্বাধিকারীর অভিযোগ প্রমাণিত হলে কন্টেন্ট অপসারণ, স্ট্রাইক প্রদান এবং মনিটাইজেশন স্থগিত করা হবে।',
  },
  {
    id: 'monetization',
    title: 'Creator Monetization Policy (মনিটাইজেশন নীতিমালা)',
    body: 'মনিটাইজেশনের জন্য ন্যূনতম ১,০০০ ফলোয়ার, ১০,০০০ বৈধ ভিউ, ০ কপিরাইট স্ট্রাইক এবং ০ কমিউনিটি গাইডলাইন ভায়োলেশন থাকতে হবে। বট বা ভুয়া ট্রাফিক শনাক্ত হলে সংশ্লিষ্ট আয় বাতিল বা হোল্ড করা হবে। ক্রিয়েটর ও প্ল্যাটফর্মের মধ্যে নির্ধারিত রেভিনিউ শেয়ার (ডিফল্ট ৬০%/৪০%) লেজারে হিসাব করা হয়।',
  },
  {
    id: 'advertising',
    title: 'Advertising Policy (বিজ্ঞাপন নীতিমালা)',
    body: 'বিজ্ঞাপনদাতারা জেলা, বিভাগ ও ক্যাটাগরি ভিত্তিক বিজ্ঞাপন চালাতে পারবেন। জুয়া, প্রতারণা বা অবৈধ পণ্যের কোনো বিজ্ঞাপন অনুমোদন করা হয় না।',
  },
  {
    id: 'refund',
    title: 'Refund Policy (রিফান্ড নীতিমালা)',
    body: 'বিজ্ঞাপন ক্যাম্পেইন অনুমোদনের আগে বাতিল করা হলে অব্যবহৃত বাজেট ৭ কার্যদিবসের মধ্যে রিফান্ড করা হবে।',
  },
  {
    id: 'payment',
    title: 'Payment Policy (পেমেন্ট নীতিমালা)',
    body: 'ক্রিয়েটররা bKash, Nagad বা ব্যাংক অ্যাকাউন্টের মাধ্যমে ন্যূনতম নির্ধারিত ব্যালেন্স (৳৫০০) উত্তোলন করতে পারবেন। প্রতিটি লেনদেনের বিপরীতে ইউনিক Transaction Reference ID সংরক্ষিত থাকবে।',
  },
  {
    id: 'removal',
    title: 'Content Removal Policy (কন্টেন্ট অপসারণ নীতি)',
    body: 'একাধিক ব্যবহারকারীর রিপোর্ট, সরকারি/আইনি নোটিশ বা ফ্যাক্ট-চেক যাচাইয়ে মিথ্যা প্রমাণিত হলে সংবাদটি স্বয়ংক্রিয়ভাবে Under Review-তে যাবে এবং প্রয়োজনে অপসারণ করা হবে।',
  },
  {
    id: 'disclaimer',
    title: 'Disclaimer (দায়মুক্তি)',
    body: 'নাগরিক সাংবাদিকদের প্রকাশিত মতামত ও প্রতিবেদন লেখকের নিজস্ব; যাচাইকৃত ব্যাজধারী ছাড়া অন্যান্য পোস্টের জন্য প্ল্যাটফর্ম সম্পাদকীয়ভাবে দায়ী নয়।',
  },
  {
    id: 'contact',
    title: 'Contact Us (যোগাযোগ)',
    body: 'সম্পাদকীয় সহায়তা, কপিরাইট অভিযোগ বা ব্যবসায়িক বিজ্ঞাপনের জন্য ইমেইল করুন: editorial@jonokotha.bd · ঢাকা, বাংলাদেশ।',
  },
];

export const LegalPagesView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeId, setActiveId] = useState(POLICY_DOCS[0].id);
  const current = POLICY_DOCS.find((d) => d.id === activeId) || POLICY_DOCS[0];

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1 h-fit">
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-900 border-b border-slate-100 mb-2">
            <Shield className="w-4 h-4 text-red-700" />
            আইনি ও নীতিমালা সমূহ
          </div>
          {POLICY_DOCS.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setActiveId(doc.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeId === doc.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {doc.title}
            </button>
          ))}
        </div>

        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-4">
          <h1 className="text-xl font-bold text-slate-900">{current.title}</h1>
          <p className="text-sm text-slate-700 leading-relaxed">{current.body}</p>
        </div>
      </div>
    </div>
  );
};
