'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Radar, AlertTriangle, Terminal, Shield, ShieldAlert, Zap, User, Target, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types ───────────────────────────────────────────────────────────────────
type AgentNode = {
  id: string; x: number; y: number;
  trust: number; type: 'safe' | 'mine' | 'unaudited';
  label: string;
  raw?: any;
};

type IntelItem = { time: string; msg: string; type: 'info' | 'warning' | 'error' };

import useSWR from 'swr';
import { Header } from '@/components/Header';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ─── Radar Canvas ─────────────────────────────────────────────────────────────
const RadarMap = ({ agents, onSelect }: { agents: AgentNode[], onSelect: (a: AgentNode | null) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const sweepRef = useRef(0);
  const brightnessRef = useRef<Record<string, number>>({});

  const drawHex = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI/3)*i - Math.PI/6;
      i===0 ? ctx.moveTo(x+r*Math.cos(a), y+r*Math.sin(a)) : ctx.lineTo(x+r*Math.cos(a), y+r*Math.sin(a));
    }
    ctx.closePath();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    const draw = () => {
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      const cx = W/2, cy = H/2, R = Math.min(W,H)*0.42;
      sweepRef.current = (sweepRef.current + 0.008) % (Math.PI*2);
      const sw = sweepRef.current, trail = Math.PI*0.55;

      ctx.clearRect(0,0,W,H);
      ctx.fillStyle = '#030303'; ctx.fillRect(0,0,W,H);

      // Grid dots
      ctx.fillStyle = 'rgba(0,240,255,0.06)';
      for (let gx=0; gx<W; gx+=24) for (let gy=0; gy<H; gy+=24) { ctx.beginPath(); ctx.arc(gx,gy,0.8,0,Math.PI*2); ctx.fill(); }

      // Rings & crosshairs
      [0.25,0.5,0.75,1.0].forEach((f,i) => { ctx.beginPath(); ctx.arc(cx,cy,R*f,0,Math.PI*2); ctx.strokeStyle=`rgba(0,240,255,${0.04+i*0.03})`; ctx.lineWidth=1; ctx.stroke(); });
      ctx.strokeStyle='rgba(0,240,255,0.06)'; ctx.lineWidth=1;
      [0,Math.PI/4,Math.PI/2,Math.PI*3/4].forEach(a => { ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*R*1.1,cy+Math.sin(a)*R*1.1); ctx.lineTo(cx-Math.cos(a)*R*1.1,cy-Math.sin(a)*R*1.1); ctx.stroke(); });

      // Sweep trail
      for (let t=0;t<40;t++) { const ta=sw-(trail/40)*t; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,ta,ta+trail/40); ctx.closePath(); ctx.fillStyle=`rgba(0,240,255,${(1-t/40)*0.18})`; ctx.fill(); }

      // Sweep line
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(sw)*R,cy+Math.sin(sw)*R);
      ctx.strokeStyle='rgba(0,240,255,0.9)'; ctx.lineWidth=2; ctx.shadowColor='#00F0FF'; ctx.shadowBlur=12; ctx.stroke(); ctx.shadowBlur=0;

      // Update brightness
      agents.forEach(a => {
        const ax=a.x*W, ay=a.y*H;
        const nodeAngle = Math.atan2(ay-cy, ax-cx);
        const diff = ((sw-nodeAngle)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
        brightnessRef.current[a.id] = diff<trail ? 1.0 : Math.max(a.type==='unaudited'?0.15:0.35, (brightnessRef.current[a.id]??0)-0.004);
      });

      // Arc connections
      const litSafe = agents.filter(a => a.type==='safe' && (brightnessRef.current[a.id]??0)>0.6);
      ctx.setLineDash([4,6]);
      for (let i=0;i<litSafe.length-1;i++) {
        const a1=litSafe[i], a2=litSafe[i+1];
        const x1=a1.x*W,y1=a1.y*H,x2=a2.x*W,y2=a2.y*H;
        const alpha=Math.min(brightnessRef.current[a1.id],brightnessRef.current[a2.id])*0.4;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo((x1+x2)/2+(cy-(y1+y2)/2)*0.2,(y1+y2)/2-(cx-(x1+x2)/2)*0.2,x2,y2);
        ctx.strokeStyle=`rgba(0,240,255,${alpha})`; ctx.lineWidth=1; ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw nodes
      agents.forEach(a => {
        const ax=a.x*W, ay=a.y*H, br=brightnessRef.current[a.id]??0;
        if (a.type==='safe') {
          const col='#00FF9D', r=4;
          ctx.globalAlpha=0.3+br*0.7; ctx.shadowColor=col; ctx.shadowBlur=10*br;
          ctx.beginPath(); ctx.arc(ax,ay,r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill(); ctx.shadowBlur=0; ctx.globalAlpha=1;
          if (br>0.4) { ctx.font='9px JetBrains Mono,monospace'; ctx.fillStyle=col; ctx.globalAlpha=Math.max(br,0.5); ctx.fillText(a.label,ax+8,ay-4); ctx.globalAlpha=1; }
        } else if (a.type==='mine') {
          ctx.globalAlpha=0.2+br*0.8; ctx.shadowColor='#FF0055'; ctx.shadowBlur=12*br; ctx.fillStyle='#FF0055';
          drawHex(ctx,ax,ay,6); ctx.fill(); ctx.shadowBlur=0;
          if (br>0.4) { ctx.font='bold 8px JetBrains Mono,monospace'; ctx.fillStyle='#FF0055'; ctx.fillText('MINE',ax-10,ay+16); }
          ctx.globalAlpha=1;
        } else {
          ctx.globalAlpha=0.1+br*0.3; ctx.beginPath(); ctx.arc(ax,ay,2.5,0,Math.PI*2); ctx.fillStyle='#64748b'; ctx.fill(); ctx.globalAlpha=1;
        }
      });

      // Fog vignette
      const fg=ctx.createRadialGradient(cx,cy,R*0.55,cx,cy,R*1.4);
      fg.addColorStop(0,'rgba(3,3,3,0)'); fg.addColorStop(0.7,'rgba(3,3,3,0.3)'); fg.addColorStop(1,'rgba(3,3,3,0.92)');
      ctx.fillStyle=fg; ctx.fillRect(0,0,W,H);

      // Scan lines
      for (let sy=0;sy<H;sy+=3) { ctx.fillStyle='rgba(0,0,0,0.07)'; ctx.fillRect(0,sy,W,1); }

      // Labels
      ctx.font='10px JetBrains Mono,monospace'; ctx.fillStyle='rgba(0,240,255,0.25)'; ctx.textAlign='center';
      ctx.fillText('AUDITED ZONE',cx,cy-R*0.22);
      ctx.fillText('FOG ZONE — UNVERIFIED',cx,cy+R*0.88);
      ctx.fillText('SWEEP IN PROGRESS',cx+R*0.62,cy+R*0.05);
      ctx.textAlign='left';

      // Badge
      ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(W-168,12,156,24);
      ctx.strokeStyle='rgba(0,240,255,0.3)'; ctx.lineWidth=1; ctx.strokeRect(W-168,12,156,24);
      ctx.fillStyle='#00F0FF'; ctx.font='bold 10px JetBrains Mono,monospace'; ctx.textAlign='right';
      ctx.fillText(`SWEEP COVERAGE: ${agents.length ? '87%' : '0%'}`,W-16,28); ctx.textAlign='left';

      // Legend
      const legItems=[{color:'#00FF9D',label:'HIGH TRUST'},{color:'#FF0055',label:'MINE',hex:true},{color:'#64748b',label:'UN-AUDITED'}];
      legItems.forEach(({color,label,hex},i)=>{
        const y=H-70+i*22; ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(8,y-12,140,18);
        ctx.strokeStyle='rgba(0,240,255,0.1)'; ctx.strokeRect(8,y-12,140,18);
        ctx.fillStyle=color;
        if(hex){drawHex(ctx,17,y-4,5);ctx.fill();}else{ctx.beginPath();ctx.arc(17,y-4,4,0,Math.PI*2);ctx.fill();}
        ctx.font='9px JetBrains Mono,monospace'; ctx.fillStyle='#94a3b8'; ctx.fillText(label,28,y);
      });

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [agents, drawHex]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if(!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)/rect.width, my=(e.clientY-rect.top)/rect.height;
    let closest: AgentNode|null=null, minDist=0.03;
    agents.forEach(a => { const d=Math.hypot(a.x-mx,a.y-my); if(d<minDist){minDist=d;closest=a;} });
    onSelect(closest);
  }, [agents, onSelect]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" onClick={handleClick} />
    </div>
  );
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const intelFeed: IntelItem[] = [
  { time: '10:42:01', msg: 'SYS: Sweep initialized on Sector 7', type: 'info' },
  { time: '10:42:05', msg: 'AGT_18281: Heartbeat confirmed', type: 'info' },
  { time: '10:42:12', msg: 'WRN: Anomaly detected near Node Alpha', type: 'warning' },
  { time: '10:42:15', msg: 'SYS: Re-routing traffic...', type: 'info' },
  { time: '10:42:18', msg: 'ERR: Connection lost to AGT_9942', type: 'error' },
  { time: '10:42:20', msg: 'SYS: Attempting reconnect (1/3)', type: 'info' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MonitorPage() {
  const [selected, setSelected] = useState<AgentNode | null>(null);
  const [filter, setFilter] = useState('ALL');

  // Fetch real agents from the protocol API
  const { data } = useSWR('/api/v1/agents?limit=200', fetcher, { refreshInterval: 10000 });

  // Deterministically map protocol agents to radar coordinates based on wallet address hash
  const radarAgents = useMemo<AgentNode[]>(() => {
    if (!data?.agents) return [];
    
    // Simple hash function for consistent positioning
    const hash = (str: string) => {
      let h = 0; for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0; return Math.abs(h);
    };
    
    const mapped = data.agents.map((acc: any) => {
      const h = hash(acc.id);
      const s1 = (h % 1000) / 1000;
      const s2 = ((Math.floor(h / 1000)) % 1000) / 1000;
      const angle = s1 * Math.PI * 2;
      
      const trust = acc.trust?.score;
      let type: 'safe' | 'mine' | 'unaudited' = 'unaudited';
      let r = 0.25 + s2 * 0.4; // random distance from center
      
      if (trust !== null && trust !== undefined) {
        if (trust >= 75) { type = 'safe'; r = 0.15 + s2 * 0.2; } // high trust are closer
        else if (trust <= 50) { type = 'mine'; r = 0.4 + s2 * 0.3; } // mines are on outer rim
        else { type = 'unaudited'; }
      }

      return {
        id: acc.id,
        label: acc.name || `${acc.id.slice(0,6)}`,
        trust: trust !== null ? trust : 0,
        type,
        x: 0.5 + Math.cos(angle) * r * 0.8,
        y: 0.5 + Math.sin(angle) * r * 0.8,
        raw: acc // keep original data
      };
    });

    if (filter === 'HIGH TRUST ✓') return mapped.filter((a: AgentNode) => a.type === 'safe');
    if (filter === 'MINES ⚠') return mapped.filter((a: AgentNode) => a.type === 'mine');
    if (filter === 'UN-AUDITED') return mapped.filter((a: AgentNode) => a.type === 'unaudited');
    return mapped;
  }, [data, filter]);

  return (
    <div className="flex flex-col h-screen overflow-hidden pt-[64px]" style={{background:'#030303',fontFamily:'JetBrains Mono,monospace'}}>
      {/* Global Header */}
      <Header />

      {/* Layer filter pills */}
      <div className="flex items-center gap-2 px-6 py-2 border-b shrink-0" style={{borderColor:'rgba(0,240,255,0.1)'}}>
        {['ALL','HIGH TRUST ✓','MINES ⚠','UN-AUDITED'].map((label,i) => (
          <button key={label} onClick={()=>setFilter(label)} className={`px-3 py-1 rounded text-xs font-mono font-bold tracking-wider border transition-colors ${filter===label?'border-[#00F0FF] text-[#00F0FF] bg-[rgba(0,240,255,0.1)]':'border-slate-700 text-slate-500 hover:border-slate-500'}`}>
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-4 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full animate-pulse bg-emerald-400" />
            {data?.agents ? data.agents.length : '...'} AGENTS SCANNED
          </span>
          <input className="bg-transparent border border-slate-700 text-slate-400 px-3 py-1 rounded w-48 focus:outline-none focus:border-[#00F0FF]" placeholder="Search ID or Hash..." />
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-64 shrink-0 border-r flex flex-col" style={{borderColor:'rgba(0,240,255,0.15)',background:'rgba(0,240,255,0.02)'}}>
          {/* Intel Feed */}
          <div className="flex-1 flex flex-col min-h-0 border-b" style={{borderColor:'rgba(0,240,255,0.1)'}}>
            <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{borderColor:'rgba(0,240,255,0.1)',background:'rgba(0,0,0,0.3)'}}>
              <Terminal className="w-3 h-3" style={{color:'#00F0FF'}} />
              <span className="text-xs font-bold text-slate-200 tracking-wider">INTEL FEED</span>
              <span className="ml-auto w-2 h-2 rounded-full animate-pulse" style={{background:'#FF0055'}} />
            </div>
            <div className="p-3 overflow-y-auto custom-scrollbar text-[10px] leading-relaxed flex flex-col gap-2">
              {intelFeed.map((item: IntelItem, i: number) => (
                <div key={i} style={{color: item.type==='warning'?'#FFB800':item.type==='error'?'#FF0055':'#64748b'}}>
                  <span style={{color:'#00F0FF'}}>[{item.time}]</span> {item.msg}
                </div>
              ))}
            </div>
          </div>

          {/* Active sweeps */}
          <div className="border-b p-3" style={{borderColor:'rgba(0,240,255,0.1)'}}>
            <div className="flex items-center gap-2 mb-3">
              <Radar className="w-3 h-3" style={{color:'#00F0FF'}} />
              <span className="text-xs font-bold text-slate-200 tracking-wider">ACTIVE SWEEPS</span>
            </div>
            {[{label:'SECTOR 7, MEME CLUSTER',pct:23,active:true},{label:'DEFI PROTOCOL GRID',pct:89,active:false}].map(s=>(
              <div key={s.label} className="mb-3">
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span style={{color:s.active?'#00F0FF':'#64748b'}}>{s.label}</span>
                  <span style={{color:s.active?'#00F0FF':'#64748b'}}>{s.pct}%</span>
                </div>
                <div className="h-1 rounded-full" style={{background:'#1e293b'}}>
                  <div className="h-full rounded-full" style={{width:`${s.pct}%`,background:s.active?'#00F0FF':'#475569'}} />
                </div>
              </div>
            ))}
          </div>

          {/* Threat summary */}
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-3 h-3" style={{color:'#FF0055'}} />
              <span className="text-xs font-bold text-slate-200 tracking-wider">THREAT SUMMARY</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded flex flex-col items-center" style={{background:'rgba(255,0,85,0.1)',border:'1px solid rgba(255,0,85,0.3)'}}>
                <span className="text-lg font-bold" style={{color:'#FF0055'}}>
                  {radarAgents.filter((a: AgentNode) => a.type === 'mine').length}
                </span>
                <span className="text-[9px]" style={{color:'rgba(255,0,85,0.7)'}}>CRITICAL</span>
              </div>
              <div className="p-2 rounded flex flex-col items-center" style={{background:'rgba(255,184,0,0.1)',border:'1px solid rgba(255,184,0,0.3)'}}>
                <span className="text-lg font-bold" style={{color:'#FFB800'}}>
                  {radarAgents.filter((a: AgentNode) => (a.trust > 50 && a.trust < 75)).length}
                </span>
                <span className="text-[9px]" style={{color:'rgba(255,184,0,0.7)'}}>WARNINGS</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Center: Radar map */}
        <main className="flex-1 relative bg-black overflow-hidden">
          <RadarMap agents={radarAgents} onSelect={setSelected} />

          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
                className="absolute top-4 left-1/2 -translate-x-1/2 text-xs font-mono flex items-center gap-4 px-4 py-2 rounded z-10"
                style={{background:'rgba(0,0,0,0.9)',border:'1px solid rgba(0,240,255,0.5)',pointerEvents:'none'}}
              >
                <span className="font-bold" style={{color:'#00F0FF'}}>{selected.id}</span>
                <span className="text-slate-600">|</span>
                <span>TRUST: <span style={{color:selected.type==='mine'?'#FF0055':'#00FF9D'}}>{selected.trust}/100</span></span>
                <span className="text-slate-600">|</span>
                <span style={{color:selected.type==='mine'?'#FF0055':selected.type==='safe'?'#00FF9D':'#64748b'}}>
                  {selected.type==='mine'?'⚠ MINE DETECTED':selected.type==='safe'?'✓ VERIFIED':'◌ UNAUDITED'}
                </span>
                <button onClick={()=>setSelected(null)} className="text-slate-600 hover:text-slate-300 ml-2">✕</button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right sidebar */}
        <aside className="w-64 shrink-0 border-l flex flex-col" style={{borderColor:'rgba(0,240,255,0.15)',background:'rgba(0,240,255,0.02)'}}>
          <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{borderColor:'rgba(0,240,255,0.1)',background:'rgba(0,0,0,0.3)'}}>
            <User className="w-3 h-3" style={{color:'#00F0FF'}} />
            <span className="text-xs font-bold text-slate-200 tracking-wider uppercase">Selected Agent</span>
          </div>

          <div className="p-4 flex flex-col gap-4">
            {selected ? (
              <>
                <div className="flex gap-3 items-center">
                  <div className="relative w-14 h-14 shrink-0 flex items-center justify-center rounded-full"
                    style={{border:`2px solid ${selected.type==='mine'?'#FF0055':selected.type==='safe'?'#00FF9D':'#475569'}`}}>
                    <span className="text-xl font-bold font-mono" style={{color:selected.type==='mine'?'#FF0055':'#00FF9D'}}>{selected.trust}</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-100">{selected.label}</div>
                    <div className="text-[10px] font-mono text-slate-500">{selected.id}</div>
                    <div className="text-[10px] font-mono mt-1" style={{color:'#00F0FF'}}>
                      TRUST: {selected.type==='mine'?'CRITICAL LOW':selected.trust>70?'HIGH':'MEDIUM'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-y py-3" style={{borderColor:'rgba(0,240,255,0.1)'}}>
                  {[{l:'JOBS',v:selected.raw?.breakdown?.totalJobs || '0'},{l:'COMPLETION',v:`${Math.round(selected.raw?.breakdown?.completionRate*100 || 0)}%`},{l:'CAPITAL',v:selected.raw?.collateral||'—'},{l:'NETWORK',v:selected.raw?.chain||'BASE'}].map(({l,v})=>(
                    <div key={l}><div className="text-slate-500 mb-0.5">{l}</div><div className="text-slate-200">{v}</div></div>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <button className="w-full py-2 rounded text-xs font-bold tracking-wider border transition-all" style={{background:'rgba(0,240,255,0.1)',border:'1px solid #00F0FF',color:'#00F0FF'}}>
                    <Zap className="inline w-3 h-3 mr-1" /> REQUEST SWEEP
                  </button>
                  <div className="flex gap-2">
                    <button className="flex-1 py-1.5 rounded text-[10px] font-mono border text-slate-400" style={{borderColor:'rgba(0,240,255,0.15)'}}>DEPLOY GUARD</button>
                    <Link href={`/agent/${selected.id}`} className="flex-1 py-1.5 rounded text-[10px] font-mono border text-slate-400 text-center hover:bg-white/5 hover:text-white transition-colors" style={{borderColor:'rgba(0,240,255,0.15)'}}>FULL REPORT</Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-xs font-mono text-center">
                <Target className="w-6 h-6 mb-2 opacity-30" />
                Click a node on the map<br/>to select an agent
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mt-auto border-t p-3" style={{borderColor:'rgba(0,240,255,0.1)'}}>
            {[{label:'TOTAL SWEEPS',value:'1,284',icon:Activity,color:'#00F0FF'},{label:'THREATS FOUND',value:'47',icon:ShieldAlert,color:'#FF0055'},{label:'CLEARED',value:'1,091',icon:Shield,color:'#00FF9D'}].map(({label,value,icon:Icon,color})=>(
              <div key={label} className="flex justify-between items-center py-2 border-b text-xs font-mono" style={{borderColor:'rgba(255,255,255,0.05)'}}>
                <div className="flex items-center gap-2 text-slate-500"><Icon className="w-3 h-3" style={{color}} />{label}</div>
                <span className="font-bold" style={{color}}>{value}</span>
              </div>
            ))}
          </div>

          <div className="p-3">
            <button className="w-full py-3 rounded text-xs font-bold tracking-wider" style={{background:'rgba(0,240,255,0.1)',border:'1px solid rgba(0,240,255,0.3)',color:'#00F0FF'}}>
              REQUEST SWEEP
            </button>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="border-t py-2 px-8 text-center text-[10px] text-slate-600 font-mono tracking-widest shrink-0" style={{borderColor:'rgba(0,240,255,0.1)',background:'rgba(0,0,0,0.4)'}}>
        LAST INDEXED: 30 SECONDS AGO &nbsp;|&nbsp; INDEXER: MAIAT ACP AGENT #18281 &nbsp;|&nbsp; NETWORK: BASE MAINNET
      </footer>
    </div>
  );
}
