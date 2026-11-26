import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifySessionToken } from '../lib/security.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { hasPermission } from '../lib/bangladesh-locations.ts';

const OWNER_ADMIN_EMAIL = 'timekushtia@gmail.com';

export interface DbUserRecord {
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
}

export interface AuthRequest extends Request {
  authUid?: string;
  authEmail?: string;
  dbUser?: DbUserRecord;
}

function makeUniqueUsername(email: string, name?: string): string {
  const base = (name || email.split('@')[0] || 'citizen')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 18);
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${base || 'citizen'}_${suffix}`;
}

async function syncFirebaseUserToDb(uid: string, email: string, name?: string, picture?: string): Promise<DbUserRecord> {
  const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  if (existing[0]) {
    const row = existing[0];
    if (email.toLowerCase() === OWNER_ADMIN_EMAIL && row.role !== 'super_admin') {
      const updated = await db
        .update(users)
        .set({ role: 'super_admin', verificationType: 'official_org', creatorLevel: 5, updatedAt: new Date() })
        .where(eq(users.id, row.id))
        .returning();
      return updated[0] as DbUserRecord;
    }
    return row as DbUserRecord;
  }

  const byEmail = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (byEmail[0]) {
    const updated = await db
      .update(users)
      .set({ uid, updatedAt: new Date() })
      .where(eq(users.id, byEmail[0].id))
      .returning();
    return updated[0] as DbUserRecord;
  }

  const isOwner = email.toLowerCase() === OWNER_ADMIN_EMAIL;
  const inserted = await db
    .insert(users)
    .values({
      uid,
      email: email.toLowerCase(),
      fullName: name || email.split('@')[0] || 'Citizen Reporter',
      username: makeUniqueUsername(email, name),
      avatarUrl: picture || '/src/assets/images/avatar_citizen_reporter_1795635478721.jpg',
      role: isOwner ? 'super_admin' : 'creator',
      verificationType: isOwner ? 'official_org' : 'none',
      creatorLevel: isOwner ? 5 : 1,
      division: 'Dhaka',
      district: isOwner ? 'Kushtia' : 'Dhaka',
      upazila: isOwner ? 'Kushtia Sadar' : 'Savar',
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: { email: email.toLowerCase(), updatedAt: new Date() },
    })
    .returning();

  return inserted[0] as DbUserRecord;
}

async function resolveAuthToken(token: string): Promise<{ uid: string; email: string; dbUser: DbUserRecord } | null> {
  // 1. Check signed session token (Email/Phone + Password/OTP auth)
  const customPayload = verifySessionToken(token);
  if (customPayload) {
    const rows = await db.select().from(users).where(eq(users.uid, customPayload.uid)).limit(1);
    if (rows[0]) {
      return { uid: rows[0].uid, email: rows[0].email, dbUser: rows[0] as DbUserRecord };
    }
    return null;
  }

  // 2. Check Firebase ID Token (Google Sign-In)
  const decoded = await adminAuth.verifyIdToken(token);
  const email = (decoded.email || `${decoded.uid}@firebase.local`).toLowerCase();
  const dbUser = await syncFirebaseUserToDb(decoded.uid, email, decoded.name, decoded.picture);
  return { uid: decoded.uid, email, dbUser };
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) return next();

  try {
    const resolved = await resolveAuthToken(token);
    if (resolved && resolved.dbUser.accountStatus !== 'banned') {
      req.authUid = resolved.uid;
      req.authEmail = resolved.email;
      req.dbUser = resolved.dbUser;
    }
  } catch {
    // Optional auth treats invalid tokens as anonymous
  }
  return next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication token missing.' });
  }

  try {
    const resolved = await resolveAuthToken(token);
    if (!resolved) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }
    if (resolved.dbUser.accountStatus === 'banned') {
      return res.status(403).json({ error: 'This account has been permanently suspended.' });
    }
    req.authUid = resolved.uid;
    req.authEmail = resolved.email;
    req.dbUser = resolved.dbUser;
    return next();
  } catch (err) {
    console.error('Auth verification error:', err);
    return res.status(401).json({ error: 'Unauthorized: Invalid authentication token.' });
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!hasPermission(req.dbUser.role, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action.' });
    }
    return next();
  };
};
