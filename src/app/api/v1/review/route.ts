import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";

// --- In-memory store (will migrate to Supabase) ---
interface Review {
  id: string;
  address: string;
  rating: number;     // 1-10
  comment: string;
  tags: string[];
  reviewer: string;
  timestamp: string;
}

const reviews: Review[] = [];
let nextId = 1;

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
  const addressReviews = reviews.filter(r => r.address === checksummed);
  const avgRating = addressReviews.length > 0
    ? Math.round((addressReviews.reduce((sum, r) => sum + r.rating, 0) / addressReviews.length) * 10) / 10
    : 0;

  return NextResponse.json({
    address: checksummed,
    reviews: addressReviews,
    count: addressReviews.length,
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

    const review: Review = {
      id: `rev_${nextId++}`,
      address: getAddress(address),
      rating,
      comment: comment ?? "",
      tags: tags ?? [],
      reviewer: getAddress(reviewer),
      timestamp: new Date().toISOString(),
    };

    reviews.push(review);

    return NextResponse.json({
      success: true,
      review,
    }, { status: 201, headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: CORS_HEADERS });
  }
}
