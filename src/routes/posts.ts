import { Router } from 'express';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  auditLogs,
  comments,
  copyrightClaims,
  follows,
  notifications,
  platformSettings,
  posts,
  reactions,
  reports,
  savedPosts,
  users,
  viewEvents,
} from '../db/schema.ts';
import { AuthRequest, optionalAuth, requireAuth } from '../middleware/auth.ts';
import { hashIdentifier, isSafeHttpUrl, isSafeImageSource, rateLimit, sanitizeText } from '../lib/security.ts';
import { analyzeCommentToxicity, analyzeNewsWithAi } from '../lib/ai-service.ts';

const router = Router();

function makeSlug(title: string, district?: string, upazila?: string): string {
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^\w\u0980-\u09FF\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50);
  const locPart = [district, upazila]
    .filter(Boolean)
    .map((x) => x!.toLowerCase().replace(/[^a-z0-9]/g, '-'))
    .join('-');
  const uniqueSuffix = Date.now().toString(36).slice(-4);
  return `${locPart ? locPart + '-' : ''}${cleanTitle || 'news'}-${uniqueSuffix}`;
}

// Public website customization & configuration settings
router.get('/public-settings', async (_req, res) => {
  try {
    const rows = await db.select().from(platformSettings);
    const map: Record<string, unknown> = {};
    for (const r of rows) {
      if (r.key === 'admin_passcode_hash') continue;
      map[r.key] = r.value;
    }
    return res.json({ settings: map });
  } catch (error) {
    console.error('Public settings error:', error);
    return res.status(500).json({ error: 'Failed to load site settings.' });
  }
});

// Get personalized / filtered social news feed
router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const q = sanitizeText(req.query.q, 120);
    const category = sanitizeText(req.query.category, 60);
    const district = sanitizeText(req.query.district, 60);
    const upazila = sanitizeText(req.query.upazila, 60);
    const hashtag = sanitizeText(req.query.hashtag, 60);
    const sort = String(req.query.sort || 'feed'); // feed | latest | popular | most_viewed | most_liked | most_shared | trending | saved | my_posts
    const statusFilter = sanitizeText(req.query.status, 30);
    const limit = Math.min(40, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const conditions = [];

    if (sort === 'my_posts' && req.dbUser) {
      conditions.push(eq(posts.authorId, req.dbUser.id));
      if (statusFilter && statusFilter !== 'all') {
        conditions.push(eq(posts.status, statusFilter));
      }
    } else {
      conditions.push(inArray(posts.status, ['published', 'approved']));
    }

    if (category && category !== 'All') {
      conditions.push(or(eq(posts.category, category), eq(posts.postType, category)));
    }
    if (district && district !== 'All') {
      conditions.push(eq(posts.district, district));
    }
    if (upazila && upazila !== 'All') {
      conditions.push(eq(posts.upazila, upazila));
    }
    if (q) {
      conditions.push(
        or(
          ilike(posts.title, `%${q}%`),
          ilike(posts.description, `%${q}%`),
          ilike(posts.district, `%${q}%`),
          ilike(posts.upazila, `%${q}%`),
          ilike(posts.keywords, `%${q}%`)
        )
      );
    }

    let orderClause = [desc(posts.isBreaking), desc(posts.publishedAt)];
    if (sort === 'most_viewed') {
      orderClause = [desc(posts.validViewsCount), desc(posts.publishedAt)];
    } else if (sort === 'most_liked') {
      orderClause = [desc(posts.likesCount), desc(posts.publishedAt)];
    } else if (sort === 'most_shared') {
      orderClause = [desc(posts.sharesCount), desc(posts.publishedAt)];
    } else if (sort === 'popular' || sort === 'trending') {
      orderClause = [
        desc(sql`(${posts.likesCount} * 3 + ${posts.commentsCount} * 4 + ${posts.sharesCount} * 5 + ${posts.validViewsCount} / 50)`),
        desc(posts.publishedAt),
      ];
    }

    const rows = await db
      .select({
        post: posts,
        author: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          verificationType: users.verificationType,
          creatorLevel: users.creatorLevel,
          district: users.district,
          upazila: users.upazila,
          isFeaturedCreator: users.isFeaturedCreator,
        },
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(and(...conditions))
      .orderBy(...orderClause)
      .limit(limit)
      .offset(offset);

    let filtered = rows;
    if (hashtag) {
      const cleanTag = hashtag.replace(/^#/, '').toLowerCase();
      filtered = rows.filter((r) =>
        (r.post.tags || []).some((t) => t.toLowerCase().includes(cleanTag))
      );
    }

    // If user is logged in, fetch their reactions, saves, and following list
    let myReactionsMap: Record<number, string> = {};
    let mySavesSet = new Set<number>();
    let myFollowingSet = new Set<number>();

    if (req.dbUser && filtered.length > 0) {
      const postIds = filtered.map((r) => r.post.id);
      const [userReacts, userSaves, userFollows] = await Promise.all([
        db
          .select()
          .from(reactions)
          .where(and(eq(reactions.userId, req.dbUser.id), inArray(reactions.postId, postIds))),
        db
          .select()
          .from(savedPosts)
          .where(and(eq(savedPosts.userId, req.dbUser.id), inArray(savedPosts.postId, postIds))),
        db.select().from(follows).where(eq(follows.followerId, req.dbUser.id)),
      ]);
      for (const ur of userReacts) myReactionsMap[ur.postId] = ur.type;
      for (const us of userSaves) mySavesSet.add(us.postId);
      for (const uf of userFollows) myFollowingSet.add(uf.followingId);
    }

    if (sort === 'saved' && req.dbUser) {
      filtered = filtered.filter((r) => mySavesSet.has(r.post.id));
    }

    // Personalized feed scoring when sort === 'feed'
    if (sort === 'feed' && req.dbUser) {
      const userDistrict = req.dbUser.district;
      filtered = [...filtered].sort((a, b) => {
        const scoreA =
          (a.post.isBreaking ? 100 : 0) +
          (a.post.district === userDistrict ? 45 : 0) +
          (myFollowingSet.has(a.author.id) ? 60 : 0) +
          (a.post.isFeatured ? 25 : 0) +
          Math.min(40, Math.floor(a.post.likesCount / 50));
        const scoreB =
          (b.post.isBreaking ? 100 : 0) +
          (b.post.district === userDistrict ? 45 : 0) +
          (myFollowingSet.has(b.author.id) ? 60 : 0) +
          (b.post.isFeatured ? 25 : 0) +
          Math.min(40, Math.floor(b.post.likesCount / 50));
        return scoreB - scoreA;
      });
    }

    const items = filtered.map((r) => ({
      ...r.post,
      author: r.author,
      myReaction: myReactionsMap[r.post.id] || null,
      isSaved: mySavesSet.has(r.post.id),
      isFollowingAuthor: myFollowingSet.has(r.author.id),
    }));

    return res.json({ posts: items });
  } catch (error) {
    console.error('Get posts feed error:', error);
    return res.status(500).json({ error: 'Failed to load news feed.' });
  }
});

// Trending hashtags, trending creators, breaking headlines
router.get('/highlights', async (_req, res) => {
  try {
    const [breakingRows, topCreators, recentPosts] = await Promise.all([
      db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          district: posts.district,
          upazila: posts.upazila,
          publishedAt: posts.publishedAt,
        })
        .from(posts)
        .where(and(eq(posts.isBreaking, true), inArray(posts.status, ['published', 'approved'])))
        .orderBy(desc(posts.publishedAt))
        .limit(8),
      db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          verificationType: users.verificationType,
          creatorLevel: users.creatorLevel,
          district: users.district,
          totalFollowers: users.totalFollowers,
          validViews: users.validViews,
          isFeaturedCreator: users.isFeaturedCreator,
        })
        .from(users)
        .where(eq(users.accountStatus, 'active'))
        .orderBy(desc(users.isFeaturedCreator), desc(users.totalFollowers))
        .limit(6),
      db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          tags: posts.tags,
          district: posts.district,
          upazila: posts.upazila,
          validViewsCount: posts.validViewsCount,
          sharesCount: posts.sharesCount,
          category: posts.category,
        })
        .from(posts)
        .where(inArray(posts.status, ['published', 'approved']))
        .orderBy(desc(posts.validViewsCount))
        .limit(20),
    ]);

    const tagCounts = new Map<string, number>();
    for (const p of recentPosts) {
      for (const tag of p.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    const trendingHashtags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return res.json({
      breakingNews: breakingRows,
      popularCreators: topCreators,
      trendingHashtags,
      mostViewed: recentPosts.slice(0, 5),
    });
  } catch (error) {
    console.error('Highlights error:', error);
    return res.status(500).json({ error: 'Failed to load highlights.' });
  }
});

// Single article detail by slug + Anti-Fraud View Tracking
router.get('/by-slug/:slug', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const slug = String(req.params.slug || '');
    const rows = await db
      .select({
        post: posts,
        author: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          verificationType: users.verificationType,
          creatorLevel: users.creatorLevel,
          district: users.district,
          upazila: users.upazila,
          totalFollowers: users.totalFollowers,
          isFeaturedCreator: users.isFeaturedCreator,
        },
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.slug, slug))
      .limit(1);

    if (!rows[0]) {
      return res.status(404).json({ error: 'News article not found.' });
    }

    const item = rows[0];
    // Anti-fraud view tracking
    const ipRaw = req.ip || req.socket.remoteAddress || 'unknown';
    const uaRaw = req.headers['user-agent'] || 'unknown';
    const ipHash = hashIdentifier(ipRaw);
    const uaHash = hashIdentifier(uaRaw);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSameIp = await db
      .select({ id: viewEvents.id })
      .from(viewEvents)
      .where(and(eq(viewEvents.postId, item.post.id), eq(viewEvents.viewerIpHash, ipHash)))
      .limit(5);

    const isBotUa = /bot|crawler|spider|headless|curl|wget/i.test(uaRaw);
    const isRepeated = recentSameIp.length >= 2;
    const isSuspicious = isBotUa || isRepeated;
    const isValid = !isSuspicious;

    await db.insert(viewEvents).values({
      postId: item.post.id,
      viewerIpHash: ipHash,
      userAgentHash: uaHash,
      isValid,
      isSuspicious,
      fraudReason: isBotUa ? 'Automated bot user-agent' : isRepeated ? 'Repeated rapid views from same IP' : null,
    });

    await db
      .update(posts)
      .set({
        viewsCount: sql`${posts.viewsCount} + 1`,
        ...(isValid ? { validViewsCount: sql`${posts.validViewsCount} + 1` } : {}),
      })
      .where(eq(posts.id, item.post.id));

    await db
      .update(users)
      .set({
        totalViews: sql`${users.totalViews} + 1`,
        ...(isValid ? { validViews: sql`${users.validViews} + 1` } : {}),
      })
      .where(eq(users.id, item.author.id));

    // Fetch comments
    const postComments = await db
      .select({
        comment: comments,
        author: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          verificationType: users.verificationType,
        },
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(and(eq(comments.postId, item.post.id), eq(comments.isHidden, false)))
      .orderBy(desc(comments.isPinned), desc(comments.createdAt));

    let myReaction: string | null = null;
    let isSaved = false;
    let isFollowingAuthor = false;

    if (req.dbUser) {
      const [rRow, sRow, fRow] = await Promise.all([
        db
          .select()
          .from(reactions)
          .where(and(eq(reactions.postId, item.post.id), eq(reactions.userId, req.dbUser.id)))
          .limit(1),
        db
          .select()
          .from(savedPosts)
          .where(and(eq(savedPosts.postId, item.post.id), eq(savedPosts.userId, req.dbUser.id)))
          .limit(1),
        db
          .select()
          .from(follows)
          .where(and(eq(follows.followerId, req.dbUser.id), eq(follows.followingId, item.author.id)))
          .limit(1),
      ]);
      myReaction = rRow[0]?.type || null;
      isSaved = Boolean(sRow[0]);
      isFollowingAuthor = Boolean(fRow[0]);
    }

    return res.json({
      post: {
        ...item.post,
        viewsCount: item.post.viewsCount + 1,
        validViewsCount: item.post.validViewsCount + (isValid ? 1 : 0),
        author: item.author,
        myReaction,
        isSaved,
        isFollowingAuthor,
      },
      comments: postComments.map((c) => ({ ...c.comment, author: c.author })),
    });
  } catch (error) {
    console.error('Get post by slug error:', error);
    return res.status(500).json({ error: 'Failed to load article.' });
  }
});

// Create / Save Draft / Submit News Post
router.post('/', requireAuth, rateLimit('create-post', 15, 60_000), async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    if (req.dbUser.accountStatus !== 'active') {
      return res.status(403).json({ error: 'Suspended accounts cannot publish posts.' });
    }

    const title = sanitizeText(req.body?.title, 220);
    const description = sanitizeText(req.body?.description, 20000);
    const summary = sanitizeText(req.body?.summary, 500);
    const category = sanitizeText(req.body?.category, 60) || 'Local News';
    const postType = sanitizeText(req.body?.postType, 60) || category;
    const action = req.body?.action === 'draft' ? 'draft' : 'submit';
    const isBreaking = Boolean(req.body?.isBreaking) && (req.dbUser.verificationType !== 'none' || ['super_admin', 'admin', 'news_editor'].includes(req.dbUser.role));

    if (!title || description.length < 20) {
      return res.status(400).json({ error: 'Title and at least 20 characters of news description are required.' });
    }

    const division = sanitizeText(req.body?.division, 60) || req.dbUser.division || 'Dhaka';
    const district = sanitizeText(req.body?.district, 60) || req.dbUser.district || 'Dhaka';
    const upazila = sanitizeText(req.body?.upazila, 60) || req.dbUser.upazila || 'Savar';
    const unionWard = sanitizeText(req.body?.unionWard, 80);
    const locationText = sanitizeText(req.body?.locationText, 160);
    const gpsLat = sanitizeText(req.body?.gpsLat, 30);
    const gpsLng = sanitizeText(req.body?.gpsLng, 30);

    const featuredImage = isSafeImageSource(req.body?.featuredImage) ? req.body.featuredImage.trim() : null;
    const galleryImages = Array.isArray(req.body?.galleryImages)
      ? req.body.galleryImages
          .filter((u: unknown): u is string => isSafeImageSource(u))
          .map((u: string) => u.trim())
          .slice(0, 8)
      : [];
    const videoUrl = typeof req.body?.videoUrl === 'string' && isSafeHttpUrl(req.body.videoUrl) ? req.body.videoUrl : null;
    const mediaCaption = sanitizeText(req.body?.mediaCaption, 240);
    const sourceReference = sanitizeText(req.body?.sourceReference, 240);
    const eventOccurredAt = sanitizeText(req.body?.eventOccurredAt, 60);
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map((t: unknown) => sanitizeText(t, 40).replace(/^#/, '')).filter(Boolean).slice(0, 10)
      : [];
    const keywords = sanitizeText(req.body?.keywords, 240);
    const seoTitle = sanitizeText(req.body?.seoTitle, 160) || `${title} | জনকথা`;
    const seoDescription = sanitizeText(req.body?.seoDescription, 220) || summary || description.slice(0, 155);

    // Determine approval workflow status
    let status = 'pending_review';
    if (action === 'draft') {
      status = 'draft';
    } else {
      const approvalSetting = await db
        .select()
        .from(platformSettings)
        .where(eq(platformSettings.key, 'post_approval_mode'))
        .limit(1);
      const mode = String(approvalSetting[0]?.value || 'auto_verified_manual_new');
      const isTrusted = req.dbUser.verificationType !== 'none' || ['super_admin', 'admin', 'news_editor'].includes(req.dbUser.role);
      if (mode === 'auto_all' || (mode === 'auto_verified_manual_new' && isTrusted)) {
        status = 'published';
      }
    }

    const slug = makeSlug(title, district, upazila);
    const [created] = await db
      .insert(posts)
      .values({
        authorId: req.dbUser.id,
        title,
        slug,
        description,
        summary: summary || description.slice(0, 180),
        category,
        postType,
        status,
        isBreaking,
        division,
        district,
        upazila,
        unionWard: unionWard || null,
        locationText: locationText || `${upazila}, ${district}`,
        gpsLat: gpsLat || null,
        gpsLng: gpsLng || null,
        featuredImage,
        galleryImages,
        videoUrl,
        mediaCaption: mediaCaption || null,
        sourceReference: sourceReference || null,
        eventOccurredAt: eventOccurredAt || null,
        tags,
        keywords,
        seoTitle,
        seoDescription,
      })
      .returning();

    if (status === 'published') {
      await db
        .update(users)
        .set({ totalPosts: sql`${users.totalPosts} + 1` })
        .where(eq(users.id, req.dbUser.id));

      // Notify followers when published
      const followerRows = await db
        .select({ followerId: follows.followerId })
        .from(follows)
        .where(eq(follows.followingId, req.dbUser.id))
        .limit(50);

      if (followerRows.length > 0) {
        await db.insert(notifications).values(
          followerRows.map((f) => ({
            userId: f.followerId,
            type: isBreaking ? 'breaking_news' : 'post_approved',
            title: `${req.dbUser!.fullName} নতুন সংবাদ প্রকাশ করেছেন`,
            body: title,
            linkUrl: `/news/${slug}`,
          }))
        );
      }
    }

    return res.status(201).json({ post: created });
  } catch (error) {
    console.error('Create post error:', error);
    return res.status(500).json({ error: 'Failed to create news post.' });
  }
});

// React to post (like, love, haha, sad, angry, wow)
router.post('/:id/react', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const postId = Number(req.params.id);
    const type = String(req.body?.type || 'like');
    if (!['like', 'love', 'haha', 'sad', 'angry', 'wow'].includes(type)) {
      return res.status(400).json({ error: 'Invalid reaction type.' });
    }

    const postRows = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    const post = postRows[0];
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const existing = await db
      .select()
      .from(reactions)
      .where(and(eq(reactions.postId, postId), eq(reactions.userId, req.dbUser.id)))
      .limit(1);

    if (existing[0]) {
      if (existing[0].type === type) {
        await db.delete(reactions).where(eq(reactions.id, existing[0].id));
        await db.update(posts).set({ likesCount: sql`GREATEST(0, ${posts.likesCount} - 1)` }).where(eq(posts.id, postId));
        await db.update(users).set({ totalLikes: sql`GREATEST(0, ${users.totalLikes} - 1)` }).where(eq(users.id, post.authorId));
        return res.json({ myReaction: null, delta: -1 });
      }
      await db.update(reactions).set({ type }).where(eq(reactions.id, existing[0].id));
      return res.json({ myReaction: type, delta: 0 });
    }

    await db.insert(reactions).values({ postId, userId: req.dbUser.id, type });
    await db.update(posts).set({ likesCount: sql`${posts.likesCount} + 1` }).where(eq(posts.id, postId));
    await db.update(users).set({ totalLikes: sql`${users.totalLikes} + 1` }).where(eq(users.id, post.authorId));

    if (post.authorId !== req.dbUser.id) {
      await db.insert(notifications).values({
        userId: post.authorId,
        type: 'new_like',
        title: `${req.dbUser.fullName} আপনার সংবাদে রিয়্যাক্ট করেছেন`,
        body: post.title,
        linkUrl: `/news/${post.slug}`,
      });
    }

    return res.json({ myReaction: type, delta: 1 });
  } catch (error) {
    console.error('React error:', error);
    return res.status(500).json({ error: 'Failed to update reaction.' });
  }
});

// Save / Bookmark post
router.post('/:id/save', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const postId = Number(req.params.id);
    const existing = await db
      .select()
      .from(savedPosts)
      .where(and(eq(savedPosts.postId, postId), eq(savedPosts.userId, req.dbUser.id)))
      .limit(1);

    if (existing[0]) {
      await db.delete(savedPosts).where(eq(savedPosts.id, existing[0].id));
      await db.update(posts).set({ savesCount: sql`GREATEST(0, ${posts.savesCount} - 1)` }).where(eq(posts.id, postId));
      return res.json({ isSaved: false });
    }

    await db.insert(savedPosts).values({ postId, userId: req.dbUser.id });
    await db.update(posts).set({ savesCount: sql`${posts.savesCount} + 1` }).where(eq(posts.id, postId));
    return res.json({ isSaved: true });
  } catch (error) {
    console.error('Save post error:', error);
    return res.status(500).json({ error: 'Failed to save post.' });
  }
});

// Share counter
router.post('/:id/share', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    await db.update(posts).set({ sharesCount: sql`${posts.sharesCount} + 1` }).where(eq(posts.id, postId));
    return res.json({ shared: true });
  } catch (error) {
    console.error('Share error:', error);
    return res.status(500).json({ error: 'Failed to track share.' });
  }
});

// Add Comment (with AI toxicity/spam detection flagging)
router.post('/:id/comments', requireAuth, rateLimit('comment', 20, 60_000), async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const postId = Number(req.params.id);
    const content = sanitizeText(req.body?.content, 1500);
    const parentId = req.body?.parentId ? Number(req.body.parentId) : null;

    if (!content) return res.status(400).json({ error: 'Comment content is required.' });

    const postRows = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    const post = postRows[0];
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    if (post.commentsDisabled) return res.status(403).json({ error: 'Comments are disabled for this post.' });

    const aiCheck = await analyzeCommentToxicity(content);

    const [created] = await db
      .insert(comments)
      .values({
        postId,
        userId: req.dbUser.id,
        parentId,
        content,
        aiFlagged: aiCheck.isFlagged,
      })
      .returning();

    await db.update(posts).set({ commentsCount: sql`${posts.commentsCount} + 1` }).where(eq(posts.id, postId));

    if (post.authorId !== req.dbUser.id) {
      await db.insert(notifications).values({
        userId: post.authorId,
        type: 'new_comment',
        title: `${req.dbUser.fullName} আপনার সংবাদে মন্তব্য করেছেন`,
        body: content.slice(0, 120),
        linkUrl: `/news/${post.slug}`,
      });
    }

    return res.status(201).json({
      comment: {
        ...created,
        author: {
          id: req.dbUser.id,
          username: req.dbUser.username,
          fullName: req.dbUser.fullName,
          avatarUrl: req.dbUser.avatarUrl,
          verificationType: req.dbUser.verificationType,
        },
      },
    });
  } catch (error) {
    console.error('Comment error:', error);
    return res.status(500).json({ error: 'Failed to post comment.' });
  }
});

// Delete own comment or Pin comment
router.delete('/:postId/comments/:commentId', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const commentId = Number(req.params.commentId);
    const postId = Number(req.params.postId);

    const found = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!found[0]) return res.status(404).json({ error: 'Comment not found.' });

    const isAdmin = ['super_admin', 'admin', 'moderator'].includes(req.dbUser.role);
    if (found[0].userId !== req.dbUser.id && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own comments.' });
    }

    await db.delete(comments).where(eq(comments.id, commentId));
    await db.update(posts).set({ commentsCount: sql`GREATEST(0, ${posts.commentsCount} - 1)` }).where(eq(posts.id, postId));
    return res.json({ deleted: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

// Report News / Comment (auto moves to under_review at threshold)
router.post('/:id/report', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const targetId = Number(req.params.id);
    const targetType = req.body?.targetType === 'comment' ? 'comment' : 'post';
    const reason = sanitizeText(req.body?.reason, 100);
    const details = sanitizeText(req.body?.details, 1000);

    if (!reason) return res.status(400).json({ error: 'Report reason is required.' });

    await db.insert(reports).values({
      targetType,
      targetId,
      reporterId: req.dbUser.id,
      reason,
      details: details || null,
    });

    if (targetType === 'post') {
      const [updated] = await db
        .update(posts)
        .set({ reportsCount: sql`${posts.reportsCount} + 1` })
        .where(eq(posts.id, targetId))
        .returning();

      if (updated && updated.reportsCount >= 3 && updated.status === 'published') {
        await db.update(posts).set({ status: 'under_review' }).where(eq(posts.id, targetId));
        await db.insert(auditLogs).values({
          actorEmail: 'system-automod@jonokotha.bd',
          actorRole: 'moderator',
          action: 'POST_AUTO_UNDER_REVIEW',
          targetType: 'post',
          targetId: String(targetId),
          details: { reportsCount: updated.reportsCount, reason },
        });
      }
    }

    return res.status(201).json({ reported: true, message: 'আপনার রিপোর্টটি গ্রহণ করা হয়েছে এবং মডারেটর রিভিউতে পাঠানো হয়েছে।' });
  } catch (error) {
    console.error('Report error:', error);
    return res.status(500).json({ error: 'Failed to submit report.' });
  }
});

// Submit Copyright Complaint
router.post('/:id/copyright', requireAuth, async (req: AuthRequest, res) => {
  try {
    const postId = Number(req.params.id);
    const claimantName = sanitizeText(req.body?.claimantName, 120);
    const claimantEmail = sanitizeText(req.body?.claimantEmail, 160);
    const originalSourceUrl = String(req.body?.originalSourceUrl || '').trim();
    const description = sanitizeText(req.body?.description, 1500);

    if (!claimantName || !claimantEmail || !isSafeHttpUrl(originalSourceUrl) || !description) {
      return res.status(400).json({ error: 'Valid claimant details and original source URL are required.' });
    }

    const [created] = await db
      .insert(copyrightClaims)
      .values({
        postId,
        claimantName,
        claimantEmail,
        originalSourceUrl,
        description,
      })
      .returning();

    return res.status(201).json({ claim: created });
  } catch (error) {
    console.error('Copyright claim error:', error);
    return res.status(500).json({ error: 'Failed to file copyright claim.' });
  }
});

// AI Editorial Assist (Gemini 4 Hydrogen — advisory only)
router.post('/ai/editorial-assist', requireAuth, rateLimit('ai-assist', 10, 60_000), async (req: AuthRequest, res) => {
  try {
    const title = sanitizeText(req.body?.title, 220);
    const description = sanitizeText(req.body?.description, 10000);
    const category = sanitizeText(req.body?.category, 60) || 'Local News';
    const locationText = sanitizeText(req.body?.locationText, 120);

    if (!title && !description) {
      return res.status(400).json({ error: 'Provide a draft headline or story body for AI assistance.' });
    }

    const result = await analyzeNewsWithAi({ title, description, category, locationText });
    return res.json(result);
  } catch (error: unknown) {
    console.error('AI editorial assist error:', error);
    const msg = error instanceof Error ? error.message : 'AI editorial assistant failed.';
    return res.status(500).json({ error: msg });
  }
});

export default router;
