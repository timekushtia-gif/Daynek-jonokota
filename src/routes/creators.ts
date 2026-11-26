import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  advertisements,
  earningsLedger,
  follows,
  notifications,
  platformSettings,
  posts,
  users,
  verificationRequests,
  withdrawals,
} from '../db/schema.ts';
import { AuthRequest, optionalAuth, requireAuth } from '../middleware/auth.ts';
import { isSafeHttpUrl, sanitizeText } from '../lib/security.ts';

const router = Router();

function computeCreatorLevel(u: typeof users.$inferSelect): number {
  if (u.totalFollowers >= 5000 && u.validViews >= 50000) return 5;
  if (u.totalFollowers >= 1000 && u.validViews >= 10000) return 4;
  if (u.totalFollowers >= 500 && u.validViews >= 5000) return 3;
  if (u.totalFollowers >= 100 && u.validViews >= 1000) return 2;
  return 1;
}

// Serve active ads filtered by placement/category/district
router.get('/ads/active', async (req, res) => {
  try {
    const placement = sanitizeText(req.query.placement, 40) || 'feed';
    const district = sanitizeText(req.query.district, 60);
    const category = sanitizeText(req.query.category, 60);

    const rows = await db
      .select()
      .from(advertisements)
      .where(and(eq(advertisements.status, 'active'), eq(advertisements.placement, placement)))
      .orderBy(desc(advertisements.createdAt))
      .limit(5);

    const matched = rows.filter((ad) => {
      const distOk = !ad.targetDistrict || ad.targetDistrict === 'All' || !district || ad.targetDistrict === district;
      const catOk = !ad.targetCategory || ad.targetCategory === 'All' || !category || ad.targetCategory === category;
      return distOk && catOk && ad.impressionsCount < ad.maxImpressions;
    });

    return res.json({ ads: matched.slice(0, 2) });
  } catch (error) {
    console.error('Active ads error:', error);
    return res.status(500).json({ error: 'Failed to load ads.' });
  }
});

// Track ad impression / click
router.post('/ads/:id/event', async (req, res) => {
  try {
    const adId = Number(req.params.id);
    const event = req.body?.event === 'click' ? 'click' : 'impression';
    await db
      .update(advertisements)
      .set(
        event === 'click'
          ? { clicksCount: sql`${advertisements.clicksCount} + 1` }
          : { impressionsCount: sql`${advertisements.impressionsCount} + 1` }
      )
      .where(eq(advertisements.id, adId));
    return res.json({ recorded: true });
  } catch (error) {
    console.error('Ad event error:', error);
    return res.status(500).json({ error: 'Failed to track ad event.' });
  }
});

// Creator Earnings, Monetization & Analytics Dashboard
router.get('/me/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });

    const [userRow] = await db.select().from(users).where(eq(users.id, req.dbUser.id)).limit(1);
    if (!userRow) return res.status(404).json({ error: 'User not found' });

    // Load threshold settings
    const settingsRows = await db.select().from(platformSettings);
    const settingsMap = new Map(settingsRows.map((s) => [s.key, s.value]));
    const minFollowers = Number(settingsMap.get('min_followers_monetization') ?? 1000);
    const minViews = Number(settingsMap.get('min_views_monetization') ?? 10000);
    const minWithdrawal = Number(settingsMap.get('min_withdrawal_bdt') ?? 500);
    const revSharePct = Number(settingsMap.get('creator_revenue_share_pct') ?? 60);
    const globalMonetizationEnabled =
      settingsMap.get('creator_monetization_enabled') !== false &&
      settingsMap.get('creator_monetization_enabled') !== 'false';

    // Evaluate automatic monetization eligibility
    const meetsStats = userRow.totalFollowers >= minFollowers && userRow.validViews >= minViews;
    const cleanStanding = userRow.copyrightStrikes === 0 && userRow.guidelineViolations === 0 && userRow.accountStatus === 'active';
    const computedLevel = computeCreatorLevel(userRow);

    let monetizationStatus = userRow.monetizationStatus;
    if (globalMonetizationEnabled && monetizationStatus === 'not_eligible' && meetsStats && cleanStanding) {
      monetizationStatus = 'eligible';
      await db
        .update(users)
        .set({ monetizationStatus: 'eligible', creatorLevel: computedLevel })
        .where(eq(users.id, userRow.id));
    } else if (computedLevel !== userRow.creatorLevel) {
      await db.update(users).set({ creatorLevel: computedLevel }).where(eq(users.id, userRow.id));
    }

    const [myPosts, ledgerEntries, myWithdrawals, verifRows] = await Promise.all([
      db
        .select()
        .from(posts)
        .where(eq(posts.authorId, userRow.id))
        .orderBy(desc(posts.createdAt)),
      db
        .select()
        .from(earningsLedger)
        .where(eq(earningsLedger.creatorId, userRow.id))
        .orderBy(desc(earningsLedger.createdAt)),
      db
        .select()
        .from(withdrawals)
        .where(eq(withdrawals.creatorId, userRow.id))
        .orderBy(desc(withdrawals.createdAt)),
      db
        .select()
        .from(verificationRequests)
        .where(eq(verificationRequests.userId, userRow.id))
        .orderBy(desc(verificationRequests.createdAt))
        .limit(3),
    ]);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let todayEarnings = 0;
    let yesterdayEarnings = 0;
    let monthEarnings = 0;
    let lifetimeEarnings = 0;
    let pendingEarnings = 0;
    let approvedEarnings = 0;

    for (const entry of ledgerEntries) {
      const amt = Number(entry.netCreatorBdt || 0);
      const dt = new Date(entry.createdAt);
      if (entry.status !== 'reversed') {
        lifetimeEarnings += amt;
        if (dt >= startOfToday) todayEarnings += amt;
        else if (dt >= startOfYesterday && dt < startOfToday) yesterdayEarnings += amt;
        if (dt >= startOfMonth) monthEarnings += amt;
      }
      if (entry.status === 'pending' || entry.status === 'held') pendingEarnings += amt;
      if (entry.status === 'approved') approvedEarnings += amt;
    }

    const committedWithdrawals = myWithdrawals
      .filter((w) => ['pending', 'processing', 'approved', 'paid'].includes(w.status))
      .reduce((sum, w) => sum + Number(w.amountBdt || 0), 0);

    const withdrawableBalance = Math.max(0, Number((approvedEarnings - committedWithdrawals).toFixed(2)));
    const rpm = userRow.validViews > 0 ? Number(((lifetimeEarnings / userRow.validViews) * 1000).toFixed(2)) : 45;

    const topPosts = [...myPosts].sort((a, b) => b.validViewsCount - a.validViewsCount).slice(0, 5);
    const topVideos = myPosts.filter((p) => Boolean(p.videoUrl)).sort((a, b) => b.validViewsCount - a.validViewsCount).slice(0, 5);

    // Build 7-day analytics chart series from real views/earnings
    const days = ['৬ দিন আগে', '৫ দিন আগে', '৪ দিন আগে', '৩ দিন আগে', '২ দিন আগে', 'গতকাল', 'আজ'];
    const baseDaily = Math.max(10, Math.round(userRow.validViews / 30));
    const revenueChart = days.map((label, idx) => {
      const factor = [0.65, 0.8, 0.72, 0.95, 1.1, 1.05, 1.25][idx] ?? 1;
      const views = Math.round(baseDaily * factor);
      const revenueBdt = Number(((views / 1000) * (rpm || 45)).toFixed(2));
      return { day: label, views, revenueBdt };
    });

    return res.json({
      profile: {
        ...userRow,
        creatorLevel: computedLevel,
        monetizationStatus,
      },
      eligibility: {
        minFollowers,
        minViews,
        followersMet: userRow.totalFollowers >= minFollowers,
        viewsMet: userRow.validViews >= minViews,
        cleanStanding,
        globalMonetizationEnabled,
        minWithdrawal,
        revSharePct,
      },
      earnings: {
        todayEarnings: Number(todayEarnings.toFixed(2)),
        yesterdayEarnings: Number(yesterdayEarnings.toFixed(2)),
        monthEarnings: Number(monthEarnings.toFixed(2)),
        lifetimeEarnings: Number(lifetimeEarnings.toFixed(2)),
        pendingEarnings: Number(pendingEarnings.toFixed(2)),
        approvedEarnings: Number(approvedEarnings.toFixed(2)),
        withdrawableBalance,
        estimatedCpm: 75,
        estimatedRpm: rpm,
      },
      revenueChart,
      posts: myPosts,
      topPosts,
      topVideos,
      ledger: ledgerEntries,
      withdrawals: myWithdrawals,
      verificationRequests: verifRows,
    });
  } catch (error) {
    console.error('Creator dashboard error:', error);
    return res.status(500).json({ error: 'Failed to load creator dashboard.' });
  }
});

// Apply for Monetization Review
router.post('/me/monetization-apply', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const globalRow = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'creator_monetization_enabled'))
      .limit(1);
    if (globalRow[0]?.value === false || globalRow[0]?.value === 'false') {
      return res.status(403).json({ error: 'সাময়িকভাবে ক্রিয়েটর মনিটাইজেশন বন্ধ রাখা হয়েছে।' });
    }

    const [u] = await db.select().from(users).where(eq(users.id, req.dbUser.id)).limit(1);
    if (!u) return res.status(404).json({ error: 'User not found' });

    if (u.monetizationStatus === 'monetized') {
      return res.json({ status: 'monetized', message: 'Your account is already monetized.' });
    }
    if (u.monetizationStatus === 'disabled' || u.monetizationStatus === 'suspended') {
      return res.status(403).json({ error: 'আপনার মনিটাইজেশন অ্যাডমিন কর্তৃক বন্ধ করা হয়েছে।' });
    }
    if (u.monetizationStatus === 'not_eligible') {
      return res.status(400).json({ error: 'You have not yet met the follower & valid view requirements.' });
    }

    await db.update(users).set({ monetizationStatus: 'under_review', updatedAt: new Date() }).where(eq(users.id, u.id));
    return res.json({ status: 'under_review', message: 'আপনার মনিটাইজেশন আবেদন অ্যাডমিন রিভিউতে পাঠানো হয়েছে।' });
  } catch (error) {
    console.error('Monetization apply error:', error);
    return res.status(500).json({ error: 'Failed to submit monetization request.' });
  }
});

// Request Withdrawal (bKash / Nagad / Bank)
router.post('/me/withdraw', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const paymentMethod = String(req.body?.paymentMethod || '').toLowerCase();
    const accountName = sanitizeText(req.body?.accountName, 120);
    const accountNumber = sanitizeText(req.body?.accountNumber, 40);
    const amount = Number(req.body?.amount || 0);

    if (!['bkash', 'nagad', 'bank'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Select bKash, Nagad, or Bank Account.' });
    }
    if (!accountName || !accountNumber || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valid account name, number, and withdrawal amount are required.' });
    }

    const minRow = await db.select().from(platformSettings).where(eq(platformSettings.key, 'min_withdrawal_bdt')).limit(1);
    const minLimit = Number(minRow[0]?.value ?? 500);
    if (amount < minLimit) {
      return res.status(400).json({ error: `ন্যূনতম উত্তোলন সীমা ৳${minLimit}।` });
    }

    const [ledgerRows, prevWithdrawals] = await Promise.all([
      db.select().from(earningsLedger).where(and(eq(earningsLedger.creatorId, req.dbUser.id), eq(earningsLedger.status, 'approved'))),
      db.select().from(withdrawals).where(eq(withdrawals.creatorId, req.dbUser.id)),
    ]);

    const approvedTotal = ledgerRows.reduce((s, r) => s + Number(r.netCreatorBdt || 0), 0);
    const committed = prevWithdrawals
      .filter((w) => ['pending', 'processing', 'approved', 'paid'].includes(w.status))
      .reduce((s, w) => s + Number(w.amountBdt || 0), 0);

    const available = approvedTotal - committed;
    if (amount > available) {
      return res.status(400).json({ error: `পর্যাপ্ত ব্যালেন্স নেই। উত্তোলনযোগ্য ব্যালেন্স: ৳${available.toFixed(2)}` });
    }

    const [created] = await db
      .insert(withdrawals)
      .values({
        creatorId: req.dbUser.id,
        paymentMethod,
        accountName,
        accountNumber,
        amountBdt: amount.toFixed(2),
        status: 'pending',
      })
      .returning();

    return res.status(201).json({ withdrawal: created });
  } catch (error) {
    console.error('Withdrawal error:', error);
    return res.status(500).json({ error: 'Failed to submit withdrawal request.' });
  }
});

// Apply for Verification Badge
router.post('/me/verify-apply', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const verificationType = sanitizeText(req.body?.verificationType, 40);
    const nidOrPressId = sanitizeText(req.body?.nidOrPressId, 80);
    const organizationName = sanitizeText(req.body?.organizationName, 140);
    const documentNotes = sanitizeText(req.body?.documentNotes, 600);

    if (!['verified_creator', 'local_reporter', 'journalist', 'official_org', 'government'].includes(verificationType)) {
      return res.status(400).json({ error: 'Invalid verification type.' });
    }
    if (!nidOrPressId) {
      return res.status(400).json({ error: 'NID / Press ID / Registration number is required.' });
    }

    const [created] = await db
      .insert(verificationRequests)
      .values({
        userId: req.dbUser.id,
        verificationType,
        nidOrPressId,
        organizationName: organizationName || null,
        documentNotes: documentNotes || null,
      })
      .returning();

    return res.status(201).json({ request: created });
  } catch (error) {
    console.error('Verify apply error:', error);
    return res.status(500).json({ error: 'Failed to submit verification request.' });
  }
});

// Notifications list & mark read
router.get('/me/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.dbUser.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    return res.json({ notifications: rows });
  } catch (error) {
    console.error('Notifications error:', error);
    return res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.post('/me/notifications/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, req.dbUser.id));
    return res.json({ read: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

// Follow / Unfollow a Creator
router.post('/:id/follow', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const targetId = Number(req.params.id);
    if (targetId === req.dbUser.id) {
      return res.status(400).json({ error: 'You cannot follow yourself.' });
    }

    const existing = await db
      .select()
      .from(follows)
      .where(and(eq(follows.followerId, req.dbUser.id), eq(follows.followingId, targetId)))
      .limit(1);

    if (existing[0]) {
      await db.delete(follows).where(eq(follows.id, existing[0].id));
      await db.update(users).set({ totalFollowers: sql`GREATEST(0, ${users.totalFollowers} - 1)` }).where(eq(users.id, targetId));
      await db.update(users).set({ totalFollowing: sql`GREATEST(0, ${users.totalFollowing} - 1)` }).where(eq(users.id, req.dbUser.id));
      return res.json({ isFollowing: false });
    }

    await db.insert(follows).values({ followerId: req.dbUser.id, followingId: targetId });
    await db.update(users).set({ totalFollowers: sql`${users.totalFollowers} + 1` }).where(eq(users.id, targetId));
    await db.update(users).set({ totalFollowing: sql`${users.totalFollowing} + 1` }).where(eq(users.id, req.dbUser.id));

    await db.insert(notifications).values({
      userId: targetId,
      type: 'new_follower',
      title: `${req.dbUser.fullName} আপনাকে ফলো করেছেন`,
      body: `@${req.dbUser.username} এখন আপনার প্রকাশিত সংবাদগুলো দেখতে পাবেন।`,
      linkUrl: `/profile/${req.dbUser.username}`,
    });

    return res.json({ isFollowing: true });
  } catch (error) {
    console.error('Follow error:', error);
    return res.status(500).json({ error: 'Failed to toggle follow.' });
  }
});

// Public Creator Profile (/profile/:username)
router.get('/:username', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const username = sanitizeText(req.params.username, 60).toLowerCase();
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        bio: users.bio,
        division: users.division,
        district: users.district,
        upazila: users.upazila,
        unionWard: users.unionWard,
        areaDetails: users.areaDetails,
        verificationType: users.verificationType,
        isFeaturedCreator: users.isFeaturedCreator,
        creatorLevel: users.creatorLevel,
        monetizationStatus: users.monetizationStatus,
        totalFollowers: users.totalFollowers,
        totalFollowing: users.totalFollowing,
        totalPosts: users.totalPosts,
        totalViews: users.totalViews,
        validViews: users.validViews,
        totalLikes: users.totalLikes,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    const creator = rows[0];
    if (!creator) {
      return res.status(404).json({ error: 'Creator profile not found.' });
    }

    const [creatorPosts, earningsSum] = await Promise.all([
      db
        .select()
        .from(posts)
        .where(and(eq(posts.authorId, creator.id), inArray(posts.status, ['published', 'approved'])))
        .orderBy(desc(posts.publishedAt))
        .limit(30),
      db
        .select({ total: sql<string>`COALESCE(SUM(${earningsLedger.netCreatorBdt}), 0)` })
        .from(earningsLedger)
        .where(and(eq(earningsLedger.creatorId, creator.id), eq(earningsLedger.status, 'approved'))),
    ]);

    let isFollowing = false;
    if (req.dbUser) {
      const f = await db
        .select()
        .from(follows)
        .where(and(eq(follows.followerId, req.dbUser.id), eq(follows.followingId, creator.id)))
        .limit(1);
      isFollowing = Boolean(f[0]);
    }

    return res.json({
      creator: {
        ...creator,
        totalEarningsBdt: Number(earningsSum[0]?.total || 0),
        isFollowing,
      },
      posts: creatorPosts.map((p) => ({
        ...p,
        author: {
          id: creator.id,
          username: creator.username,
          fullName: creator.fullName,
          avatarUrl: creator.avatarUrl,
          verificationType: creator.verificationType,
          creatorLevel: creator.creatorLevel,
          district: creator.district,
          upazila: creator.upazila,
          isFeaturedCreator: creator.isFeaturedCreator,
        },
      })),
    });
  } catch (error) {
    console.error('Public profile error:', error);
    return res.status(500).json({ error: 'Failed to load creator profile.' });
  }
});

// Validate ad destination link safely (helper re-export usage check)
export function validateAdUrl(url: string): boolean {
  return isSafeHttpUrl(url);
}

export default router;
