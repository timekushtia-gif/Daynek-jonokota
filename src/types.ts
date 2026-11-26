export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  phone: string | null;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  division: string | null;
  district: string | null;
  upazila: string | null;
  unionWard: string | null;
  areaDetails: string | null;
  role: string;
  accountStatus: string;
  verificationType: string;
  isFeaturedCreator: boolean;
  creatorLevel: number;
  monetizationStatus: string;
  twoFactorEnabled: boolean;
  copyrightStrikes: number;
  guidelineViolations: number;
  totalFollowers: number;
  totalFollowing: number;
  totalPosts: number;
  totalViews: number;
  validViews: number;
  totalLikes: number;
  activeDays: number;
  createdAt: string;
  approvedEarningsBdt?: number;
  withdrawableBalanceBdt?: number;
}

export interface PublicSiteSettings {
  site_name?: string;
  site_tagline?: string;
  site_logo_url?: string;
  logo_display_mode?: string;
  brand_color?: string;
  hero_announcement?: string;
  seo_title?: string;
  seo_description?: string;
  contact_email?: string;
  facebook_url?: string;
  youtube_url?: string;
  x_url?: string;
  footer_text?: string;
  footer_about?: string;
  breaking_ticker_enabled?: boolean | string;
  ads_enabled?: boolean | string;
  adsense_enabled?: boolean | string;
  adsense_auto_ads_enabled?: boolean | string;
  adsense_publisher_id?: string;
  adsense_ads_txt?: string;
  adsense_header_slot?: string;
  adsense_header_format?: string;
  adsense_header_enabled?: boolean | string;
  adsense_feed_slot?: string;
  adsense_feed_format?: string;
  adsense_feed_enabled?: boolean | string;
  adsense_sidebar_slot?: string;
  adsense_sidebar_format?: string;
  adsense_sidebar_enabled?: boolean | string;
  adsense_article_slot?: string;
  adsense_article_format?: string;
  adsense_article_enabled?: boolean | string;
  adsense_multiplex_slot?: string;
  adsense_multiplex_format?: string;
  adsense_multiplex_enabled?: boolean | string;
  adsense_footer_slot?: string;
  adsense_footer_format?: string;
  adsense_footer_enabled?: boolean | string;
  creator_monetization_enabled?: boolean | string;
  comments_enabled?: boolean | string;
  registration_enabled?: boolean | string;
  post_approval_mode?: string;
  min_followers_monetization?: number | string;
  min_views_monetization?: number | string;
  min_withdrawal_bdt?: number | string;
  creator_revenue_share_pct?: number | string;
  [key: string]: unknown;
}

export interface PostAuthor {
  id: number;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  bio?: string | null;
  verificationType: string;
  creatorLevel: number;
  district: string | null;
  upazila: string | null;
  totalFollowers?: number;
  isFeaturedCreator: boolean;
}

export interface NewsPost {
  id: number;
  authorId: number;
  title: string;
  slug: string;
  description: string;
  summary: string | null;
  category: string;
  postType: string;
  status: string;
  rejectionReason: string | null;
  isBreaking: boolean;
  isFeatured: boolean;
  commentsDisabled: boolean;
  sharingDisabled: boolean;
  division: string | null;
  district: string | null;
  upazila: string | null;
  unionWard: string | null;
  locationText: string | null;
  gpsLat: string | null;
  gpsLng: string | null;
  featuredImage: string | null;
  galleryImages: string[];
  videoUrl: string | null;
  mediaCaption: string | null;
  sourceReference: string | null;
  eventOccurredAt: string | null;
  tags: string[];
  keywords: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  viewsCount: number;
  validViewsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  reportsCount: number;
  aiRiskScore: number;
  aiModerationNote: string | null;
  publishedAt: string;
  createdAt: string;
  author: PostAuthor;
  myReaction?: string | null;
  isSaved?: boolean;
  isFollowingAuthor?: boolean;
}

export interface PostComment {
  id: number;
  postId: number;
  userId: number;
  parentId: number | null;
  content: string;
  isPinned: boolean;
  likesCount: number;
  aiFlagged: boolean;
  createdAt: string;
  author: {
    id: number;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    verificationType: string;
  };
}

export interface Advertisement {
  id: number;
  title: string;
  advertiserName: string;
  adType: string;
  placement: string;
  targetCategory: string | null;
  targetDistrict: string | null;
  imageUrl: string | null;
  destinationUrl: string;
  budgetBdt: number;
  cpmBdt: number;
  cpcBdt: number;
  impressionsCount: number;
  clicksCount: number;
  maxImpressions: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

export interface NotificationItem {
  id: number;
  userId: number;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface CreatorDashboardData {
  profile: UserProfile;
  eligibility: {
    minFollowers: number;
    minViews: number;
    followersMet: boolean;
    viewsMet: boolean;
    cleanStanding: boolean;
    globalMonetizationEnabled?: boolean;
    minWithdrawal: number;
    revSharePct: number;
  };
  earnings: {
    todayEarnings: number;
    yesterdayEarnings: number;
    monthEarnings: number;
    lifetimeEarnings: number;
    pendingEarnings: number;
    approvedEarnings: number;
    withdrawableBalance: number;
    estimatedCpm: number;
    estimatedRpm: number;
  };
  revenueChart: { day: string; views: number; revenueBdt: number }[];
  posts: NewsPost[];
  topPosts: NewsPost[];
  topVideos: NewsPost[];
  ledger: {
    id: number;
    entryType: string;
    grossAmountBdt: string;
    creatorSharePct: number;
    netCreatorBdt: string;
    platformShareBdt: string;
    status: string;
    note: string | null;
    createdAt: string;
  }[];
  withdrawals: {
    id: number;
    paymentMethod: string;
    accountName: string;
    accountNumber: string;
    amountBdt: string;
    status: string;
    transactionRef: string | null;
    adminNote: string | null;
    createdAt: string;
  }[];
  verificationRequests: {
    id: number;
    verificationType: string;
    nidOrPressId: string;
    status: string;
    adminNotes: string | null;
    createdAt: string;
  }[];
}
