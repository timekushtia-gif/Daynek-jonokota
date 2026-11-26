import { Router } from 'express';
import { eq, or } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../db/index.ts';
import { auditLogs, notifications, platformSettings, users } from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import {
  createOtpChallenge,
  hashPassword,
  isSafeImageSource,
  rateLimit,
  sanitizeText,
  signSessionToken,
  validateStrongPassword,
  verifyOtpChallenge,
  verifyPassword,
} from '../lib/security.ts';

const router = Router();

function safeUserDto(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    uid: u.uid,
    email: u.email,
    phone: u.phone,
    fullName: u.fullName,
    username: u.username,
    avatarUrl: u.avatarUrl,
    coverUrl: u.coverUrl,
    bio: u.bio,
    division: u.division,
    district: u.district,
    upazila: u.upazila,
    unionWard: u.unionWard,
    areaDetails: u.areaDetails,
    role: u.role,
    accountStatus: u.accountStatus,
    verificationType: u.verificationType,
    isFeaturedCreator: u.isFeaturedCreator,
    creatorLevel: u.creatorLevel,
    monetizationStatus: u.monetizationStatus,
    twoFactorEnabled: u.twoFactorEnabled,
    copyrightStrikes: u.copyrightStrikes,
    guidelineViolations: u.guidelineViolations,
    totalFollowers: u.totalFollowers,
    totalFollowing: u.totalFollowing,
    totalPosts: u.totalPosts,
    totalViews: u.totalViews,
    validViews: u.validViews,
    totalLikes: u.totalLikes,
    activeDays: u.activeDays,
    createdAt: u.createdAt,
  };
}

// Send OTP challenge (registration / password reset / 2FA)
router.post('/otp/send', rateLimit('otp-send', 10, 60_000), async (req, res) => {
  try {
    const target = sanitizeText(req.body?.target, 160).toLowerCase();
    const purpose = req.body?.purpose as 'register' | 'reset' | '2fa';
    if (!target || !['register', 'reset', '2fa'].includes(purpose)) {
      return res.status(400).json({ error: 'Valid email/phone and purpose are required.' });
    }
    const code = createOtpChallenge(target, purpose);
    // In production, integrate SMS/Email gateway provider here.
    // For sandbox verification without external SMS credentials, return masked delivery confirmation & preview code when non-prod.
    const isProd = process.env.NODE_ENV === 'production' && Boolean(process.env.SMS_GATEWAY_KEY);
    return res.json({
      sent: true,
      message: `OTP sent to ${target}. Valid for 10 minutes.`,
      ...(isProd ? {} : { sandboxOtpPreview: code }),
    });
  } catch (error) {
    console.error('OTP send error:', error);
    return res.status(500).json({ error: 'Could not generate OTP challenge.' });
  }
});

// Register with Email / Mobile + Strong Password + OTP + Location
router.post('/register', rateLimit('register', 10, 60_000), async (req, res) => {
  try {
    const fullName = sanitizeText(req.body?.fullName, 100);
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const phone = sanitizeText(req.body?.phone, 30);
    const usernameRaw = sanitizeText(req.body?.username, 40).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const password = String(req.body?.password || '');
    const otpCode = String(req.body?.otpCode || '').trim();
    const division = sanitizeText(req.body?.division, 60) || 'Dhaka';
    const district = sanitizeText(req.body?.district, 60) || 'Dhaka';
    const upazila = sanitizeText(req.body?.upazila, 60) || 'Savar';
    const unionWard = sanitizeText(req.body?.unionWard, 80);
    const areaDetails = sanitizeText(req.body?.areaDetails, 300);
    const bio = sanitizeText(req.body?.bio, 500);

    if (!fullName || !email || !usernameRaw || usernameRaw.length < 3) {
      return res.status(400).json({ error: 'Full name, email, and username (min 3 chars) are required.' });
    }

    const pwError = validateStrongPassword(password);
    if (pwError) {
      return res.status(400).json({ error: pwError });
    }

    const otpTarget = email || phone;
    if (!otpCode || !verifyOtpChallenge(otpTarget, 'register', otpCode)) {
      return res.status(400).json({ error: 'Invalid or expired OTP verification code.' });
    }

    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, usernameRaw)))
      .limit(1);

    if (existing[0]) {
      return res.status(409).json({ error: 'An account with this email or username already exists.' });
    }

    const uid = `local_${crypto.randomUUID()}`;
    const passwordHash = hashPassword(password);
    const isOwner = email === 'timekushtia@gmail.com';

    const customAvatarUrl = isSafeImageSource(req.body?.avatarUrl, 900_000) ? req.body.avatarUrl.trim() : null;
    const customCoverUrl = isSafeImageSource(req.body?.coverUrl, 1_200_000) ? req.body.coverUrl.trim() : null;

    const [created] = await db
      .insert(users)
      .values({
        uid,
        email,
        phone: phone || null,
        passwordHash,
        fullName,
        username: usernameRaw,
        avatarUrl: customAvatarUrl || '/src/assets/images/avatar_citizen_reporter_1795635478721.jpg',
        coverUrl: customCoverUrl || null,
        bio: bio || null,
        division,
        district,
        upazila,
        unionWard: unionWard || null,
        areaDetails: areaDetails || null,
        role: isOwner ? 'super_admin' : 'creator',
        creatorLevel: isOwner ? 5 : 1,
        verificationType: isOwner ? 'official_org' : 'none',
      })
      .returning();

    await db.insert(notifications).values({
      userId: created.id,
      type: 'admin_announcement',
      title: 'জনকথায় স্বাগতম!',
      body: 'আপনার নাগরিক সাংবাদিকতা অ্যাকাউন্ট তৈরি হয়েছে। এখনই আপনার এলাকার সংবাদ প্রকাশ করুন।',
      linkUrl: '/creator',
    });

    const token = signSessionToken({ uid: created.uid, email: created.email, role: created.role });
    return res.status(201).json({ token, user: safeUserDto(created) });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Login with Email or Mobile + Password (with optional 2FA check)
router.post('/login', rateLimit('login', 15, 60_000), async (req, res) => {
  try {
    const identifier = sanitizeText(req.body?.identifier, 160).toLowerCase();
    const password = String(req.body?.password || '');
    const otpCode = String(req.body?.otpCode || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/phone and password are required.' });
    }

    const found = await db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.phone, identifier)))
      .limit(1);

    const user = found[0];
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.accountStatus === 'banned') {
      return res.status(403).json({ error: 'Account has been permanently suspended.' });
    }

    if (user.twoFactorEnabled) {
      if (!otpCode) {
        const code = createOtpChallenge(user.email, '2fa');
        return res.status(202).json({
          requires2FA: true,
          target: user.email,
          message: 'Two-factor verification required. Enter the 6-digit OTP.',
          ...(process.env.NODE_ENV === 'production' && process.env.SMS_GATEWAY_KEY ? {} : { sandboxOtpPreview: code }),
        });
      }
      if (!verifyOtpChallenge(user.email, '2fa', otpCode)) {
        return res.status(401).json({ error: 'Invalid or expired 2FA verification code.' });
      }
    }

    const token = signSessionToken({ uid: user.uid, email: user.email, role: user.role });
    return res.json({ token, user: safeUserDto(user) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

// Forgot password reset with OTP
router.post('/reset-password', rateLimit('reset-pw', 8, 60_000), async (req, res) => {
  try {
    const email = sanitizeText(req.body?.email, 160).toLowerCase();
    const otpCode = String(req.body?.otpCode || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    const pwError = validateStrongPassword(newPassword);
    if (pwError) {
      return res.status(400).json({ error: pwError });
    }

    if (!verifyOtpChallenge(email, 'reset', otpCode)) {
      return res.status(400).json({ error: 'Invalid or expired OTP code.' });
    }

    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!found[0]) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const passwordHash = hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, found[0].id));

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({ error: 'Password reset failed.' });
  }
});

// Get current authenticated user profile
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await db.select().from(users).where(eq(users.id, req.dbUser.id)).limit(1);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: safeUserDto(rows[0]) });
  } catch (error) {
    console.error('Fetch me error:', error);
    return res.status(500).json({ error: 'Failed to load profile.' });
  }
});

// Update current user's profile & location
router.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
    const fullName = sanitizeText(req.body?.fullName, 100);
    const bio = sanitizeText(req.body?.bio, 500);
    const phone = sanitizeText(req.body?.phone, 30);
    const division = sanitizeText(req.body?.division, 60);
    const district = sanitizeText(req.body?.district, 60);
    const upazila = sanitizeText(req.body?.upazila, 60);
    const unionWard = sanitizeText(req.body?.unionWard, 80);
    const areaDetails = sanitizeText(req.body?.areaDetails, 300);
    const avatarUrl = isSafeImageSource(req.body?.avatarUrl, 900_000) ? req.body.avatarUrl.trim() : undefined;
    const coverUrl = isSafeImageSource(req.body?.coverUrl, 1_200_000) ? req.body.coverUrl.trim() : undefined;
    const twoFactorEnabled = typeof req.body?.twoFactorEnabled === 'boolean' ? req.body.twoFactorEnabled : undefined;

    const [updated] = await db
      .update(users)
      .set({
        ...(fullName ? { fullName } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(division ? { division } : {}),
        ...(district ? { district } : {}),
        ...(upazila ? { upazila } : {}),
        ...(unionWard !== undefined ? { unionWard } : {}),
        ...(areaDetails !== undefined ? { areaDetails } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(coverUrl ? { coverUrl } : {}),
        ...(twoFactorEnabled !== undefined ? { twoFactorEnabled } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.dbUser.id))
      .returning();

    await db.insert(auditLogs).values({
      actorId: req.dbUser.id,
      actorEmail: req.dbUser.email,
      actorRole: req.dbUser.role,
      action: 'PROFILE_UPDATED',
      targetType: 'user',
      targetId: String(req.dbUser.id),
    });

    return res.json({ user: safeUserDto(updated) });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// Helper: Get or create Super Admin operator account when unlocked via Admin Passcode Gate
async function getOrProvisionAdminOperator() {
  const adminEmail = 'timekushtia@gmail.com';
  const found = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (found[0]) {
    if (found[0].role !== 'super_admin') {
      const [promoted] = await db
        .update(users)
        .set({ role: 'super_admin', verificationType: 'official_org', creatorLevel: 5, updatedAt: new Date() })
        .where(eq(users.id, found[0].id))
        .returning();
      return promoted;
    }
    return found[0];
  }

  const [created] = await db
    .insert(users)
    .values({
      uid: `admin_${crypto.randomUUID()}`,
      email: adminEmail,
      fullName: 'প্ল্যাটফর্ম সুপার অ্যাডমিন',
      username: 'super_admin',
      avatarUrl: '/src/assets/images/avatar_citizen_reporter_1795635478721.jpg',
      division: 'Khulna',
      district: 'Kushtia',
      upazila: 'Kushtia Sadar',
      role: 'super_admin',
      verificationType: 'official_org',
      creatorLevel: 5,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: 'super_admin', updatedAt: new Date() },
    })
    .returning();
  return created;
}

// Admin Passcode Gate Status
router.get('/admin-gate/status', async (_req, res) => {
  try {
    const envConfigured = Boolean(process.env.ADMIN_PANEL_PASSCODE?.trim());
    const stored = await db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, 'admin_passcode_hash'))
      .limit(1);
    const claimed = Boolean(stored[0]?.value);
    return res.json({ envConfigured, claimed });
  } catch (error) {
    console.error('Admin gate status error:', error);
    return res.status(500).json({ error: 'Failed to check admin gate status.' });
  }
});

// First-run atomic Admin Passcode Claim (only available when env var unset & not yet claimed)
router.post('/admin-gate/claim', rateLimit('admin-claim', 8, 60_000), async (req, res) => {
  try {
    if (process.env.ADMIN_PANEL_PASSCODE?.trim()) {
      return res.status(409).json({ error: 'Admin passcode is configured via environment secret.' });
    }
    const existing = await db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, 'admin_passcode_hash'))
      .limit(1);
    if (existing[0]?.value) {
      return res.status(409).json({ error: 'Admin passcode has already been claimed. Please sign in with your passcode.' });
    }

    const passcode = String(req.body?.passcode || '').trim();
    if (passcode.length < 8) {
      return res.status(400).json({ error: 'অ্যাডমিন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।' });
    }

    const hashed = hashPassword(passcode);
    await db
      .insert(platformSettings)
      .values({ key: 'admin_passcode_hash', value: hashed, updatedAt: new Date() })
      .onConflictDoNothing({ target: platformSettings.key });

    const adminUser = await getOrProvisionAdminOperator();
    await db.insert(auditLogs).values({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorRole: 'super_admin',
      action: 'ADMIN_PASSCODE_CLAIMED',
      targetType: 'system',
      targetId: 'admin_gate',
      ipAddress: req.ip || null,
    });

    const token = signSessionToken({ uid: adminUser.uid, email: adminUser.email, role: adminUser.role });
    return res.status(201).json({ token, user: safeUserDto(adminUser) });
  } catch (error) {
    console.error('Admin passcode claim error:', error);
    return res.status(500).json({ error: 'Failed to set admin passcode.' });
  }
});

// Admin Passcode Unlock
router.post('/admin-gate/unlock', rateLimit('admin-unlock', 10, 60_000), async (req, res) => {
  try {
    const passcode = String(req.body?.passcode || '').trim();
    if (!passcode) {
      return res.status(400).json({ error: 'অ্যাডমিন পাসওয়ার্ড দিন।' });
    }

    const envPasscode = process.env.ADMIN_PANEL_PASSCODE?.trim();
    let verified = false;

    if (envPasscode) {
      const a = crypto.createHash('sha256').update(passcode).digest();
      const b = crypto.createHash('sha256').update(envPasscode).digest();
      verified = crypto.timingSafeEqual(a, b);
    } else {
      const stored = await db
        .select({ value: platformSettings.value })
        .from(platformSettings)
        .where(eq(platformSettings.key, 'admin_passcode_hash'))
        .limit(1);
      const storedHash = typeof stored[0]?.value === 'string' ? stored[0].value : '';
      if (!storedHash) {
        return res.status(409).json({ error: 'Admin passcode not yet configured. Please complete initial setup.' });
      }
      verified = verifyPassword(passcode, storedHash);
    }

    if (!verified) {
      return res.status(401).json({ error: 'ভুল অ্যাডমিন পাসওয়ার্ড। অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।' });
    }

    const adminUser = await getOrProvisionAdminOperator();
    await db.insert(auditLogs).values({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorRole: 'super_admin',
      action: 'ADMIN_PANEL_UNLOCKED',
      targetType: 'system',
      targetId: 'admin_gate',
      ipAddress: req.ip || null,
    });

    const token = signSessionToken({ uid: adminUser.uid, email: adminUser.email, role: adminUser.role });
    return res.json({ token, user: safeUserDto(adminUser) });
  } catch (error) {
    console.error('Admin unlock error:', error);
    return res.status(500).json({ error: 'Failed to unlock admin panel.' });
  }
});

// Change stored Admin Passcode (when not locked by process.env)
router.post('/admin-gate/change-passcode', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.dbUser?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admin can change the admin passcode.' });
    }
    if (process.env.ADMIN_PANEL_PASSCODE?.trim()) {
      return res.status(409).json({ error: 'Admin passcode is managed via ADMIN_PANEL_PASSCODE environment secret.' });
    }
    const newPasscode = String(req.body?.newPasscode || '').trim();
    if (newPasscode.length < 8) {
      return res.status(400).json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।' });
    }
    const hashed = hashPassword(newPasscode);
    await db
      .insert(platformSettings)
      .values({ key: 'admin_passcode_hash', value: hashed, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: hashed, updatedAt: new Date() },
      });

    await db.insert(auditLogs).values({
      actorId: req.dbUser.id,
      actorEmail: req.dbUser.email,
      actorRole: req.dbUser.role,
      action: 'ADMIN_PASSCODE_CHANGED',
      targetType: 'system',
      targetId: 'admin_gate',
      ipAddress: req.ip || null,
    });

    return res.json({ updated: true, message: 'অ্যাডমিন প্যানেলের পাসওয়ার্ড আপডেট হয়েছে।' });
  } catch (error) {
    console.error('Change admin passcode error:', error);
    return res.status(500).json({ error: 'Failed to update admin passcode.' });
  }
});

export default router;
