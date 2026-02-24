import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";

// --- DB: Prisma (Supabase) with in-memory fallback for local dev ---
let prisma: import("@prisma/client").PrismaClient | null = null;

async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!prisma) {
    const { prisma: client } = await import("@/lib/prisma");
    prisma = client;
  }
  return prisma;
}

// In-memory fallback (dev only)
interface ReviewRecord {
  id: string;
  address: string;
  rating: number;
  comment: string;
  tags: string[];
  reviewer: string;
  createdAt: Date;
}
const memReviews: ReviewRecord[] = [];
let nextMemId = 1;

// --- Rate limiter ---
const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/v1/review?address=0x...
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: CORS_HEADERS });
  }

  const address = request.nextUrl.searchParams.get("address");
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Valid address required" }, { status: 400, headers: CORS_HEADERS });
  }

  const checksummed = getAddress(address);
  const db = await getDb();

  let reviews: ReviewRecord[];

  if (db) {
    // Supabase via Prisma
    const rows = await db.trustReview.findMany({
      where: { address: checksummed },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    reviews = rows.map(r => ({
      id: r.id,
      address: r.address,
      rating: r.rating,
      comment: r.comment,
      tags: r.tags,
      reviewer: r.reviewer,
      createdAt: r.createdAt,
    }));
  } else {
    // In-memory fallback
    reviews = memReviews.filter(r => r.address === checksummed);
  }

  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  return NextResponse.json({
    address: checksummed,
    reviews: reviews.map(r => ({
      ...r,
      timestamp: r.createdAt.toISOString(),
    })),
    count: reviews.length,
    averageRating: avgRating,
  }, { status: 200, headers: CORS_HEADERS });
}

// POST /api/v1/review
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json() as {
      address?: string;
      rating?: number;
      comment?: string;
      tags?: string[];
      reviewer?: string;
    };

    const { address, rating, comment, tags, reviewer } = body;

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Valid address required" }, { status: 400, headers: CORS_HEADERS });
    }
    if (!rating || rating < 1 || rating > 10) {
      return NextResponse.json({ error: "Rating must be 1-10" }, { status: 400, headers: CORS_HEADERS });
    }
    if (!reviewer || !isAddress(reviewer)) {
      return NextResponse.json({ error: "Valid reviewer wallet address required" }, { status: 400, headers: CORS_HEADERS });
    }

    const checksumAddress = getAddress(address);
    const checksumReviewer = getAddress(reviewer);
    const db = await getDb();
    let saved: ReviewRecord;

    if (db) {
      // Persist to Supabase
      const row = await db.trustReview.create({
        data: {
          address: checksumAddress,
          rating,
          comment: comment ?? "",
          tags: tags ?? [],
          reviewer: checksumReviewer,
        },
      });
      saved = {
        id: row.id,
        address: row.address,
        rating: row.rating,
        comment: row.comment,
        tags: row.tags,
        reviewer: row.reviewer,
        createdAt: row.createdAt,
      };
    } else {
      // In-memory fallback
      saved = {
        id: `rev_${nextMemId++}`,
        address: checksumAddress,
        rating,
        comment: comment ?? "",
        tags: tags ?? [],
        reviewer: checksumReviewer,
        createdAt: new Date(),
      };
      memReviews.push(saved);
    }

    return NextResponse.json({
      success: true,
      review: { ...saved, timestamp: saved.createdAt.toISOString() },
      persisted: !!db,
    }, { status: 201, headers: CORS_HEADERS });
  } catch (err) {
    console.error("[review POST]", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: CORS_HEADERS });
  }
}
