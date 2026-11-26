import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    phone: text('phone'),
    passwordHash: text('password_hash'),
    fullName: text('full_name').notNull(),
    username: text('username').notNull().unique(),
    avatarUrl: text('avatar_url'),
    coverUrl: text('cover_url'),
    bio: text('bio'),
    division: text('division').default('Dhaka'),
    district: text('district').default('Dhaka'),
    upazila: text('upazila').default('Savar'),
    unionWard: text('union_ward'),
    areaDetails: text('area_details'),
    role: text('role').notNull().default('user'),
    accountStatus: text('account_status').notNull().default('active'),
    verificationType: text('verification_type').notNull().default('none'),
    isFeaturedCreator: boolean('is_featured_creator').notNull().default(false),
    creatorLevel: integer('creator_level').notNull().default(1),
    monetizationStatus: text('monetization_status').notNull().default('not_eligible'),
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    copyrightStrikes: integer('copyright_strikes').notNull().default(0),
    guidelineViolations: integer('guideline_violations').notNull().default(0),
    totalFollowers: integer('total_followers').notNull().default(0),
    totalFollowing: integer('total_following').notNull().default(0),
    totalPosts: integer('total_posts').notNull().default(0),
    totalViews: integer('total_views').notNull().default(0),
    validViews: integer('valid_views').notNull().default(0),
    totalLikes: integer('total_likes').notNull().default(0),
    activeDays: integer('active_days').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('users_district_idx').on(table.district),
    index('users_role_idx').on(table.role),
    index('users_monetization_idx').on(table.monetizationStatus),
  ]
);

export const posts = pgTable(
  'posts',
  {
    id: serial('id').primaryKey(),
    authorId: integer('author_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').notNull(),
    summary: text('summary'),
    category: text('category').notNull(),
    postType: text('post_type').notNull().default('Local News'),
    status: text('status').notNull().default('published'),
    rejectionReason: text('rejection_reason'),
    isBreaking: boolean('is_breaking').notNull().default(false),
    isFeatured: boolean('is_featured').notNull().default(false),
    commentsDisabled: boolean('comments_disabled').notNull().default(false),
    sharingDisabled: boolean('sharing_disabled').notNull().default(false),
    division: text('division').default('Dhaka'),
    district: text('district').default('Dhaka'),
    upazila: text('upazila').default('Savar'),
    unionWard: text('union_ward'),
    locationText: text('location_text'),
    gpsLat: text('gps_lat'),
    gpsLng: text('gps_lng'),
    featuredImage: text('featured_image'),
    galleryImages: jsonb('gallery_images').$type<string[]>().default([]),
    videoUrl: text('video_url'),
    mediaCaption: text('media_caption'),
    sourceReference: text('source_reference'),
    eventOccurredAt: text('event_occurred_at'),
    tags: jsonb('tags').$type<string[]>().default([]),
    keywords: text('keywords'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    viewsCount: integer('views_count').notNull().default(0),
    validViewsCount: integer('valid_views_count').notNull().default(0),
    likesCount: integer('likes_count').notNull().default(0),
    commentsCount: integer('comments_count').notNull().default(0),
    sharesCount: integer('shares_count').notNull().default(0),
    savesCount: integer('saves_count').notNull().default(0),
    reportsCount: integer('reports_count').notNull().default(0),
    aiRiskScore: integer('ai_risk_score').notNull().default(0),
    aiModerationNote: text('ai_moderation_note'),
    publishedAt: timestamp('published_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('posts_author_idx').on(table.authorId),
    index('posts_status_idx').on(table.status),
    index('posts_category_idx').on(table.category),
    index('posts_district_idx').on(table.district),
    index('posts_breaking_idx').on(table.isBreaking),
    index('posts_published_idx').on(table.publishedAt),
  ]
);

export const reactions = pgTable(
  'reactions',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull().default('like'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('reactions_post_user_uniq').on(table.postId, table.userId)]
);

export const savedPosts = pgTable(
  'saved_posts',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('saved_posts_post_user_uniq').on(table.postId, table.userId)]
);

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    parentId: integer('parent_id'),
    content: text('content').notNull(),
    isPinned: boolean('is_pinned').notNull().default(false),
    isHidden: boolean('is_hidden').notNull().default(false),
    likesCount: integer('likes_count').notNull().default(0),
    reportsCount: integer('reports_count').notNull().default(0),
    aiFlagged: boolean('ai_flagged').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('comments_post_idx').on(table.postId)]
);

export const follows = pgTable(
  'follows',
  {
    id: serial('id').primaryKey(),
    followerId: integer('follower_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    followingId: integer('following_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('follows_pair_uniq').on(table.followerId, table.followingId)]
);

export const viewEvents = pgTable(
  'view_events',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    viewerIpHash: text('viewer_ip_hash').notNull(),
    userAgentHash: text('user_agent_hash'),
    isValid: boolean('is_valid').notNull().default(true),
    isSuspicious: boolean('is_suspicious').notNull().default(false),
    fraudReason: text('fraud_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('view_events_post_idx').on(table.postId)]
);

export const reports = pgTable(
  'reports',
  {
    id: serial('id').primaryKey(),
    targetType: text('target_type').notNull(),
    targetId: integer('target_id').notNull(),
    reporterId: integer('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    details: text('details'),
    status: text('status').notNull().default('pending'),
    reviewedBy: integer('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('reports_status_idx').on(table.status)]
);

export const copyrightClaims = pgTable('copyright_claims', {
  id: serial('id').primaryKey(),
  postId: integer('post_id')
    .references(() => posts.id, { onDelete: 'cascade' })
    .notNull(),
  claimantName: text('claimant_name').notNull(),
  claimantEmail: text('claimant_email').notNull(),
  originalSourceUrl: text('original_source_url').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('pending'),
  adminAction: text('admin_action'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const verificationRequests = pgTable('verification_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  verificationType: text('verification_type').notNull(),
  nidOrPressId: text('nid_or_press_id').notNull(),
  organizationName: text('organization_name'),
  documentNotes: text('document_notes'),
  status: text('status').notNull().default('pending'),
  adminNotes: text('admin_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const advertisements = pgTable('advertisements', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  advertiserName: text('advertiser_name').notNull(),
  adType: text('ad_type').notNull(),
  placement: text('placement').notNull(),
  targetCategory: text('target_category').default('All'),
  targetDistrict: text('target_district').default('All'),
  imageUrl: text('image_url'),
  destinationUrl: text('destination_url').notNull(),
  budgetBdt: integer('budget_bdt').notNull().default(5000),
  cpmBdt: integer('cpm_bdt').notNull().default(60),
  cpcBdt: integer('cpc_bdt').notNull().default(5),
  impressionsCount: integer('impressions_count').notNull().default(0),
  clicksCount: integer('clicks_count').notNull().default(0),
  maxImpressions: integer('max_impressions').notNull().default(100000),
  startDate: text('start_date'),
  endDate: text('end_date'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const earningsLedger = pgTable(
  'earnings_ledger',
  {
    id: serial('id').primaryKey(),
    creatorId: integer('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    postId: integer('post_id').references(() => posts.id, { onDelete: 'set null' }),
    entryType: text('entry_type').notNull(),
    grossAmountBdt: numeric('gross_amount_bdt', { precision: 12, scale: 2 }).notNull(),
    creatorSharePct: integer('creator_share_pct').notNull().default(60),
    netCreatorBdt: numeric('net_creator_bdt', { precision: 12, scale: 2 }).notNull(),
    platformShareBdt: numeric('platform_share_bdt', { precision: 12, scale: 2 }).notNull(),
    status: text('status').notNull().default('approved'),
    note: text('note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('earnings_creator_idx').on(table.creatorId)]
);

export const withdrawals = pgTable(
  'withdrawals',
  {
    id: serial('id').primaryKey(),
    creatorId: integer('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    paymentMethod: text('payment_method').notNull(),
    accountName: text('account_name').notNull(),
    accountNumber: text('account_number').notNull(),
    amountBdt: numeric('amount_bdt', { precision: 12, scale: 2 }).notNull(),
    status: text('status').notNull().default('pending'),
    transactionRef: text('transaction_ref'),
    adminNote: text('admin_note'),
    processedBy: integer('processed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('withdrawals_creator_idx').on(table.creatorId)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    linkUrl: text('link_url'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('audit_logs_created_idx').on(table.createdAt)]
);

export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  earnings: many(earningsLedger),
  withdrawals: many(withdrawals),
  notifications: many(notifications),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  comments: many(comments),
  reactions: many(reactions),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));
