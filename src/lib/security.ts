import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || EPHEMERAL_SESSION_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

export interface SessionPayload {
  uid: string;
  email: string;
  role: string;
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlSeconds = 60 * 60 * 24 * 7): string {
  const data: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  return `jk1.${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token.startsWith('jk1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.uid || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hashIdentifier(raw: string): string {
  return crypto.createHash('sha256').update(raw + getSessionSecret().slice(0, 8)).digest('hex').slice(0, 32);
}

export function sanitizeText(input: unknown, maxLen = 5000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, (ch) => (ch === '<' ? '&lt;' : '&gt;'))
    .trim()
    .slice(0, maxLen);
}

export function isSafeHttpUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  if (url.startsWith('/')) return !url.startsWith('//');
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isSafeImageSource(url: unknown, maxDataUriLength = 1_500_000): url is string {
  if (typeof url !== 'string' || !url.trim()) return false;
  const trimmed = url.trim();
  if (isSafeHttpUrl(trimmed)) return true;
  return (
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed) &&
    trimmed.length <= maxDataUriLength
  );
}

export function validateStrongPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  return null;
}

// In-memory sliding window rate limiter
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(keyPrefix: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const existing = rateBuckets.get(key);
    if (!existing || existing.resetAt < now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (existing.count >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    existing.count += 1;
    return next();
  };
}

// OTP challenge store (in-memory with TTL & max attempts)
interface OtpRecord {
  codeHash: string;
  target: string;
  purpose: 'register' | 'reset' | '2fa';
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpRecord>();

export function createOtpChallenge(target: string, purpose: 'register' | 'reset' | '2fa'): string {
  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = crypto.createHash('sha256').update(`${target}:${code}`).digest('hex');
  otpStore.set(`${purpose}:${target}`, {
    codeHash,
    target,
    purpose,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });
  return code;
}

export function verifyOtpChallenge(target: string, purpose: 'register' | 'reset' | '2fa', code: string): boolean {
  const key = `${purpose}:${target}`;
  const rec = otpStore.get(key);
  if (!rec) return false;
  if (rec.expiresAt < Date.now() || rec.attempts >= 5) {
    otpStore.delete(key);
    return false;
  }
  rec.attempts += 1;
  const candidateHash = crypto.createHash('sha256').update(`${target}:${code}`).digest('hex');
  if (candidateHash !== rec.codeHash) {
    return false;
  }
  otpStore.delete(key);
  return true;
}
