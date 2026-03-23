import { NextRequest, NextResponse } from 'next/server';
import { broadcastEvent } from '../feed/route';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.msg) {
      return NextResponse.json({ error: 'Missing msg field' }, { status: 400 });
    }

    const type = body.type || 'info'; 

    // Broadcast the event to all connected SSE clients
    const event = broadcastEvent(body.msg, type as 'info' | 'warning' | 'error');

    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to ingest log', details: error.message }, { status: 500 });
  }
}
