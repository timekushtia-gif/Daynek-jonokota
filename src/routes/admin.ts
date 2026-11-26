import { Router } from 'express';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  advertisements,
  auditLogs,
  copyrightClaims,
  earningsLedger,
  notifications,
  platformSettings,
  posts,
  reports,
  users,
  verificationRequests,
  viewEvents,
  withdrawals,
} from '../db/schema.ts';
import { AuthRequest, requireAuth, requirePermission } from '../middleware/auth.ts';
import { isSafeHttpUrl, isSafeImageSource, sanitizeText } from '../lib/security.ts';

const router = Router();

router.use(requireAuth);

async function logAdminAction(
  req: AuthRequest,
  action: string,
  targetType: string,
  targetId: string | number,
  details?: Record<string, unknown>
) {
  await db.insert(auditLogs).values({
    actorId: req.dbUser?.id ?? null,
    actorEmail: req.dbUser?.email ?? 'unknown',
    actorRole: req.dbUser?.role ?? 'admin',
    action,
    targetType,
    targetId: String(targetId),
    details: details ?? {},
    ipAddress: req.ip || null,
  });
}

// Admin Dashboard Overview & Analytics
router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const allowedRoles = ['super_admin', 'admin', 'news_editor', 'moderator', 'finance_manager', 'support_manager'];
    if (!req.dbUser || !allowedRoles.includes(req.dbUser.role)) {
      return res.status(403).json({ error: 'Admin portal access requires an administrative role.' });
    }

    const [allUsers, allPosts, allReports, allWithdrawals, allLedger, allAds, allVerifs, allClaims, suspiciousViews, logs, settings] =
      await Promise.all([
        db.select().from(users).orderBy(desc(users.createdAt)),
        db
          .select({
            post: posts,
            authorName: users.fullName,
            authorUsername: users.username,
          })
          .from(posts)
          .innerJoin(users, eq(posts.authorId, users.id))
          .orderBy(desc(posts.createdAt)),
        db.select().from(reports).orderBy(desc(reports.createdAt)).limit(50),
        db
          .select({
            withdrawal: withdrawals,
            creatorName: users.fullName,
            creatorUsername: users.username,
          })
          .from(withdrawals)
          .innerJoin(users, eq(withdrawals.creatorId, users.id))
          .orderBy(desc(withdrawals.createdAt)),
        db.select().from(earningsLedger).orderBy(desc(earningsLedger.createdAt)).limit(100),
        db.select().from(advertisements).orderBy(desc(advertisements.createdAt)),
        db
          .select({
            request: verificationRequests,
            userName: users.fullName,
            userUsername: users.username,
          })
          .from(verificationRequests)
          .innerJoin(users, eq(verificationRequests.userId, users.id))
          .orderBy(desc(verificationRequests.createdAt)),
        db.select().from(copyrightClaims).orderBy(desc(copyrightClaims.createdAt)),
        db.select().from(viewEvents).where(eq(viewEvents.isSuspicious, true)).orderBy(desc(viewEvents.createdAt)).limit(40),
        db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(40),
        db.select().from(platformSettings),
      ]);

    const totalViews = allPosts.reduce((s, r) => s + r.post.viewsCount, 0);
    const totalLikes = allPosts.reduce((s, r) => s + r.post.likesCount, 0);
    const totalComments = allPosts.reduce((s, r) => s + r.post.commentsCount, 0);
    const totalShares = allPosts.reduce((s, r) => s + r.post.sharesCount, 0);

    const totalRevenue = allLedger.reduce((s, l) => s + Number(l.grossAmountBdt || 0), 0);
    const creatorRevenue = allLedger.reduce((s, l) => s + Number(l.netCreatorBdt || 0), 0);
    const platformRevenue = allLedger.reduce((s, l) => s + Number(l.platformShareBdt || 0), 0);
    const paidWithdrawals = allWithdrawals.filter((w) => w.withdrawal.status === 'paid').reduce((s, w) => s + Number(w.withdrawal.amountBdt || 0), 0);
    const pendingWithdrawals = allWithdrawals.filter((w) => w.withdrawal.status === 'pending').reduce((s, w) => s + Number(w.withdrawal.amountBdt || 0), 0);

    const ledgerByCreator = new Map<number, number>();
    for (const l of allLedger) {
      if (l.status === 'approved') {
        ledgerByCreator.set(l.creatorId, (ledgerByCreator.get(l.creatorId) || 0) + Number(l.netCreatorBdt || 0));
      }
    }
    const withdrawnByCreator = new Map<number, number>();
    for (const w of allWithdrawals) {
      if (['pending', 'processing', 'approved', 'paid'].includes(w.withdrawal.status)) {
        withdrawnByCreator.set(
          w.withdrawal.creatorId,
          (withdrawnByCreator.get(w.withdrawal.creatorId) || 0) + Number(w.withdrawal.amountBdt || 0)
        );
      }
    }

    const safeUsers = allUsers.map((u) => {
      const { passwordHash: _ph, ...rest } = u;
      const approvedEarnings = Number((ledgerByCreator.get(u.id) || 0).toFixed(2));
      const committedWithdrawals = Number((withdrawnByCreator.get(u.id) || 0).toFixed(2));
      return {
        ...rest,
        approvedEarningsBdt: approvedEarnings,
        withdrawableBalanceBdt: Math.max(0, Number((approvedEarnings - committedWithdrawals).toFixed(2))),
      };
    });

    const publicSafeSettings = Object.fromEntries(
      settings.filter((s) => s.key !== 'admin_passcode_hash').map((s) => [s.key, s.value])
    );

    return res.json({
      stats: {
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter((u) => u.accountStatus === 'active').length,
        totalCreators: allUsers.filter((u) => u.totalPosts > 0 || u.role === 'creator').length,
        verifiedUsers: allUsers.filter((u) => u.verificationType !== 'none').length,
        totalPosts: allPosts.length,
        pendingPosts: allPosts.filter((p) => p.post.status === 'pending_review' || p.post.status === 'under_review').length,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        creatorRevenue: Number(creatorRevenue.toFixed(2)),
        platformRevenue: Number(platformRevenue.toFixed(2)),
        totalPayments: Number(paidWithdrawals.toFixed(2)),
        pendingPayments: Number(pendingWithdrawals.toFixed(2)),
        suspiciousViewsCount: suspiciousViews.length,
      },
      users: safeUsers,
      posts: allPosts.map((p) => ({ ...p.post, authorName: p.authorName, authorUsername: p.authorUsername })),
      reports: allReports,
      withdrawals: allWithdrawals.map((w) => ({ ...w.withdrawal, creatorName: w.creatorName, creatorUsername: w.creatorUsername })),
      advertisements: allAds,
      verifications: allVerifs.map((v) => ({ ...v.request, userName: v.userName, userUsername: v.userUsername })),
      copyrightClaims: allClaims,
      suspiciousViews,
      auditLogs: logs,
      settings: publicSafeSettings,
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    return res.status(500).json({ error: 'Failed to load admin overview.' });
  }
});

// User Management: Update status, role, featured, monetization
router.patch('/users/:id', requirePermission('users:manage'), async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);
    const accountStatus = req.body?.accountStatus as string | undefined;
    const role = req.body?.role as string | undefined;
    const monetizationStatus = req.body?.monetizationStatus as string | undefined;
    const verificationType = req.body?.verificationType as string | undefined;
    const creatorLevel = req.body?.creatorLevel !== undefined ? Number(req.body.creatorLevel) : undefined;
    const copyrightStrikes = req.body?.copyrightStrikes !== undefined ? Number(req.body.copyrightStrikes) : undefined;
    const guidelineViolations = req.body?.guidelineViolations !== undefined ? Number(req.body.guidelineViolations) : undefined;
    const fullName = req.body?.fullName !== undefined ? sanitizeText(req.body.fullName, 100) : undefined;
    const bio = req.body?.bio !== undefined ? sanitizeText(req.body.bio, 500) : undefined;
    const isFeaturedCreator = typeof req.body?.isFeaturedCreator === 'boolean' ? req.body.isFeaturedCreator : undefined;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (accountStatus && ['active', 'suspended', 'banned'].includes(accountStatus)) updates.accountStatus = accountStatus;
    if (role && ['super_admin', 'admin', 'news_editor', 'moderator', 'finance_manager', 'support_manager', 'creator', 'user'].includes(role)) {
      if (role === 'super_admin' && req.dbUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only Super Admin can assign Super Admin role.' });
      }
      updates.role = role;
    }
    if (monetizationStatus && ['not_eligible', 'eligible', 'under_review', 'monetized', 'suspended', 'disabled'].includes(monetizationStatus)) {
      updates.monetizationStatus = monetizationStatus;
    }
    if (verificationType && ['none', 'local_reporter', 'verified_creator', 'official_org'].includes(verificationType)) {
      updates.verificationType = verificationType;
    }
    if (creatorLevel !== undefined && Number.isInteger(creatorLevel) && creatorLevel >= 1 && creatorLevel <= 5) {
      updates.creatorLevel = creatorLevel;
    }
    if (copyrightStrikes !== undefined && Number.isInteger(copyrightStrikes) && copyrightStrikes >= 0 && copyrightStrikes <= 100) {
      updates.copyrightStrikes = copyrightStrikes;
    }
    if (guidelineViolations !== undefined && Number.isInteger(guidelineViolations) && guidelineViolations >= 0 && guidelineViolations <= 100) {
      updates.guidelineViolations = guidelineViolations;
    }
    if (fullName) updates.fullName = fullName;
    if (bio !== undefined) updates.bio = bio;
    if (isFeaturedCreator !== undefined) updates.isFeaturedCreator = isFeaturedCreator;

    const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
    if (!updated) return res.status(404).json({ error: 'User not found.' });

    if (monetizationStatus === 'monetized') {
      await db.insert(notifications).values({
        userId,
        type: 'monetization_approved',
        title: 'অভিনন্দন! আপনার মনিটাইজেশন চালু হয়েছে',
        body: 'এখন থেকে আপনার প্রকাশিত সংবাদের ভ্যালিড ভিউ ও বিজ্ঞাপন থেকে আয় শুরু হবে।',
        linkUrl: '/creator',
      });
    } else if (monetizationStatus === 'disabled' || monetizationStatus === 'suspended') {
      await db.insert(notifications).values({
        userId,
        type: 'admin_announcement',
        title: 'মনিটাইজেশন স্ট্যাটাস আপডেট হয়েছে',
        body: `অ্যাডমিন কর্তৃক আপনার মনিটাইজেশন স্ট্যাটাস "${monetizationStatus}" করা হয়েছে।`,
        linkUrl: '/creator',
      });
    }

    await logAdminAction(req, 'USER_UPDATED', 'user', userId, updates);
    const { passwordHash: _ph, ...safe } = updated;
    return res.json({ user: safe });
  } catch (error) {
    console.error('Admin update user error:', error);
    return res.status(500).json({ error: 'Failed to update user.' });
  }
});

// News & Media Moderation
router.patch('/posts/:id/moderate', requirePermission('posts:moderate'), async (req: AuthRequest, res) => {
  try {
    const postId = Number(req.params.id);
    const status = req.body?.status as string | undefined;
    const rejectionReason = sanitizeText(req.body?.rejectionReason, 500);
    const isBreaking = typeof req.body?.isBreaking === 'boolean' ? req.body.isBreaking : undefined;
    const isFeatured = typeof req.body?.isFeatured === 'boolean' ? req.body.isFeatured : undefined;
    const commentsDisabled = typeof req.body?.commentsDisabled === 'boolean' ? req.body.commentsDisabled : undefined;
    const sharingDisabled = typeof req.body?.sharingDisabled === 'boolean' ? req.body.sharingDisabled : undefined;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status && ['draft', 'pending_review', 'approved', 'rejected', 'published', 'hidden', 'archived', 'under_review'].includes(status)) {
      updates.status = status;
    }
    if (rejectionReason) updates.rejectionReason = rejectionReason;
    if (isBreaking !== undefined) updates.isBreaking = isBreaking;
    if (isFeatured !== undefined) updates.isFeatured = isFeatured;
    if (commentsDisabled !== undefined) updates.commentsDisabled = commentsDisabled;
    if (sharingDisabled !== undefined) updates.sharingDisabled = sharingDisabled;

    const [updated] = await db.update(posts).set(updates).where(eq(posts.id, postId)).returning();
    if (!updated) return res.status(404).json({ error: 'Post not found.' });

    if (status === 'published' || status === 'approved') {
      await db.insert(notifications).values({
        userId: updated.authorId,
        type: 'post_approved',
        title: 'আপনার সংবাদটি অনুমোদিত ও প্রকাশিত হয়েছে',
        body: updated.title,
        linkUrl: `/news/${updated.slug}`,
      });
    } else if (status === 'rejected') {
      await db.insert(notifications).values({
        userId: updated.authorId,
        type: 'post_rejected',
        title: 'সংবাদটি রিজেক্ট করা হয়েছে',
        body: rejectionReason || 'কমিউনিটি গাইডলাইন অনুযায়ী তথ্য যাচাই করুন।',
        linkUrl: '/creator',
      });
    }

    await logAdminAction(req, 'POST_MODERATED', 'post', postId, updates);
    return res.json({ post: updated });
  } catch (error) {
    console.error('Moderate post error:', error);
    return res.status(500).json({ error: 'Failed to moderate post.' });
  }
});

router.delete('/posts/:id', requirePermission('posts:moderate'), async (req: AuthRequest, res) => {
  try {
    const postId = Number(req.params.id);
    await db.delete(posts).where(eq(posts.id, postId));
    await logAdminAction(req, 'POST_DELETED', 'post', postId);
    return res.json({ deleted: true });
  } catch (error) {
    console.error('Delete post error:', error);
    return res.status(500).json({ error: 'Failed to delete post.' });
  }
});

// Reports Review
router.patch('/reports/:id', requirePermission('reports:manage'), async (req: AuthRequest, res) => {
  try {
    const reportId = Number(req.params.id);
    const status = String(req.body?.status || 'reviewed');
    const [updated] = await db
      .update(reports)
      .set({ status, reviewedBy: req.dbUser?.id ?? null })
      .where(eq(reports.id, reportId))
      .returning();
    await logAdminAction(req, 'REPORT_REVIEWED', 'report', reportId, { status });
    return res.json({ report: updated });
  } catch (error) {
    console.error('Review report error:', error);
    return res.status(500).json({ error: 'Failed to update report.' });
  }
});

// Copyright Claim Action
router.patch('/copyright/:id', requirePermission('posts:moderate'), async (req: AuthRequest, res) => {
  try {
    const claimId = Number(req.params.id);
    const status = String(req.body?.status || 'upheld');
    const adminAction = sanitizeText(req.body?.adminAction, 120);

    const [claim] = await db
      .update(copyrightClaims)
      .set({ status, adminAction })
      .where(eq(copyrightClaims.id, claimId))
      .returning();

    if (claim && status === 'upheld') {
      const [postRow] = await db.select().from(posts).where(eq(posts.id, claim.postId)).limit(1);
      if (postRow) {
        await db.update(posts).set({ status: 'hidden' }).where(eq(posts.id, postRow.id));
        await db
          .update(users)
          .set({
            copyrightStrikes: sql`${users.copyrightStrikes} + 1`,
            ...(adminAction === 'suspend_monetization' ? { monetizationStatus: 'suspended' } : {}),
          })
          .where(eq(users.id, postRow.authorId));
      }
    }

    await logAdminAction(req, 'COPYRIGHT_CLAIM_RESOLVED', 'copyright_claim', claimId, { status, adminAction });
    return res.json({ claim });
  } catch (error) {
    console.error('Copyright resolve error:', error);
    return res.status(500).json({ error: 'Failed to resolve copyright claim.' });
  }
});

// Verification Queue
router.patch('/verifications/:id', requirePermission('verification:manage'), async (req: AuthRequest, res) => {
  try {
    const reqId = Number(req.params.id);
    const status = req.body?.status === 'approved' ? 'approved' : 'rejected';
    const adminNotes = sanitizeText(req.body?.adminNotes, 300);

    const [vReq] = await db
      .update(verificationRequests)
      .set({ status, adminNotes })
      .where(eq(verificationRequests.id, reqId))
      .returning();

    if (vReq && status === 'approved') {
      await db
        .update(users)
        .set({ verificationType: vReq.verificationType, creatorLevel: 4, updatedAt: new Date() })
        .where(eq(users.id, vReq.userId));

      await db.insert(notifications).values({
        userId: vReq.userId,
        type: 'admin_announcement',
        title: 'ভেরিফিকেশন ব্যাজ অনুমোদিত হয়েছে',
        body: `আপনার প্রোফাইলে এখন অফিশিয়াল ${vReq.verificationType} ব্যাজ যুক্ত হয়েছে।`,
        linkUrl: '/creator',
      });
    }

    await logAdminAction(req, 'VERIFICATION_REVIEWED', 'verification_request', reqId, { status });
    return res.json({ verification: vReq });
  } catch (error) {
    console.error('Verification review error:', error);
    return res.status(500).json({ error: 'Failed to review verification.' });
  }
});

// Advertisement Management
router.post('/ads', requirePermission('ads:manage'), async (req: AuthRequest, res) => {
  try {
    const title = sanitizeText(req.body?.title, 160);
    const advertiserName = sanitizeText(req.body?.advertiserName, 120);
    const adType = sanitizeText(req.body?.adType, 40) || 'native';
    const placement = sanitizeText(req.body?.placement, 40) || 'feed';
    const targetCategory = sanitizeText(req.body?.targetCategory, 60) || 'All';
    const targetDistrict = sanitizeText(req.body?.targetDistrict, 60) || 'All';
    const imageUrl = isSafeImageSource(req.body?.imageUrl, 1_200_000) ? req.body.imageUrl.trim() : null;
    const destinationUrl = String(req.body?.destinationUrl || '').trim();
    const budgetBdt = Math.max(100, Number(req.body?.budgetBdt) || 5000);
    const cpmBdt = Math.max(10, Number(req.body?.cpmBdt) || 60);
    const cpcBdt = Math.max(1, Number(req.body?.cpcBdt) || 5);
    const maxImpressions = Math.max(1000, Number(req.body?.maxImpressions) || 100000);

    if (!title || !advertiserName || !isSafeHttpUrl(destinationUrl)) {
      return res.status(400).json({ error: 'Title, advertiser name, and valid HTTP(S) destination URL are required.' });
    }

    const [created] = await db
      .insert(advertisements)
      .values({
        title,
        advertiserName,
        adType,
        placement,
        targetCategory,
        targetDistrict,
        imageUrl,
        destinationUrl,
        budgetBdt,
        cpmBdt,
        cpcBdt,
        maxImpressions,
        startDate: sanitizeText(req.body?.startDate, 30) || '2026-11-25',
        endDate: sanitizeText(req.body?.endDate, 30) || '2026-12-31',
        status: 'active',
      })
      .returning();

    await logAdminAction(req, 'AD_CREATED', 'advertisement', created.id, { title, budgetBdt });
    return res.status(201).json({ advertisement: created });
  } catch (error) {
    console.error('Create ad error:', error);
    return res.status(500).json({ error: 'Failed to create advertisement.' });
  }
});

router.patch('/ads/:id', requirePermission('ads:manage'), async (req: AuthRequest, res) => {
  try {
    const adId = Number(req.params.id);
    const status = req.body?.status as string;
    if (!['active', 'paused', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid ad status.' });
    }
    const [updated] = await db.update(advertisements).set({ status }).where(eq(advertisements.id, adId)).returning();
    await logAdminAction(req, 'AD_STATUS_CHANGED', 'advertisement', adId, { status });
    return res.json({ advertisement: updated });
  } catch (error) {
    console.error('Update ad error:', error);
    return res.status(500).json({ error: 'Failed to update ad.' });
  }
});

// Withdrawal Payment Processing (Finance Manager / Admin)
router.patch('/withdrawals/:id', requirePermission('payments:manage'), async (req: AuthRequest, res) => {
  try {
    const wId = Number(req.params.id);
    const status = String(req.body?.status || 'approved');
    const transactionRef = sanitizeText(req.body?.transactionRef, 120);
    const adminNote = sanitizeText(req.body?.adminNote, 300);

    if (!['pending', 'processing', 'approved', 'paid', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid payment status.' });
    }
    if (status === 'paid' && !transactionRef) {
      return res.status(400).json({ error: 'Unique Transaction ID / Reference is required when marking Paid.' });
    }

    const [updated] = await db
      .update(withdrawals)
      .set({
        status,
        transactionRef: transactionRef || undefined,
        adminNote: adminNote || undefined,
        processedBy: req.dbUser?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, wId))
      .returning();

    if (updated) {
      await db.insert(notifications).values({
        userId: updated.creatorId,
        type: 'payment_approved',
        title: status === 'paid' ? 'পেমেন্ট সম্পন্ন হয়েছে' : `পেমেন্ট স্ট্যাটাস: ${status}`,
        body: `৳${updated.amountBdt} (${updated.paymentMethod.toUpperCase()})${transactionRef ? ` · Ref: ${transactionRef}` : ''}`,
        linkUrl: '/creator',
      });
    }

    await logAdminAction(req, 'WITHDRAWAL_PROCESSED', 'withdrawal', wId, { status, transactionRef });
    return res.json({ withdrawal: updated });
  } catch (error) {
    console.error('Process withdrawal error:', error);
    return res.status(500).json({ error: 'Failed to process withdrawal.' });
  }
});

// Credit Revenue Share to Creator Ledger (Admin/Finance)
router.post('/ledger/credit', requirePermission('payments:manage'), async (req: AuthRequest, res) => {
  try {
    const creatorId = Number(req.body?.creatorId);
    const grossAmountBdt = Number(req.body?.grossAmountBdt || 0);
    const note = sanitizeText(req.body?.note, 300) || 'Admin Revenue Share Settlement';

    if (!creatorId || !Number.isFinite(grossAmountBdt) || grossAmountBdt <= 0) {
      return res.status(400).json({ error: 'Valid creatorId and gross amount are required.' });
    }

    const shareRow = await db.select().from(platformSettings).where(eq(platformSettings.key, 'creator_revenue_share_pct')).limit(1);
    const creatorSharePct = Number(shareRow[0]?.value ?? 60);
    const netCreatorBdt = (grossAmountBdt * creatorSharePct) / 100;
    const platformShareBdt = grossAmountBdt - netCreatorBdt;

    const [entry] = await db
      .insert(earningsLedger)
      .values({
        creatorId,
        entryType: 'ad_revenue_share',
        grossAmountBdt: grossAmountBdt.toFixed(2),
        creatorSharePct,
        netCreatorBdt: netCreatorBdt.toFixed(2),
        platformShareBdt: platformShareBdt.toFixed(2),
        status: 'approved',
        note,
      })
      .returning();

    await logAdminAction(req, 'LEDGER_CREDITED', 'earnings_ledger', entry.id, { creatorId, grossAmountBdt, creatorSharePct });
    return res.status(201).json({ entry });
  } catch (error) {
    console.error('Ledger credit error:', error);
    return res.status(500).json({ error: 'Failed to credit ledger.' });
  }
});

// Platform Settings Update (including Google AdSense structured config & Logo validation)
const ALLOWED_ADSENSE_FORMATS = new Set(['auto', 'fluid', 'autorelaxed', 'rectangle', 'horizontal', 'vertical', 'in-article']);

function sanitizeSettingValue(key: string, value: unknown): unknown {
  if (key === 'adsense_publisher_id') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw.startsWith('pub-') ? `ca-${raw}` : raw;
    if (!/^ca-pub-\d{10,20}$/.test(normalized)) {
      throw new Error('সঠিক Google AdSense Publisher ID দিন (যেমন: ca-pub-1234567890123456)।');
    }
    return normalized;
  }

  if (/^adsense_(header|feed|sidebar|article|multiplex|footer)_slot$/.test(key)) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (!/^\d{6,20}$/.test(raw)) {
      throw new Error(`সঠিক AdSense Slot ID দিন (${key}: শুধু সংখ্যা)।`);
    }
    return raw;
  }

  if (/^adsense_(header|feed|sidebar|article|multiplex|footer)_format$/.test(key)) {
    const raw = String(value || 'auto').trim();
    return ALLOWED_ADSENSE_FORMATS.has(raw) ? raw : 'auto';
  }

  if (key === 'adsense_ads_txt') {
    return sanitizeText(String(value || ''), 4000);
  }

  if (key === 'site_logo_url') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const isRasterDataUri = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(raw) && raw.length <= 600_000;
    if (!isSafeHttpUrl(raw) && !isRasterDataUri) {
      throw new Error('সঠিক লোগো URL (https:// বা আপলোড করা PNG/JPG/WebP ছবি, সর্বোচ্চ 400KB) দিন।');
    }
    return raw;
  }

  if (typeof value === 'string') {
    return sanitizeText(value, 2000);
  }
  return value;
}

router.put('/settings', requirePermission('settings:manage'), async (req: AuthRequest, res) => {
  try {
    const updates = req.body?.settings as Record<string, unknown>;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Settings payload is required.' });
    }

    const sanitizedEntries: [string, unknown][] = [];
    for (const [key, value] of Object.entries(updates)) {
      const cleanKey = sanitizeText(key, 80);
      if (!cleanKey || cleanKey === 'admin_passcode_hash') continue;
      const cleanVal = sanitizeSettingValue(cleanKey, value);
      sanitizedEntries.push([cleanKey, cleanVal]);
    }

    for (const [cleanKey, cleanVal] of sanitizedEntries) {
      await db
        .insert(platformSettings)
        .values({ key: cleanKey, value: cleanVal, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: { value: cleanVal, updatedAt: new Date() },
        });
    }

    await logAdminAction(req, 'SETTINGS_UPDATED', 'platform_settings', 'global', {
      keys: sanitizedEntries.map(([k]) => k),
    });
    return res.json({ updated: true });
  } catch (error) {
    console.error('Update settings error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update settings.';
    return res.status(400).json({ error: msg });
  }
});

export default router;
