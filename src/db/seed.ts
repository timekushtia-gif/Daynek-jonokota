import { db } from './index.ts';
import {
  advertisements,
  auditLogs,
  comments,
  earningsLedger,
  notifications,
  platformSettings,
  posts,
  users,
  withdrawals,
} from './schema.ts';
import { count } from 'drizzle-orm';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error('Seed check error:', err);
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const existingUsers = await db.select({ total: count() }).from(users);
  if ((existingUsers[0]?.total ?? 0) > 0) {
    return;
  }

  // Insert default platform settings
  const defaultSettings = [
    { key: 'site_name', value: 'জনকথা (Jonokotha)' },
    { key: 'site_tagline', value: 'জনগণের সংবাদ, নিজের এলাকার কথা' },
    { key: 'min_followers_monetization', value: 1000 },
    { key: 'min_views_monetization', value: 10000 },
    { key: 'min_withdrawal_bdt', value: 500 },
    { key: 'creator_revenue_share_pct', value: 60 },
    { key: 'auto_flag_reports_threshold', value: 5 },
    { key: 'post_approval_mode', value: 'auto_verified_manual_new' },
    { key: 'comments_enabled', value: true },
    { key: 'registration_enabled', value: true },
    { key: 'contact_email', value: 'editorial@jonokotha.bd' },
  ];

  for (const s of defaultSettings) {
    await db
      .insert(platformSettings)
      .values(s)
      .onConflictDoNothing({ target: platformSettings.key });
  }

  // Insert verified citizen journalists and creators
  const insertedCreators = await db
    .insert(users)
    .values([
      {
        uid: 'seed_creator_mahmud',
        email: 'mahmud.kushtia@jonokotha.bd',
        phone: '+8801711000101',
        fullName: 'মাহমুদুল হাসান রনি',
        username: 'mahmud_kushtia',
        avatarUrl: '/src/assets/images/avatar_citizen_reporter_1795635478721.jpg',
        coverUrl: '/src/assets/images/news_kushtia_harvest_1795635479082.jpg',
        bio: 'স্থানীয় সংবাদদাতা ও নাগরিক সাংবাদিক · কুষ্টিয়া সদর ও কুমারখালী এলাকার কৃষি, শিক্ষা ও উন্নয়ন প্রতিবেদন।',
        division: 'Khulna',
        district: 'Kushtia',
        upazila: 'Kushtia Sadar',
        unionWard: 'মজমপুর ওয়ার্ড ০৪',
        areaDetails: 'কুষ্টিয়া শহরের স্থানীয় জনজীবন, গড়াই নদী ও কৃষি অর্থনীতি নিয়ে নিয়মিত মাঠপর্যায়ের প্রতিবেদন।',
        role: 'creator',
        accountStatus: 'active',
        verificationType: 'local_reporter',
        isFeaturedCreator: true,
        creatorLevel: 5,
        monetizationStatus: 'monetized',
        totalFollowers: 6420,
        totalFollowing: 145,
        totalPosts: 38,
        totalViews: 148500,
        validViews: 142300,
        totalLikes: 9840,
        activeDays: 210,
      },
      {
        uid: 'seed_creator_nusrat',
        email: 'nusrat.dhaka@jonokotha.bd',
        phone: '+8801812000202',
        fullName: 'নুসরাত জাহান তানহা',
        username: 'nusrat_dhaka',
        avatarUrl: '/src/assets/images/news_campus_innovation_1795635478448.jpg',
        coverUrl: '/src/assets/images/news_dhaka_metro_1795635477163.jpg',
        bio: 'নগর পরিবহন, মেট্রোরেল, ক্যাম্পাস ও তরুণ উদ্ভাবন বিষয়ক ফিচার রিপোর্টার · ঢাকা।',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Savar',
        unionWard: 'সাভার পৌরসভা ওয়ার্ড ০৭',
        areaDetails: 'ঢাকা ও সাভার অঞ্চলের ট্রাফিক, গণপরিবহন ও বিশ্ববিদ্যালয় শিক্ষার্থীদের উদ্যোগ নিয়ে প্রতিবেদন।',
        role: 'creator',
        accountStatus: 'active',
        verificationType: 'verified_creator',
        isFeaturedCreator: true,
        creatorLevel: 4,
        monetizationStatus: 'monetized',
        totalFollowers: 3180,
        totalFollowing: 210,
        totalPosts: 24,
        totalViews: 76400,
        validViews: 73900,
        totalLikes: 5410,
        activeDays: 145,
      },
      {
        uid: 'seed_creator_rafiq',
        email: 'rafiq.savar@jonokotha.bd',
        phone: '+8801913000303',
        fullName: 'রফিকুল ইসলাম',
        username: 'rafiq_savar',
        avatarUrl: '/src/assets/images/news_savar_monsoon_1795635478388.jpg',
        coverUrl: '/src/assets/images/news_savar_monsoon_1795635478388.jpg',
        bio: 'সাভার ও আশুলিয়া এলাকার নাগরিক সমস্যা, আবহাওয়া ও জনদুর্ভোগ নিয়ে সরেজমিন সংবাদকর্মী।',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Savar',
        unionWard: 'আশুলিয়া ইউনিয়ন',
        areaDetails: 'সাভার-আশুলিয়ার নাগরিক সেবা, রাস্তাঘাট ও জরুরি জনস্বার্থ বিষয়ক খবর।',
        role: 'creator',
        accountStatus: 'active',
        verificationType: 'journalist',
        isFeaturedCreator: false,
        creatorLevel: 3,
        monetizationStatus: 'eligible',
        totalFollowers: 1240,
        totalFollowing: 98,
        totalPosts: 16,
        totalViews: 24100,
        validViews: 22950,
        totalLikes: 1870,
        activeDays: 92,
      },
    ])
    .returning();

  const mahmud = insertedCreators[0];
  const nusrat = insertedCreators[1];
  const rafiq = insertedCreators[2];

  // Insert realistic citizen journalism articles
  const insertedPosts = await db
    .insert(posts)
    .values([
      {
        authorId: nusrat.id,
        title: 'সকালে মেট্রোরেল ও সড়কে যাত্রীচাপ কমেছে, মিরপুর–ফার্মগেট রুটে স্বস্তি',
        slug: 'dhaka-savar-metro-morning-commute-relief',
        description:
          'ঢাকার মিরপুর থেকে ফার্মগেট ও মতিঝিলগামী অফিসযাত্রীদের সকালের ভোগান্তি উল্লেখযোগ্যভাবে কমেছে। আজ সকাল সাড়ে আটটা থেকে সাড়ে দশটা পর্যন্ত মিরপুর ১০, কাজীপাড়া ও শেওড়াপাড়া স্টেশনে সরেজমিনে দেখা যায়, নিয়মিত বিরতিতে ট্রেন চলায় যাত্রীরা মাত্র ১২ থেকে ১৫ মিনিটেই গন্তব্যে পৌঁছাতে পারছেন।\n\nরিকশা ও গণপরিবহন চালকরাও জানিয়েছেন, প্রধান সড়কে অতিরিক্ত চাপ কিছুটা কমায় যানজট আগের তুলনায় সহনীয় হয়েছে। তবে স্টেশন সংলগ্ন ফুটপাত ও ফিডার রুটগুলোতে নিরাপদ হাঁটার ব্যবস্থা আরও জোরদার করার দাবি জানিয়েছেন স্থানীয় নাগরিকরা।',
        summary: 'সকালের ব্যস্ত সময়ে মেট্রোরেল নিয়মিত চলায় মিরপুর-ফার্মগেট রুটের যাত্রীদের সময় বাঁচছে এবং সড়কে চাপ কমছে।',
        category: 'Local News',
        postType: 'Breaking News',
        status: 'published',
        isBreaking: true,
        isFeatured: true,
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mirpur',
        unionWard: 'ওয়ার্ড ০৩',
        locationText: 'মিরপুর ১০ গোলচত্বর, ঢাকা',
        gpsLat: '23.8069',
        gpsLng: '90.3687',
        featuredImage: '/src/assets/images/news_dhaka_metro_1795635477163.jpg',
        galleryImages: ['/src/assets/images/news_dhaka_metro_1795635477163.jpg'],
        mediaCaption: 'সকালে মিরপুর ১০ মেট্রো স্টেশনের নিচে যাত্রী ও রিকশার চলাচল — ছবি: নুসরাত জাহান তানহা',
        sourceReference: 'সরেজমিন প্রতিবেদন ও যাত্রী সাক্ষাৎকার',
        eventOccurredAt: '2026-11-25 09:15',
        tags: ['ঢাকা', 'মেট্রোরেল', 'নাগরিক_সংবাদ', 'যানজট'],
        keywords: 'ঢাকা মেট্রোরেল, মিরপুর, নাগরিক সংবাদ, গণপরিবহন',
        seoTitle: 'সকালে মেট্রোরেল ও সড়কে যাত্রীচাপ কমেছে | জনকথা',
        seoDescription: 'মিরপুর-ফার্মগেট রুটে মেট্রোরেল চলাচলে সকালের অফিসযাত্রীদের স্বস্তি নিয়ে সরেজমিন নাগরিক প্রতিবেদন।',
        viewsCount: 28450,
        validViewsCount: 27820,
        likesCount: 1640,
        commentsCount: 2,
        sharesCount: 312,
        savesCount: 185,
      },
      {
        authorId: mahmud.id,
        title: 'কুষ্টিয়ার কুমারখালী ও সদর উপজেলায় আমন ধানের বাম্পার ফলন, হাসি ফুটেছে কৃষকের মুখে',
        slug: 'kushtia-sadar-aman-paddy-bumper-harvest',
        description:
          'কুষ্টিয়া সদর ও কুমারখালী উপজেলার বিস্তীর্ণ ফসলি মাঠে এবার আমন ধানের বাম্পার ফলন হয়েছে। আবহাওয়া অনুকূলে থাকায় এবং সময়মতো সেচ ও জৈব সার প্রয়োগ করতে পারায় হেক্টরপ্রতি উৎপাদন গত বছরের তুলনায় প্রায় ১২ শতাংশ বেড়েছে বলে জানিয়েছেন স্থানীয় কৃষকরা।\n\nমজমপুর ও চর অঞ্চলের কৃষক আব্দুল করিম জানান, ধানের দাম স্থিতিশীল থাকলে এবার পরিবারের সারা বছরের খরচ মিটিয়েও লাভ থাকবে। স্থানীয় কৃষি সম্প্রসারণ কর্মকর্তারা ফসল সংরক্ষণ ও ন্যায্যমূল্যে ধান বিক্রির বিষয়ে সরাসরি মাঠে গিয়ে পরামর্শ দিচ্ছেন।',
        summary: 'অনুকূল আবহাওয়ায় কুষ্টিয়ায় এবার আমন ধানের উৎপাদন গত বছরের চেয়ে প্রায় ১২% বেশি হয়েছে।',
        category: 'Agriculture',
        postType: 'Agriculture',
        status: 'published',
        isBreaking: false,
        isFeatured: true,
        division: 'Khulna',
        district: 'Kushtia',
        upazila: 'Kushtia Sadar',
        unionWard: 'মজমপুর ইউনিয়ন',
        locationText: 'কুমারখালী ও কুষ্টিয়া সদর ফসলি মাঠ',
        gpsLat: '23.9013',
        gpsLng: '89.1204',
        featuredImage: '/src/assets/images/news_kushtia_harvest_1795635479082.jpg',
        galleryImages: ['/src/assets/images/news_kushtia_harvest_1795635479082.jpg'],
        mediaCaption: 'কুষ্টিয়ার ফসলি মাঠে সোনালি ধান কাটার দৃশ্য — ছবি: মাহমুদুল হাসান রনি',
        sourceReference: 'স্থানীয় কৃষক ও উপজেলা কৃষি অফিস',
        eventOccurredAt: '2026-11-24 16:40',
        tags: ['কুষ্টিয়া', 'কৃষি', 'আমন_ধান', 'বাংলাদেশ'],
        keywords: 'কুষ্টিয়া কৃষি সংবাদ, আমন ধান, বাম্পার ফলন, কৃষক',
        seoTitle: 'কুষ্টিয়ায় আমন ধানের বাম্পার ফলন, খুশি কৃষক | জনকথা',
        seoDescription: 'কুষ্টিয়া সদর ও কুমারখালীতে আমন ধানের বাম্পার ফলন ও কৃষকদের প্রত্যাশা নিয়ে স্থানীয় প্রতিবেদন।',
        viewsCount: 19230,
        validViewsCount: 18790,
        likesCount: 1420,
        commentsCount: 1,
        sharesCount: 245,
        savesCount: 132,
      },
      {
        authorId: rafiq.id,
        title: 'টানা বৃষ্টিতে সাভার বাজার সড়কে জলাবদ্ধতা, ড্রেন সংস্কারের দাবি স্থানীয় ব্যবসায়ীদের',
        slug: 'dhaka-savar-monsoon-waterlogging-bazar-road',
        description:
          'গত রাতের টানা বর্ষণে সাভার বাজার রোড ও আশপাশের কয়েকটি গলিতে হাঁটুপানি জমে গেছে। এতে সকাল থেকেই স্কুলগামী শিক্ষার্থী, অফিসযাত্রী ও ক্ষুদ্র ব্যবসায়ীরা চরম ভোগান্তিতে পড়েছেন।\n\nবাজার কমিটির ব্যবসায়ীরা জানান, প্রধান নর্দমাগুলো নিয়মিত পরিষ্কার না করায় বৃষ্টির পানি দ্রুত নামতে পারছে না। দ্রুত ড্রেনেজ ব্যবস্থা সচল করে জলাবদ্ধতা নিরসনে পৌরসভার জরুরি পদক্ষেপ চেয়েছেন এলাকাবাসী।',
        summary: 'টানা বৃষ্টিতে সাভার বাজার সড়কে পানি জমে জনদুর্ভোগ তৈরি হয়েছে; দ্রুত ড্রেন সংস্কারের দাবি।',
        category: 'Weather',
        postType: 'Local News',
        status: 'published',
        isBreaking: true,
        isFeatured: false,
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Savar',
        unionWard: 'সাভার পৌরসভা',
        locationText: 'সাভার বাজার বাসস্ট্যান্ড সংলগ্ন সড়ক',
        gpsLat: '23.8583',
        gpsLng: '90.2667',
        featuredImage: '/src/assets/images/news_savar_monsoon_1795635478388.jpg',
        galleryImages: ['/src/assets/images/news_savar_monsoon_1795635478388.jpg'],
        mediaCaption: 'বৃষ্টিভেজা সাভার বাজার সড়কে ছাতা মাথায় পথচারীদের চলাচল — ছবি: রফিকুল ইসলাম',
        sourceReference: 'সাভার নাগরিক ফোরাম ও বাজার ব্যবসায়ী',
        eventOccurredAt: '2026-11-25 08:30',
        tags: ['সাভার', 'বৃষ্টি', 'জলাবদ্ধতা', 'নাগরিক_সমস্যা'],
        keywords: 'সাভার সংবাদ, জলাবদ্ধতা, সাভার বাজার, আবহাওয়া',
        seoTitle: 'বৃষ্টিতে সাভার বাজার সড়কে জলাবদ্ধতা | জনকথা',
        seoDescription: 'সাভার বাজার সড়কে বৃষ্টির পানিতে জলাবদ্ধতা ও ড্রেন সংস্কারের দাবি নিয়ে নাগরিক প্রতিবেদন।',
        viewsCount: 15840,
        validViewsCount: 15110,
        likesCount: 930,
        commentsCount: 1,
        sharesCount: 198,
        savesCount: 84,
      },
      {
        authorId: nusrat.id,
        title: 'ঢাকার তরুণ শিক্ষার্থীদের তৈরি বাংলা ফ্যাক্ট-চেক ও নাগরিক সাংবাদিকতা টুল প্রদর্শিত',
        slug: 'dhaka-dhanmondi-student-civic-tech-showcase',
        description:
          'বিশ্ববিদ্যালয় পর্যায়ের একদল তরুণ শিক্ষার্থী স্থানীয় ভুয়া খবর শনাক্তকরণ এবং জেলা-উপজেলা পর্যায়ের নাগরিক সংবাদ যাচাইয়ে একটি বাংলা ল্যাঙ্গুয়েজ টুল প্রদর্শন করেছে। ক্যাম্পাসের লাইব্রেরি ইনোভেশন ল্যাবে আয়োজিত এই প্রদর্শনীতে সাংবাদিকতা ও কম্পিউটার বিজ্ঞান বিভাগের শিক্ষার্থীরা যৌথভাবে কাজ করেন।\n\nউদ্যোক্তারা জানান, স্থানীয় কোনো ঘটনার ছবি বা তথ্য ভাইরাল হলে সেটি প্রকৃত উৎস ও তারিখ মিলিয়ে যাচাই করতে এই টুল সহায়তা করবে।',
        summary: 'স্থানীয় ভুয়া তথ্য শনাক্তে তরুণ শিক্ষার্থীদের তৈরি বাংলা ফ্যাক্ট-চেক টুল ক্যাম্পাস প্রদর্শনীতে প্রশংসিত হয়েছে।',
        category: 'Technology',
        postType: 'Education',
        status: 'published',
        isBreaking: false,
        isFeatured: false,
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Dhanmondi',
        unionWard: 'ওয়ার্ড ১৫',
        locationText: 'ধানমন্ডি ক্যাম্পাস লাইব্রেরি, ঢাকা',
        gpsLat: '23.7461',
        gpsLng: '90.3742',
        featuredImage: '/src/assets/images/news_campus_innovation_1795635478448.jpg',
        galleryImages: ['/src/assets/images/news_campus_innovation_1795635478448.jpg'],
        mediaCaption: 'ক্যাম্পাস লাইব্রেরিতে প্রজেক্ট নিয়ে আলোচনা করছেন শিক্ষার্থীরা — ছবি: নুসরাত জাহান তানহা',
        sourceReference: 'ক্যাম্পাস ইনোভেশন প্রদর্শনী ২০২৬',
        eventOccurredAt: '2026-11-23 14:00',
        tags: ['প্রযুক্তি', 'শিক্ষা', 'ফ্যাক্টচেক', 'ঢাকা'],
        keywords: 'প্রযুক্তি সংবাদ, বিশ্ববিদ্যালয়, উদ্ভাবন, ফ্যাক্ট-চেক',
        seoTitle: 'শিক্ষার্থীদের তৈরি বাংলা ফ্যাক্ট-চেক টুল প্রদর্শিত | জনকথা',
        seoDescription: 'স্থানীয় ভুয়া তথ্য যাচাইয়ে তরুণ শিক্ষার্থীদের তৈরি নতুন বাংলা প্রযুক্তি টুল নিয়ে প্রতিবেদন।',
        viewsCount: 11420,
        validViewsCount: 11100,
        likesCount: 810,
        commentsCount: 0,
        sharesCount: 140,
        savesCount: 210,
      },
    ])
    .returning();

  // Seed initial comments
  if (insertedPosts[0] && insertedPosts[1] && insertedPosts[2]) {
    await db.insert(comments).values([
      {
        postId: insertedPosts[0].id,
        userId: mahmud.id,
        content: 'খুবই প্রয়োজনীয় প্রতিবেদন। মিরপুর থেকে মতিঝিল যাতায়াতে সত্যিই অনেক সময় সাশ্রয় হচ্ছে।',
        isPinned: true,
        likesCount: 24,
      },
      {
        postId: insertedPosts[0].id,
        userId: rafiq.id,
        content: 'সাভার থেকেও সকালবেলা শাটল বাস ও মেট্রো কানেক্টিভিটি বাড়ানো গেলে দারুণ হবে।',
        likesCount: 11,
      },
      {
        postId: insertedPosts[1].id,
        userId: nusrat.id,
        content: 'আমাদের কৃষকদের সাফল্যের খবর মূলধারায় আরও বেশি আসা উচিত। চমৎকার ছবি!',
        likesCount: 18,
      },
      {
        postId: insertedPosts[2].id,
        userId: mahmud.id,
        content: 'পৌরসভার জরুরি ড্রেন সংস্কার টিম দ্রুত ব্যবস্থা নিলে বাজারের ব্যবসায়ীরা রক্ষা পাবেন।',
        likesCount: 9,
      },
    ]);
  }

  // Seed advertisements
  await db.insert(advertisements).values([
    {
      title: 'দেশি কৃষি ও বীজ ভান্ডার — মৌসুমি অফার',
      advertiserName: 'গ্রিনবাংলা এগ্রো লিমিটেড',
      adType: 'native',
      placement: 'feed',
      targetCategory: 'Agriculture',
      targetDistrict: 'All',
      imageUrl: '/src/assets/images/news_kushtia_harvest_1795635479082.jpg',
      destinationUrl: 'https://example.com/greenbangla-agro',
      budgetBdt: 15000,
      cpmBdt: 75,
      cpcBdt: 6,
      impressionsCount: 4210,
      clicksCount: 184,
      maxImpressions: 200000,
      startDate: '2026-11-01',
      endDate: '2026-12-31',
      status: 'active',
    },
    {
      title: 'সাভার ডিজিটাল হেলথ ক্লিনিক — ২৪ ঘণ্টা জরুরি সেবা',
      advertiserName: 'সাভার কেয়ার হাসপাতাল',
      adType: 'sidebar',
      placement: 'sidebar',
      targetCategory: 'All',
      targetDistrict: 'Dhaka',
      imageUrl: '/src/assets/images/news_dhaka_metro_1795635477163.jpg',
      destinationUrl: 'https://example.com/savar-care',
      budgetBdt: 12000,
      cpmBdt: 60,
      cpcBdt: 5,
      impressionsCount: 3180,
      clicksCount: 92,
      maxImpressions: 150000,
      startDate: '2026-11-10',
      endDate: '2026-12-20',
      status: 'active',
    },
  ]);

  // Seed earnings ledger & sample withdrawal for Mahmud & Nusrat
  await db.insert(earningsLedger).values([
    {
      creatorId: mahmud.id,
      postId: insertedPosts[1]?.id ?? null,
      entryType: 'ad_revenue_share',
      grossAmountBdt: '4500.00',
      creatorSharePct: 60,
      netCreatorBdt: '2700.00',
      platformShareBdt: '1800.00',
      status: 'approved',
      note: 'নভেম্বর ২০২৬ — ভ্যালিড ভিউ ও বিজ্ঞাপন রেভিনিউ শেয়ার (৬০%)',
    },
    {
      creatorId: mahmud.id,
      postId: insertedPosts[1]?.id ?? null,
      entryType: 'creator_bonus',
      grossAmountBdt: '1500.00',
      creatorSharePct: 60,
      netCreatorBdt: '900.00',
      platformShareBdt: '600.00',
      status: 'approved',
      note: 'শীর্ষ স্থানীয় কৃষি প্রতিবেদন বোনাস',
    },
    {
      creatorId: nusrat.id,
      postId: insertedPosts[0]?.id ?? null,
      entryType: 'ad_revenue_share',
      grossAmountBdt: '3200.00',
      creatorSharePct: 60,
      netCreatorBdt: '1920.00',
      platformShareBdt: '1280.00',
      status: 'approved',
      note: 'ব্রেকিং নিউজ বিজ্ঞাপন শেয়ার (৬০%)',
    },
  ]);

  await db.insert(withdrawals).values([
    {
      creatorId: mahmud.id,
      paymentMethod: 'bkash',
      accountName: 'মাহমুদুল হাসান রনি',
      accountNumber: '01711000101',
      amountBdt: '1200.00',
      status: 'paid',
      transactionRef: 'BKX2611249081',
      adminNote: 'যাচাইকৃত bKash পেমেন্ট সম্পন্ন হয়েছে',
    },
  ]);

  await db.insert(notifications).values([
    {
      userId: mahmud.id,
      type: 'payment_approved',
      title: 'bKash পেমেন্ট সম্পন্ন হয়েছে',
      body: 'আপনার ৳১,২০০ উত্তোলনের অনুরোধ সম্পন্ন হয়েছে (Ref: BKX2611249081)।',
      linkUrl: '/creator',
    },
    {
      userId: nusrat.id,
      type: 'breaking_news',
      title: 'ব্রেকিং নিউজ অনুমোদিত',
      body: 'আপনার মেট্রোরেল প্রতিবেদনটি হোমপেজ ব্রেকিং টিকারের জন্য নির্বাচিত হয়েছে।',
      linkUrl: '/creator',
    },
  ]);

  await db.insert(auditLogs).values([
    {
      actorEmail: 'system@jonokotha.bd',
      actorRole: 'super_admin',
      action: 'PLATFORM_INITIALIZED',
      targetType: 'system',
      targetId: '1',
      details: { message: 'Initial PostgreSQL schema, settings, and citizen journalism stories provisioned' },
    },
  ]);
}
