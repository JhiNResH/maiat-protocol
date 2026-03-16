import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const skillPath = join(process.cwd(), 'SKILL.md');
    const content = readFileSync(skillPath, 'utf-8');
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new NextResponse('# SKILL.md not found', { status: 404 });
  }
}
