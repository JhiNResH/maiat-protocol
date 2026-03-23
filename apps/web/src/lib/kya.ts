/**
 * KYA (Know Your Agent) — Utility helpers
 */

import { randomBytes } from 'crypto';

const KYA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function generateKyaCode(): string {
  const bytes = randomBytes(4);
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += KYA_CHARS[bytes[i] % KYA_CHARS.length];
  }
  return `MAIAT-${code}`;
}

export function validateTweetUrl(url: string): boolean {
  return /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url);
}

const ALLOWED_ORIGINS = [
  'https://passport.maiat.io',
  'https://app.maiat.io',
  'https://maiat-passport-ens.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

export function kyaCorsHeaders(origin?: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.some(o => origin === o);
  return {
    'Access-Control-Allow-Origin': allowed ? origin! : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
