'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams, usePathname, useSearchParams } from 'next/navigation';
import { 
  Radar, Terminal, Shield, Zap, 
  User, Target, MessageSquare, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Plus, Minus, Maximize, PenTool, Search, Activity, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReviewForm } from '@/components/ReviewForm';
import useSWR from 'swr';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────
type AgentNode = {
  id: string; x: number; y: number; r: number;
  trust: number; type: 'safe' | 'mine' | 'unaudited';
  label: string;
  raw?: any;
};

type IntelItem = { time: string; msg: string; type: 'info' | 'warning' | 'error'; agentId?: string; targetId?: string };

const initialIntelFeed: IntelItem[] = [
  { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: 'SYS: Monitoring Agent Network...', type: 'info' }
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ─── Radar Canvas ─────────────────────────────────────────────────────────────
export type MapRef = { 
  panToNode: (id: string) => void;
  resetView: () => void;
  move: (dx: number, dy: number) => void;
  zoom: (factor: number) => void;
  pingNode: (id: string, targetId?: string) => void;
};

const AgentBubbleMap = React.memo(React.forwardRef<MapRef, { agents: AgentNode[], onSelect: (id: string | null) => void, onSetFilter: (f: string) => void, selectedId?: string | null }>(({ agents, onSelect, onSetFilter, selectedId }, ref) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const staticNodes = React.useRef<any[]>([]);
  const avatars = React.useRef<Record<string, HTMLImageElement>>({});
  const transform = React.useRef({ x: 0, y: 0, k: 1 });
  const pings = React.useRef<{id: string, targetId?: string, startTime: number}[]>([]);

  const selectedIdRef = React.useRef(selectedId);
  React.useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Layout logic
  React.useEffect(() => {
    if (dimensions.width === 0) return;
    const W = dimensions.width, H = dimensions.height;
    const cx = W/2, cy = H/2;
    const clusters = { safe: { x: cx - W*0.3, y: cy }, mine: { x: cx + W*0.4, y: cy - H*0.3 }, unaudited: { x: cx + W*0.45, y: cy + H*0.2 } };
    const groups = { safe: agents.filter(a => a.type === 'safe'), mine: agents.filter(a => a.type === 'mine'), unaudited: agents.filter(a => a.type === 'unaudited') };
    const newNodes: any[] = [];
    Object.entries(groups).forEach(([type, groupAgents]) => {
      const hub = clusters[type as keyof typeof clusters];
      groupAgents.sort((a,b) => b.r - a.r);
      let angle = 0, radius = 0;
      groupAgents.forEach((a, index) => {
        const hash = a.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        if (index === 0) { newNodes.push({ ...a, x: hub.x, y: hub.y }); }
        else {
          radius += (a.r/2.5 + 5); 
          angle += 0.35 + (hash % 20) * 0.015;
          newNodes.push({ ...a, x: hub.x + Math.cos(angle) * (radius + 40), y: hub.y + Math.sin(angle) * (radius + 40) });
        }
      });
    });
    staticNodes.current = newNodes;
  }, [agents, dimensions]);

  React.useImperativeHandle(ref, () => ({
    panToNode: (id: string) => {
      const node = staticNodes.current.find(n => n.id.toLowerCase() === id.toLowerCase());
      if (node && dimensions.width > 0) {
        const targetK = 2.5;
        transform.current = { x: (dimensions.width/2) - (node.x * targetK), y: (dimensions.height/2) - (node.y * targetK), k: targetK };
      }
    },
    resetView: () => { transform.current = { x: 0, y: 0, k: 1 }; },
    move: (dx, dy) => { transform.current.x += dx * transform.current.k; transform.current.y += dy * transform.current.k; },
    zoom: (factor) => {
      const { x, y, k } = transform.current;
      const newK = Math.max(0.1, Math.min(k * factor, 5));
      transform.current.x = (dimensions.width/2) - ((dimensions.width/2) - x) * newK / k;
      transform.current.y = (dimensions.height/2) - ((dimensions.height/2) - y) * newK / k;
      transform.current.k = newK;
    },
    pingNode: (id: string, targetId?: string) => {
      pings.current.push({ id, targetId, startTime: Date.now() });
      if (pings.current.length > 8) pings.current.shift();
    }
  }));

  React.useEffect(() => {
    if (typeof window === 'undefined' || dimensions.width === 0) return;
    let animId: number;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.resetTransform();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();

    let tick = 0;
    const draw = () => {
      tick += 0.01;
      const W = dimensions.width, H = dimensions.height;
      const MathPI2 = Math.PI * 2;
      const { x, y, k } = transform.current;
      const curSel = selectedIdRef.current;
      ctx.clearRect(0,0,W,H);
      ctx.resetTransform();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.fillStyle = '#010204'; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.015)'; ctx.lineWidth = 1;
      const gs = 150 * k;
      for(let lx = x % gs; lx < W; lx += gs) { ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke(); }
      for(let ly = y % gs; ly < H; ly += gs) { ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); }
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      staticNodes.current.forEach(n => {
        if (!avatars.current[n.id]) {
          const img = new window.Image(); img.src = n.raw?.logo || `https://api.dicebear.com/7.x/bottts/svg?seed=${n.id}&backgroundColor=transparent`;
          avatars.current[n.id] = img;
        }
      });
      const now = Date.now();
      pings.current = pings.current.filter(p => now - p.startTime < 2000);
      pings.current.forEach(p => {
        if (p.targetId) {
          const n1 = staticNodes.current.find(n => n.id === p.id);
          const n2 = staticNodes.current.find(n => n.id === p.targetId);
          if (n1 && n2) {
            const age = (now - p.startTime) / 2000;
            ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.5 * (1 - age)})`; ctx.lineWidth = 2; ctx.stroke();
            const packetX = n1.x + (n2.x - n1.x) * age; const packetY = n1.y + (n2.y - n1.y) * age;
            ctx.beginPath(); ctx.arc(packetX, packetY, 3, 0, MathPI2); ctx.fillStyle = '#00F0FF'; ctx.fill();
          }
        }
      });
      const nodesToDraw = [...staticNodes.current].sort((a,b) => (a.id === curSel ? 1 : b.id === curSel ? -1 : 0));
      nodesToDraw.forEach(n => {
        const isSelected = n.id === curSel;
        const opacity = curSel ? (isSelected ? 1 : 0.25) : 0.8;
        let col = '#475569', bg = '#0f172a';
        if (n.type === 'safe') { col = '#00FF9D'; bg = '#022c22'; }
        else if (n.type === 'mine') { col = '#FF0055'; bg = '#4c0519'; }
        if (n.type === 'safe' && !curSel || (isSelected)) {
          const pulse = Math.sin(tick * 1.5) * 0.5 + 0.5;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + (pulse * (n.r > 20 ? 6 : 3)), 0, MathPI2);
          ctx.strokeStyle = `rgba(0, 255, 157, ${(0.05 + pulse * 0.15) * opacity})`; ctx.lineWidth = 1.5; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, MathPI2);
        ctx.globalAlpha = opacity; ctx.fillStyle = bg; ctx.fill();
        ctx.strokeStyle = isSelected ? '#00F0FF' : col; ctx.lineWidth = isSelected ? 2 : 1; ctx.stroke();
        ctx.globalAlpha = 1.0;
        const img = avatars.current[n.id];
        if (img && img.complete && img.naturalHeight > 0) {
          ctx.save(); ctx.beginPath(); ctx.arc(n.x, n.y, n.r - 1, 0, MathPI2); ctx.clip();
          ctx.globalAlpha = opacity;
          ctx.drawImage(img, n.x - n.r + 1, n.y - n.r + 1, (n.r - 1) * 2, (n.r - 1) * 2);
          ctx.restore();
        }
        if (isSelected || (k > 2.0 && n.r > 15)) {
          ctx.font = `${Math.max(8, 9/k)}px JetBrains Mono`;
          ctx.fillStyle = isSelected ? '#00F0FF' : `rgba(255,255,255,${0.6 * opacity})`;
          ctx.textAlign = 'center'; ctx.fillText(n.label, n.x, n.y + n.r + (12/k));
        }
      });
      ctx.restore();
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); };
  }, [dimensions]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const wx = (mx - transform.current.x) / transform.current.k, wy = (my - transform.current.y) / transform.current.k;
    let closestId: string | null = null, md = Infinity;
    staticNodes.current.forEach(n => {
      const d = Math.hypot(n.x - wx, n.y - wy);
      if (d < Math.max(n.r, 12) + 10 && d < md) { md = d; closestId = n.id; }
    });
    onSelect(closestId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [onSelect]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#010204]">
      <canvas ref={canvasRef} className="w-full h-full cursor-crosshair block touch-none" 
        onWheel={(e) => { e.preventDefault(); (ref as any).current?.zoom(e.deltaY < 0 ? 1.1 : 0.9); }}
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => { if (e.buttons === 1) { transform.current.x += e.movementX; transform.current.y += e.movementY; } }}
      />
    </div>
  );
}));

// ─── Tactical Legend ─────────────────────────────────────────────────────────
function TacticalLegend() {
  return (
    <div className="absolute bottom-6 left-6 p-3 bg-black/40 border border-white/5 rounded-xl backdrop-blur-xl z-30 font-mono text-[9px] text-slate-500 space-y-2 select-none">
      <div className="text-[10px] font-bold text-slate-300 border-b border-white/5 pb-1 mb-2 uppercase tracking-widest">Protocol Legend</div>
      <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#00FF9D]" /> <span>HIGH TRUST VERIFIED</span></div>
      <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#FF0055]" /> <span>CRITICAL THREAT FLAG</span></div>
      <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#475569]" /> <span>UNAUDITED NODE</span></div>
      <div className="flex items-center gap-2 border-t border-white/5 pt-1 mt-1"><div className="w-3 h-0.5 bg-cyan-500/50" /> <span>DATA TRANSFER LINK</span></div>
    </div>
  );
}

// ─── Nav Controls ─────────────────────────────────────────────────────────────
function NavControls({ onMove, onZoom, onReset }: { onMove: (dx: number, dy: number) => void, onZoom: (f: number) => void, onReset: () => void }) {
  const btn = "w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 text-slate-400 hover:bg-cyan-500 hover:text-black transition-all rounded-lg backdrop-blur-xl shadow-2xl";
  return (
    <div className="absolute bottom-6 right-6 flex flex-col gap-4 items-end z-30">
      <button onClick={onReset} className={btn} title="Reset View"><Maximize className="w-4 h-4" /></button>
      <div className="grid grid-cols-3 gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
        <div /><button onClick={() => onMove(0, 60)} className={btn}><ChevronUp className="w-4 h-4" /></button><div />
        <button onClick={() => onMove(60, 0)} className={btn}><ChevronLeft className="w-4 h-4" /></button>
        <button onClick={onReset} className="w-8 h-8 flex items-center justify-center text-cyan-500/50"><Target className="w-3 h-3"/></button>
        <button onClick={() => onMove(-60, 0)} className={btn}><ChevronRight className="w-4 h-4" /></button>
        <div /><button onClick={() => onMove(0, -60)} className={btn}><ChevronDown className="w-4 h-4" /></button><div />
      </div>
      <div className="flex flex-col gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
        <button onClick={() => onZoom(1.2)} className={btn}><Plus className="w-4 h-4" /></button>
        <button onClick={() => onZoom(0.8)} className={btn}><Minus className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function MonitorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // ── Derived State from URL ──
  const selectedId = useMemo(() => {
    const q = searchParams.get('q');
    const pathParts = pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    return q || (lastPart?.startsWith('0x') ? lastPart : null);
  }, [pathname, searchParams]);

  const mapRef = React.useRef<MapRef>(null);
  const profileSidebarRef = React.useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [intelFeed, setIntelFeed] = useState<typeof initialIntelFeed>(initialIntelFeed);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sse = new EventSource('/api/v1/monitor/feed');
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.msg) {
          setIntelFeed(prev => {
            const newFeed = [...prev, data];
            if (newFeed.length > 20) newFeed.shift();
            return newFeed;
          });
          if (data.agentId) mapRef.current?.pingNode(data.agentId, data.targetId);
        }
      } catch (err) {}
    };
    return () => sse.close();
  }, []);

  const { data } = useSWR('/api/v1/agents?limit=1000', fetcher, { refreshInterval: 15000 });
  const { data: sweepsData } = useSWR('/api/v1/monitor/sweeps', fetcher, { refreshInterval: 60000 });
  
  const radarAgents = useMemo<AgentNode[]>(() => {
    if (!data?.agents) return [];
    const seen = new Set();
    return data.agents.filter((a: any) => {
      const key = a.id.toLowerCase();
      if (seen.has(key)) return false; seen.add(key); return true;
    }).map((acc: any) => {
      const trust = acc.trust?.score ?? 0;
      let type: 'safe' | 'mine' | 'unaudited' = trust >= 75 ? 'safe' : trust <= 50 ? 'mine' : 'unaudited';
      const jobs = acc.breakdown?.totalJobs || 0;
      const r = type === 'safe' ? Math.max(7, Math.min(45, 7 + (jobs > 0 ? Math.log10(jobs) * 6 : 0))) : type === 'mine' ? 12 : 6;
      return { id: acc.id, label: acc.name || acc.id.slice(0,6), trust, type, x: 0, y: 0, r, raw: acc };
    });
  }, [data]);

  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    return radarAgents.find(a => a.id.toLowerCase() === selectedId.toLowerCase()) || null;
  }, [selectedId, radarAgents]);

  const filteredAgents = useMemo(() => {
    if (filter === 'HIGH TRUST ✓') return radarAgents.filter(a => a.type === 'safe');
    if (filter === 'MINES ⚠') return radarAgents.filter(a => a.type === 'mine');
    if (filter === 'UN-AUDITED') return radarAgents.filter(a => a.type === 'unaudited');
    return radarAgents;
  }, [radarAgents, filter]);

  // Handle Panning when URL changes
  const lastPannedId = useRef<string | null>(null);
  useEffect(() => {
    if (selectedId && selectedId !== lastPannedId.current) {
      const node = radarAgents.find(a => a.id.toLowerCase() === selectedId.toLowerCase());
      if (node) {
        lastPannedId.current = selectedId;
        setTimeout(() => mapRef.current?.panToNode(node.id), 50);
      }
    } else if (!selectedId) {
      lastPannedId.current = null;
    }
  }, [selectedId, radarAgents]);

  const handleSelect = useCallback((id: string | null) => {
    if (!id) {
      router.replace('/monitor', { scroll: false });
      setShowReviewForm(false);
      return;
    }
    const node = radarAgents.find(a => a.id.toLowerCase() === id.toLowerCase());
    const cleanName = (node?.label || 'agent').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    router.replace(`/monitor/agent/${cleanName}/${id}`, { scroll: false });
  }, [router, radarAgents]);

  const handleMonitorSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.replace(`/monitor?q=${encodeURIComponent(searchQuery.trim())}`, { scroll: false });
      setSearchQuery('');
    }
  };

  const openDeepReport = () => {
    if (selectedNode) {
      const cleanName = (selectedNode.label || 'agent').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      router.push(`/agent/${cleanName}/${selectedNode.id}`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#010204]" style={{fontFamily:'JetBrains Mono,monospace'}}>
      <div className="flex items-center gap-2 px-6 py-2 border-b border-white/5 bg-black/40 shrink-0">
        {['ALL','HIGH TRUST ✓','MINES ⚠','UN-AUDITED'].map(label => (
          <button key={label} onClick={()=>setFilter(label)} className={`px-3 py-1 rounded-lg text-[9px] font-bold tracking-widest border transition-all ${filter===label?'border-[#3b82f6]/50 text-[#3b82f6] bg-[#3b82f6]/10':'border-transparent text-slate-500 hover:text-slate-300'}`}>{label}</button>
        ))}
        
        <div className="ml-auto flex items-center gap-6">
          <form onSubmit={handleMonitorSearch} className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 group-focus-within:text-[#3b82f6] transition-colors" />
            <input 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="bg-white/[0.03] border border-white/10 text-slate-300 px-4 py-1.5 pl-8 rounded-xl w-64 focus:w-80 focus:bg-white/[0.07] focus:outline-none focus:border-[#3b82f6]/50 transition-all shadow-inner placeholder:text-slate-700 text-xs font-mono" 
              placeholder="Locate node by name/0x..." 
            />
          </form>
          <div className="flex items-center gap-2 text-[9px] text-slate-500 uppercase tracking-tighter font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" /> 
            {(data?.pagination?.total ?? 0).toLocaleString()} NODES MAPPED
          </div>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 relative bg-[#010204] overflow-hidden">
          <AgentBubbleMap ref={mapRef} agents={filteredAgents} onSelect={handleSelect} onSetFilter={setFilter} selectedId={selectedId} />
          <TacticalLegend /><NavControls onMove={(dx, dy) => mapRef.current?.move(dx, dy)} onZoom={(f) => mapRef.current?.zoom(f)} onReset={() => mapRef.current?.resetView()} />
          <AnimatePresence>
            {selectedNode && (<motion.div initial={{opacity:0,scale:0.95,y:10}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:10}} className="absolute top-6 left-1/2 -translate-x-1/2 px-6 py-2 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-6 z-20"><div><div className="text-[8px] text-slate-500 uppercase font-bold tracking-tighter">Selected Node</div><div className="text-xs font-bold text-cyan-400">{selectedNode.label}</div></div><div className="w-px h-6 bg-white/10" /><div><div className="text-[8px] text-slate-500 uppercase font-bold tracking-tighter">Trust Score</div><div className={`text-xs font-bold ${selectedNode.type==='mine'?'text-red-500':'text-emerald-400'}`}>{selectedNode.trust}/100</div></div><button onClick={()=>handleSelect(null)} className="text-slate-500 hover:text-white transition-colors">✕</button></motion.div>)}
          </AnimatePresence>
        </main>

        <aside ref={profileSidebarRef} className="w-80 shrink-0 border-l border-white/5 bg-black/60 backdrop-blur-xl flex flex-col overflow-y-auto custom-scrollbar">
          <div className="px-4 py-3 border-b border-white/5 bg-black/20 sticky top-0 z-10 flex items-center gap-2"><User className="w-3 h-3 text-[#3b82f6]" /> <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">Agent Profile</span></div>
          <div className="p-6 flex flex-col gap-6">
            {selectedNode ? (
              <>
                <div className="flex gap-4 items-center"><div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 p-1 bg-white/5"><img src={selectedNode.raw?.logo || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedNode.id}&backgroundColor=transparent`} alt="A" className="w-full h-full object-cover rounded-xl" /></div><div className="min-w-0 flex-1"><div className="text-sm font-bold text-white truncate">{selectedNode.label}</div><div className="text-[9px] font-mono text-slate-500 truncate mt-1">{selectedNode.id}</div></div></div>
                <div className="relative">
                  <div className="absolute -left-2 top-0 bottom-0 w-0.5 bg-[#3b82f6]/30 rounded-full" />
                  <p className="text-[11px] text-slate-300 leading-relaxed font-mono pl-3 italic">
                    {selectedNode.raw?.description || "No behavioral narrative provided. Sector monitoring in progress."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3"><div className="bg-white/5 p-3 rounded-xl border border-white/5"><div className="text-[8px] text-slate-500 uppercase mb-1">Completion</div><div className="text-xs font-bold text-emerald-400">{Math.round((selectedNode.raw?.breakdown?.completionRate || 0)*100)}%</div></div><div className="bg-white/5 p-3 rounded-xl border border-white/5"><div className="text-[8px] text-slate-500 uppercase mb-1">Jobs Ran</div><div className="text-xs font-bold text-white">{selectedNode.raw?.breakdown?.totalJobs || '0'}</div></div></div>
                
                <div className="space-y-2">
                  <button onClick={openDeepReport} className="w-full py-2.5 rounded-xl text-[9px] font-bold tracking-widest border border-[#3b82f6]/30 text-white bg-[#3b82f6]/20 hover:bg-[#3b82f6]/40 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.2)]"><FileText className="w-3 h-3" /> DEEP BEHAVIORAL REPORT</button>
                  <button className="w-full py-2.5 rounded-xl text-[9px] font-bold tracking-widest border border-white/10 text-slate-400 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-2"><Zap className="w-3 h-3" /> DEEP SECURITY SWEEP</button>
                  <div className="flex gap-2">
                    <button className="flex-1 py-2 rounded-xl text-[9px] font-bold tracking-widest border border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/10 transition-all">DEPLOY GUARD</button>
                    <button onClick={() => { setShowReviewForm(!showReviewForm); if(!showReviewForm) setTimeout(()=>profileSidebarRef.current?.scrollTo({top:profileSidebarRef.current.scrollHeight,behavior:'smooth'}),100); }} className="flex-1 py-2 rounded-xl text-[9px] font-bold tracking-widest border border-amber-500/20 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 transition-all flex items-center justify-center gap-1.5"><PenTool className="w-3 h-3" /> {showReviewForm ? 'CANCEL' : 'REPORT INTEL'}</button>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <div className="text-[10px] font-bold text-slate-400 mb-4 flex items-center gap-2"><MessageSquare className="w-3 h-3 text-[#3b82f6]" /> COMMUNITY REVIEWS</div>
                  {showReviewForm ? (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ReviewForm projectId={selectedNode.id} projectName={selectedNode.label} onSuccess={() => setShowReviewForm(false)} /></motion.div>) : (<AgentReviews agentId={selectedNode.id} />)}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-20 text-slate-500 text-center px-10"><Target className="w-10 h-10 mb-6" /><p className="text-[10px] font-mono leading-relaxed uppercase tracking-widest">Select a network node to initiate deep behavioral analysis</p></div>
            )}
          </div>
        </aside>
      </div>

      {/* ── INTEL FEED MARQUEE ── */}
      <div className="h-10 bg-black/80 border-t border-white/5 flex items-center overflow-hidden whitespace-nowrap relative z-40 group">
        <div className="px-4 h-full bg-[#3b82f6]/10 border-r border-white/5 flex items-center gap-2 shrink-0 z-10 relative backdrop-blur-md">
          <Activity className="w-3.5 h-3.5 text-[#3b82f6] animate-pulse" />
          <span className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest">Live Intel</span>
        </div>
        <div className="flex animate-marquee group-hover:pause-marquee py-2">
          {intelFeed.concat(intelFeed).map((item, i) => (
            <div 
              key={i} 
              onClick={() => item.agentId && handleSelect(item.agentId)}
              className="inline-flex items-center gap-3 px-6 cursor-pointer hover:text-slate-300 transition-colors border-r border-white/5"
            >
              <span className="text-[9px] font-black text-slate-700 font-mono">[{item.time}]</span>
              <span className={`text-[10px] font-bold opacity-40 group-hover:opacity-100 transition-opacity ${item.type === 'error' ? 'text-red-500' : item.type === 'warning' ? 'text-amber-500' : 'text-slate-400'}`}>
                {item.msg}
              </span>
            </div>
          ))}
        </div>
      </div>

      <footer className="border-t border-white/5 py-2 px-8 text-center text-[8px] text-slate-600 font-mono tracking-[0.3em] bg-black/80 uppercase">Maiat Protocol Monitor // Sector: Base Mainnet // Buffer: Clear</footer>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 120s linear infinite;
        }
        .pause-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

function AgentReviews({ agentId }: { agentId: string }) {
  const { data } = useSWR(`/api/v1/review?address=${agentId}`, fetcher);
  const reviews = data?.reviews || [];
  if (reviews.length === 0) return <div className="text-[9px] text-slate-600 italic uppercase bg-white/5 p-6 rounded-2xl border border-white/5 text-center">No field data recorded.</div>;
  return (
    <div className="space-y-4">
      {reviews.slice(0, 3).map((r: any) => (
        <div key={r.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 text-[9px] text-slate-400 shadow-sm transition-all hover:bg-white/[0.07]">
          <div className="flex justify-between font-bold text-cyan-600/60 mb-2 border-b border-white/5 pb-2"><span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> @{r.reviewer.slice(0,6)}</span><span className="text-slate-600 font-mono opacity-50">{new Date(r.timestamp).toLocaleDateString()}</span></div>
          <p className="leading-relaxed text-slate-300 italic mb-2">"{r.comment || 'N/A'}"</p>
          <div className="flex items-center justify-between"><span className={`font-bold ${r.rating >= 7 ? 'text-emerald-500' : 'text-amber-400'}`}>RATING: {r.rating}/10</span>{r.weight > 1 && <span className="text-[7px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 font-black">VERIFIED {r.weight}X</span>}</div>
        </div>
      ))}
    </div>
  );
}
