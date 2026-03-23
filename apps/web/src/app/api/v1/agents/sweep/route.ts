import { NextRequest, NextResponse } from 'next/server';
import { broadcastEvent } from '../../monitor/feed/route';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.agentId) {
      return NextResponse.json({ error: 'Missing agentId parameter' }, { status: 400 });
    }

    // Broadcast that a sweep has started
    broadcastEvent(`SYS: Audit sweep requested for Agent ${body.agentId.slice(0, 8)}...`, 'info');

    // Simulate audit process (In production this would invoke the MCP server or EAS)
    setTimeout(() => {
      broadcastEvent(`SYS: Sweep progressing on ${body.agentId.slice(0, 8)}... (50%)`, 'info');
    }, 2000);

    setTimeout(() => {
        // Randomly succeed or fail
        const success = Math.random() > 0.3;
        if (success) {
            broadcastEvent(`✓ VERIFIED: Agent ${body.agentId.slice(0, 8)} passed behavioral audit.`, 'info');
        } else {
            broadcastEvent(`WRN: Anomalies detected in recent transactions for ${body.agentId.slice(0, 8)}!`, 'warning');
        }
    }, 5000);

    return NextResponse.json({ success: true, message: 'Sweep initiated' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to initiate sweep', details: error.message }, { status: 500 });
  }
}
