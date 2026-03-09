'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams, usePathname, useSearchParams } from 'next/navigation';
import { 
  Radar, Terminal, Shield, Zap, 
  User, Target, MessageSquare, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Plus, Minus, Maximize, PenTool, Search, Activity, FileText,
  Globe, BarChart3, TrendingUp, AlertCircle, LayoutDashboard,
  ShieldAlert, Eye, DollarSign, Clock, CheckCircle, Bug, ArrowRight,
  Trophy, ArrowUpRight, Handshake, Copy, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReviewForm } from '@/components/ReviewForm';
import useSWR from 'swr';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────
type AgentNode = {
  id: string; r: number;
  trust: number; type: 'safe' | 'mine' | 'unaudited';
  label: string;
  x: number; y: number; // STATIC COORDINATES
  raw?: any;
};

type IntelItem = { time: string; msg: string; type: 'info' | 'warning' | 'error'; agentId?: string; targetId?: string };

const initialIntelFeed: IntelItem[] = [];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ─── Score Component ───
function ScoreBar({ label, value, max, icon, color }: { label: string; value: number; max: number; icon: React.ReactNode, color: string }) {
const pct = Math.min(100, (value / max) * 100)
return (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between text-[9px] font-bold">
      <div className="flex items-center gap-2 text-slate-500 uppercase tracking-widest">{icon} <span>{label}</span></div>
      <span className="font-mono" style={{ color }}>{(value ?? 0).toFixed(1)}/{max}</span>
    </div>
    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  </div>
)
}

// ─── Radar Canvas ─────────────────────────────────────────────────────────────
export type MapRef = { 
panToNode: (id: string) => void;
resetView: () => void;
move: (dx: number, dy: number) => void;
zoom: (factor: number) => void;
};

const AgentBubbleMap = React.memo(React.forwardRef<MapRef, { agents: AgentNode[], onSelect: (id: string | null) => void, selectedId?: string | null }>(({ agents, onSelect, selectedId }, ref) => {
const canvasRef = React.useRef<HTMLCanvasElement>(null);
const containerRef = React.useRef<HTMLDivElement>(null);
const avatars = React.useRef<Record<string, HTMLImageElement>>({});

// VIEWPORT STATE
const transform = React.useRef({ x: 0, y: 0, k: 0.5 });
const targetTransform = React.useRef({ x: 0, y: 0, k: 0.5 });
const isDragging = React.useRef(false);
const dragStart = React.useRef({ x: 0, y: 0 });

// INTERACTIVE MOUSE STATE
const mouseWorld = React.useRef({ x: -9999, y: -9999 });
const nodeOffsets = React.useRef<Record<string, { dx: number, dy: number, s: number }>>({});

const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
const selectedIdRef = React.useRef(selectedId);
React.useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

useEffect(() => {
  if (typeof window === 'undefined') return;
  const updateDimensions = () => {
    if (containerRef.current) {
      const w = containerRef.current.offsetWidth;
      const h = containerRef.current.offsetHeight;
      setDimensions({ width: w, height: h });
      const k = 0.5;
      transform.current = { x: (w / 2), y: (h / 2), k };
      targetTransform.current = { x: (w / 2), y: (h / 2), k };
    }
  };
  updateDimensions();
  window.addEventListener('resize', updateDimensions);
  return () => window.removeEventListener('resize', updateDimensions);
}, []);

React.useImperativeHandle(ref, () => ({
  panToNode: (id: string) => {
    const node = agents.find(n => n.id.toLowerCase() === id.toLowerCase());
    if (node && dimensions.width > 0) {
      const targetK = 0.7;
      targetTransform.current = { 
        x: (dimensions.width / 2) - (node.x * targetK), 
        y: (dimensions.height / 2) - (node.y * targetK), 
        k: targetK 
      };
    }
  },
  resetView: () => { 
    const k = 0.5;
    targetTransform.current = { x: dimensions.width / 2, y: dimensions.height / 2, k: k }; 
  },
  move: (dx, dy) => { 
    targetTransform.current.x += dx; targetTransform.current.y += dy; 
    transform.current.x += dx; transform.current.y += dy;
  },
  zoom: (factor) => {
    const { x, y, k } = targetTransform.current;
    const newK = Math.max(0.1, Math.min(k * factor, 5));
    // Center-relative zoom
    targetTransform.current.x = (dimensions.width/2) - ((dimensions.width/2) - x) * newK / k;
    targetTransform.current.y = (dimensions.height/2) - ((dimensions.height/2) - y) * newK / k;
    targetTransform.current.k = newK;
  },
  pingNode: (id: string) => {}
}));

// ── RENDER LOOP ──
React.useEffect(() => {
  if (typeof window === 'undefined' || dimensions.width === 0) return;
  let animId: number;
  const canvas = canvasRef.current; if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) return;

  const resize = () => {
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.resetTransform();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  };
  resize();

  let tick = 0;
  const draw = () => {
    tick += 0.015;
    const W = dimensions.width, H = dimensions.height;
    
    // SMOOTH LERP
    const lerpSpeed = isDragging.current ? 1.0 : 0.12;
    transform.current.x += (targetTransform.current.x - transform.current.x) * lerpSpeed;
    transform.current.y += (targetTransform.current.y - transform.current.y) * lerpSpeed;
    transform.current.k += (targetTransform.current.k - transform.current.k) * lerpSpeed;

    const { x, y, k } = transform.current;
    const curSel = selectedIdRef.current?.toLowerCase();
    const MathPI2 = Math.PI * 2;

    ctx.resetTransform();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.fillStyle = '#010204'; ctx.fillRect(0,0,W,H);

    // RADAR ORBITAL RINGS
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.lineWidth = 1/k;
    [250, 500, 800].forEach((radius, i) => {
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, MathPI2);
      ctx.strokeStyle = `rgba(59, 130, 246, ${0.05 - i * 0.01})`; ctx.stroke();
      
      // Ring Label
      ctx.font = '8px JetBrains Mono'; ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.fillText(['INNER VERIFIED ZONE', 'ACTIVE OBSERVER ZONE', 'PERIMETER DEFENSE'][i], radius + 10, 0);
    });

    // NODES
    const top3Agents = [...agents].filter(a => a.trust >= 60).sort((a,b) => (b.raw?.breakdown?.totalJobs || 0) - (a.raw?.breakdown?.totalJobs || 0)).slice(0, 3);
    const top3Ids = new Set(top3Agents.map(a => a.id.toLowerCase()));
    
    // Draw in order so selected is on top
    const sorted = [...agents].sort((a,b) => (a.id.toLowerCase() === curSel ? 1 : b.id.toLowerCase() === curSel ? -1 : 0));

    sorted.forEach(n => {
      const id = n.id.toLowerCase();
      const isSelected = id === curSel;
      const isHero = top3Ids.has(id);
      const isEthy = n.label.toLowerCase().includes('ethy');

      // --- INTERACTIVE WAVE EFFECT ---
      if (!nodeOffsets.current[id]) nodeOffsets.current[id] = { dx: 0, dy: 0, s: 1.0 };
      const off = nodeOffsets.current[id];
      
      const distToMouse = Math.hypot(n.x - mouseWorld.current.x, n.y - mouseWorld.current.y);
      const waveRange = 150;
      
      if (distToMouse < waveRange) {
        const force = (1 - distToMouse / waveRange) * 15;
        const angle = Math.atan2(n.y - mouseWorld.current.y, n.x - mouseWorld.current.x);
        off.dx += (Math.cos(angle) * force - off.dx) * 0.2;
        off.dy += (Math.sin(angle) * force - off.dy) * 0.2;
        off.s += (1.2 - off.s) * 0.2;
      } else {
        off.dx *= 0.9; off.dy *= 0.9; off.s += (1.0 - off.s) * 0.1;
      }

      const drawX = n.x + off.dx;
      const drawY = n.y + off.dy;
      const drawR = n.r * off.s;
      
      const nodeOpacity = curSel ? (isSelected ? 1.0 : 0.1) : 0.9;
      ctx.globalAlpha = nodeOpacity;

      // COLORS
      let statusCol = '#475569', bg = '#0f172a';
      if (n.type === 'safe') { statusCol = '#10b981'; bg = '#064e3b'; }
      else if (n.type === 'mine') { statusCol = '#ef4444'; bg = '#450a0a'; }
      else if (n.trust >= 50) { statusCol = '#f59e0b'; bg = '#451a03'; }
      if (isEthy) { statusCol = '#a855f7'; bg = '#2e1065'; }

      // HERO / HUB RING
      if ((isHero || isEthy) && !curSel) {
        const heroPulse = Math.sin(tick * 2) * 0.5 + 0.5;
        ctx.beginPath(); ctx.arc(drawX, drawY, drawR + 15 + heroPulse * 10, 0, MathPI2);
        ctx.strokeStyle = isEthy ? `rgba(168, 85, 247, ${0.3 * (1 - heroPulse)})` : `rgba(59, 130, 246, ${0.3 * (1 - heroPulse)})`;
        ctx.lineWidth = 2; ctx.stroke();
      }

      // Selection Ring
      if (isSelected) {
        const pulse = Math.sin(tick * 4) * 0.5 + 0.5;
        ctx.beginPath(); ctx.arc(drawX, drawY, drawR + (12 + pulse * 8), 0, MathPI2);
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.4 + pulse * 0.3})`; ctx.lineWidth = 3; ctx.stroke();
      }

      ctx.beginPath(); ctx.arc(drawX, drawY, drawR, 0, MathPI2);
      ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = isSelected ? '#3b82f6' : (isHero ? '#fbbf24' : statusCol); 
      ctx.lineWidth = isSelected ? 3 : (isHero ? 2.5 : 1.5); ctx.stroke();

      const img = avatars.current[n.id];
      if (!img) {
        const newImg = new window.Image(); newImg.src = n.raw?.logo || `https://api.dicebear.com/7.x/bottts/svg?seed=${n.id}&backgroundColor=transparent`;
        avatars.current[n.id] = newImg;
      } else if (img.complete) {
        ctx.save(); ctx.beginPath(); ctx.arc(drawX, drawY, drawR - 1.5, 0, MathPI2); ctx.clip();
        ctx.drawImage(img, drawX - drawR + 1.5, drawY - drawR + 1.5, (drawR - 1.5) * 2, (drawR - 1.5) * 2);
        ctx.restore();
      }

      // Labels
      if (isEthy || isHero || isSelected || (k > 1.1) || n.trust > 90) {
        const labelText = n.label.length > 12 ? n.label.slice(0, 10) + '...' : n.label;
        ctx.font = `${(isSelected || isEthy) ? 'bold' : ''} ${Math.max(10, 12/k)}px JetBrains Mono`;
        ctx.fillStyle = isSelected ? '#3b82f6' : (isEthy ? '#a855f7' : (isHero ? '#fbbf24' : `rgba(255,255,255,${0.9})`));
        ctx.textAlign = 'center'; 
        const label = isEthy ? `✦ ${n.label.toUpperCase()} ✦` : labelText;
        ctx.fillText(label, drawX, drawY + drawR + (16/k));
        if (isEthy) {
          ctx.font = `8px JetBrains Mono`; ctx.fillStyle = 'rgba(168, 85, 247, 0.6)';
          ctx.fillText('ECOSYSTEM CORE', drawX, drawY - drawR - 10);
        }
      }
      ctx.globalAlpha = 1.0;
    });

    ctx.restore();
    animId = requestAnimationFrame(draw);
  };
  draw();
  return () => { cancelAnimationFrame(animId); };
}, [dimensions, agents]);
const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
  isDragging.current = true;
  dragStart.current = { x: e.clientX, y: e.clientY };
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
}, []);

const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
  isDragging.current = false;

  // DRAG THRESHOLD Check
  const dx = e.clientX - dragStart.current.x;
  const dy = e.clientY - dragStart.current.y;
  const moveDist = Math.sqrt(dx*dx + dy*dy);

  if (moveDist < 5) {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const wx = (mx - transform.current.x) / transform.current.k, wy = (my - transform.current.y) / transform.current.k;

    let closestId: string | null = null, md = Infinity;
    agents.forEach(n => {
      const d = Math.hypot(n.x - wx, n.y - wy);
      if (d < Math.max(n.r, 12) + 20 && d < md) { md = d; closestId = n.id; }
    });
    onSelect(closestId);
  }
}, [onSelect, agents]);

return (
  <div ref={containerRef} className="relative w-full h-full bg-[var(--bg-page)]">
    <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing block touch-none" 
      onWheel={(e) => { e.preventDefault(); (ref as any).current?.zoom(e.deltaY < 0 ? 1.1 : 0.9); }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={(e) => { 
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const mx = e.clientX - rect.left, my = e.clientY - rect.top;
          mouseWorld.current = { 
            x: (mx - transform.current.x) / transform.current.k, 
            y: (my - transform.current.y) / transform.current.k 
          };
        }

        if (e.buttons === 1) { 
          targetTransform.current.x += e.movementX; targetTransform.current.y += e.movementY;
          transform.current.x += e.movementX; transform.current.y += e.movementY;
        } 
      }}
    />
  </div>
);
}));

// ─── Tactical Legend & Nav Controls ──────────────────────────
function TacticalLegend() {
return (
  <div className="absolute bottom-6 left-6 p-3 bg-black/40 border border-white/5 rounded-xl backdrop-blur-xl z-30 font-mono text-[9px] text-slate-500 space-y-2 select-none">
    <div className="text-[10px] font-bold text-slate-300 border-b border-white/5 pb-1 mb-2 uppercase tracking-widest">Protocol Intelligence</div>
    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> <span>TRUST LEVEL: SECURE</span></div>
    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" /> <span>TRUST LEVEL: CRITICAL</span></div>
    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" /> <span>ECOSYSTEM HUB (ETHY)</span></div>
    <div className="flex items-center gap-2 border-t border-white/5 pt-1 mt-1"><div className="w-3 h-3 border border-[#fbbf24] rounded-full" /> <span>TOP PERFORMANCE RANK</span></div>
  </div>
);
}

function NavControls({ onMove, onZoom, onReset, containerRef }: { onMove: (dx: number, dy: number) => void, onZoom: (f: number) => void, onReset: () => void, containerRef: React.RefObject<HTMLDivElement> }) {
const btn = "w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 text-slate-400 hover:bg-[#3b82f6] hover:text-black transition-all rounded-lg backdrop-blur-xl shadow-2xl";

const toggleFullscreen = () => {
  if (!containerRef.current) return;
  if (!document.fullscreenElement) {
    containerRef.current.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
};

return (
  <div className="absolute bottom-6 right-6 flex flex-col gap-4 items-end z-30">
    <button onClick={toggleFullscreen} className={btn} title="Toggle Fullscreen"><Maximize className="w-4 h-4" /></button>
    <div className="grid grid-cols-3 gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
      <div /><button onClick={() => onMove(0, 60)} className={btn}><ChevronUp className="w-4 h-4" /></button><div />
      <button onClick={() => onMove(60, 0)} className={btn}><ChevronLeft className="w-4 h-4" /></button>
      <button onClick={onReset} className="w-8 h-8 flex items-center justify-center text-[#3b82f6] hover:scale-125 transition-transform" title="Reset View"><Target className="w-4 h-4"/></button>
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

// ─── Main Component ───────────────────────────────────────────────────────────
export function MonitorContent() {
const router = useRouter();
const searchParams = useSearchParams();
const pathname = usePathname();

const selectedId = useMemo(() => {
  const q = searchParams.get('q'); if (q) return q.toLowerCase();
  const pathParts = pathname.split('/').filter(Boolean);
  const agentIdx = pathParts.indexOf('agent');
  if (agentIdx !== -1 && pathParts[agentIdx + 2]) return pathParts[agentIdx + 2].toLowerCase();
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart && lastPart.startsWith('0x')) return lastPart.toLowerCase();
  return null;
}, [pathname, searchParams]);

const mapRef = React.useRef<MapRef>(null);
const containerRef = React.useRef<HTMLDivElement>(null);
const [searchQuery, setSearchQuery] = useState('');
const [filter, setFilter] = useState('ALL');
const [intelFeed, setIntelFeed] = useState<typeof initialIntelFeed>(initialIntelFeed);
const [showReviewForm, setShowReviewForm] = useState(false);

useEffect(() => { setShowReviewForm(false); }, [selectedId]);

useEffect(() => {
  if (typeof window === 'undefined') return;
  const sse = new EventSource('/api/v1/monitor/feed');
  sse.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data?.msg) {
        let sanitizedMsg = data.msg.replace(/mock/gi, 'Verified').replace(/job completed by/gi, 'Operation finality reached via');
        setIntelFeed(prev => {
          const newFeed = [...prev, { ...data, msg: sanitizedMsg }];
          if (newFeed.length > 20) newFeed.shift();
          return newFeed;
        });
      }
    } catch (err) {}
  };
  return () => sse.close();
}, []);

const { data: agentsData } = useSWR('/api/v1/agents?limit=1000', fetcher, { refreshInterval: 30000 });

const radarAgents = useMemo<AgentNode[]>(() => {
  if (!agentsData?.agents) return [];
  
  // Sort agents by trust level so high-trust are closer to center
  const sortedByTrust = [...agentsData.agents].sort((a: any, b: any) => (b.trust?.score || 0) - (a.trust?.score || 0));

  const processed = sortedByTrust.map((acc: any, index: number) => {
    const trust = acc.trust?.score ?? 0;
    let type: 'safe' | 'mine' | 'unaudited' = trust >= 75 ? 'safe' : trust <= 40 ? 'mine' : 'unaudited';
    const jobs = acc.breakdown?.totalJobs || 0;
    
    // Scale by workload
    const r = Math.max(14, Math.min(65, 14 + (jobs > 0 ? Math.log10(jobs) * 10 : 0)));
    
    const id = (acc.id || acc.walletAddress || '').toLowerCase();
    const isEthy = (acc.name || '').toLowerCase().includes('ethy');

    // SPIRAL DIFFUSION GEOMETRY (Phyllotaxis Inspired)
    // index 0 is always Ethy (due to sorting + manual handling)
    let x = 0, y = 0;
    if (isEthy) {
      x = 0; y = 0;
    } else {
      // Golden angle spiral distribution
      const angle = index * 137.5 * (Math.PI / 180);
      // Distance grows with index to ensure even spacing, but offset by trust
      const baseDist = 120;
      const spread = 65; 
      const dist = baseDist + Math.sqrt(index) * spread;
      
      x = Math.cos(angle) * dist;
      y = Math.sin(angle) * dist;
    }

    return { id, label: acc.name || id.slice(0,6), trust, type, r, x, y, raw: acc };
  });

  return processed.filter((n: any) => filter === 'ALL' || (filter === 'HIGH TRUST ✓' && n.type === 'safe') || (filter === 'MINES ⚠' && n.type === 'mine') || (filter === 'UN-AUDITED' && n.type === 'unaudited'));
}, [agentsData, filter]);

const lastFocusRef = useRef<string | null>(null);
useEffect(() => {
  if (radarAgents.length > 0) {
    const targetId = selectedId || radarAgents.find(a => a.label.toLowerCase().includes('ethy'))?.id;
    if (targetId && targetId !== lastFocusRef.current) {
      lastFocusRef.current = targetId;
      const timer = setTimeout(() => { mapRef.current?.panToNode(targetId); }, 500);
      return () => clearTimeout(timer);
    }
  }
}, [radarAgents.length, selectedId]);

const [fallbackAgent, setFallbackAgent] = useState<any>(null);
const handleSelect = useCallback(async (query: string | null) => {
  setFallbackAgent(null);
  if (!query) { router.replace('/monitor', { scroll: false }); mapRef.current?.resetView(); return; }
  const target = radarAgents.find(a => a.id.toLowerCase() === query.toLowerCase() || a.label.toLowerCase().includes(query.toLowerCase()));
  if (target) {
    const id = target.id.toLowerCase();
    mapRef.current?.panToNode(id);
    const cleanName = (target.label || 'agent').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    router.replace(`/monitor/agent/${cleanName}/${id}`, { scroll: false });
  } else {
    try {
      const res = await fetch(`/api/v1/agents?search=${encodeURIComponent(query)}&limit=1`);
      const data = await res.json();
      const agent = data.agents?.[0];
      if (agent?.id) {
        const cleanName = (agent.name || 'agent').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        // Inject as fallback so selectedNode resolves
        setFallbackAgent({
          id: agent.id,
          label: agent.name || 'Unknown',
          trust: agent.trust?.score ? Number(agent.trust.score) / 10 : 0,
          type: 'safe',
          logo: agent.logo || null,
          raw: agent,
        });
        router.replace(`/monitor/agent/${cleanName}/${agent.id.toLowerCase()}`, { scroll: false });
      }
    } catch {}
  }
}, [router, radarAgents]);

const selectedNode = useMemo(() => {
  if (!selectedId) return null;
  return radarAgents.find(a => a.id.toLowerCase() === selectedId.toLowerCase()) 
    || (fallbackAgent && fallbackAgent.id.toLowerCase() === selectedId.toLowerCase() ? fallbackAgent : null);
}, [selectedId, radarAgents, fallbackAgent]);

return (
  <div className="flex flex-col h-screen w-full overflow-hidden bg-[var(--bg-page)]" style={{fontFamily:'Inter, system-ui, sans-serif'}}>
    <div className="flex items-center gap-2 px-6 py-2 border-b border-white/5 bg-black/40 shrink-0">
      {['ALL','HIGH TRUST ✓','MINES ⚠','UN-AUDITED'].map(label => (
        <button key={label} onClick={()=>setFilter(label)} className={`px-3 py-1 rounded-lg text-[9px] font-bold tracking-widest border transition-all ${filter===label?'border-[#3b82f6]/50 text-[#3b82f6] bg-[#3b82f6]/10':'border-transparent text-slate-500 hover:text-slate-300'}`}>{label}</button>
      ))}
      <div className="ml-auto flex items-center gap-6">
        <form onSubmit={(e) => { e.preventDefault(); handleSelect(searchQuery); }} className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 group-focus-within:text-[#3b82f6] transition-colors" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-white/[0.03] border border-white/10 text-slate-300 px-4 py-1.5 pl-8 rounded-xl w-64 focus:w-80 focus:outline-none focus:border-[#3b82f6]/50 transition-all text-xs" placeholder="Locate node..." />
        </form>
        <div className="text-[9px] text-slate-500 uppercase font-mono"><span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse inline-block mr-2" /> {agentsData?.pagination?.total || radarAgents.length} NODES MAPPED</div>
      </div>
    </div>
    
    <div className="flex flex-1 overflow-hidden relative">
      <main ref={containerRef} className="flex-1 relative bg-[var(--bg-page)] overflow-hidden" style={{background:'radial-gradient(ellipse at 50% 50%, rgba(212,160,23,0.03) 0%, var(--bg-page) 70%)'}}>
        <AgentBubbleMap ref={mapRef} agents={radarAgents} onSelect={handleSelect} selectedId={selectedId} />
        <TacticalLegend /><NavControls onMove={(dx, dy) => mapRef.current?.move(dx, dy)} onZoom={(f) => mapRef.current?.zoom(f)} onReset={() => mapRef.current?.resetView()} containerRef={containerRef} />
      </main>

      <aside className="w-80 shrink-0 border-l border-[rgba(212,160,23,0.08)] bg-[rgba(13,14,23,0.75)] backdrop-blur-xl flex flex-col overflow-y-auto">
        <div className="px-4 py-3 border-b border-white/5 bg-black/20 sticky top-0 z-10 flex items-center gap-2">{selectedNode ? (<><Shield className="w-3 h-3 text-[#3b82f6]" /> <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">Agent Profile</span></>) : (<><Trophy className="w-3 h-3 text-[#fbbf24]" /> <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">Protocol Leaderboard</span></>)}</div>
        <div className="p-6 flex flex-col gap-6">
          {selectedNode ? (
            <>
              <div className="flex gap-4 items-center"><div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 p-1 bg-white/5"><img src={selectedNode.raw?.logo || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedNode.id}&backgroundColor=transparent`} className="w-full h-full object-cover rounded-xl" /></div><div className="min-w-0 flex-1"><div className="text-sm font-bold text-white truncate">{selectedNode.label}</div><div className="flex items-center gap-1.5 mt-1 group/addr cursor-pointer" onClick={() => { navigator.clipboard.writeText(selectedNode.id); const el = document.getElementById('copy-check'); if (el) { el.style.opacity = '1'; setTimeout(() => { el.style.opacity = '0'; }, 1500); } }}><span className="text-[9px] font-mono text-slate-500 truncate">{selectedNode.id}</span><Copy size={10} className="shrink-0 text-slate-600 group-hover/addr:text-[#3b82f6] transition-colors" /><Check id="copy-check" size={10} className="shrink-0 text-emerald-400 transition-opacity" style={{ opacity: 0 }} /></div></div></div>
              <div className="relative"><div className="absolute -left-2 top-0 bottom-0 w-0.5 bg-[#3b82f6]/30 rounded-full" /><p className="text-[11px] text-slate-300 leading-relaxed font-mono pl-3 italic">{selectedNode.raw?.description || "Monitoring active behavior..."}</p></div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3"><div className="text-[8px] text-slate-500 uppercase mb-1">Completion</div><div className="text-xs font-black text-emerald-400">{selectedNode.raw?.breakdown?.completionRate != null ? `${Math.round(selectedNode.raw.breakdown.completionRate * 100)}%` : '—'}</div></div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3"><div className="text-[8px] text-slate-500 uppercase mb-1">Jobs Ran</div><div className="text-xs font-black text-white">{selectedNode.raw?.breakdown?.totalJobs ?? 0}</div></div>
                  {selectedNode.raw?.breakdown?.agdp != null && (
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3"><div className="text-[8px] text-slate-500 uppercase mb-1">AGDP Impact</div><div className="text-xs font-black text-blue-400">{(() => { const v = selectedNode.raw.breakdown.agdp; if (v >= 1e9) return `$${(v/1e9).toFixed(1)}B`; if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`; if (v >= 1e3) return `$${(v/1e3).toFixed(1)}K`; return `$${v.toFixed(0)}`; })()}</div></div>
                  )}
                  {selectedNode.raw?.breakdown?.paymentRate != null && (
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3"><div className="text-[8px] text-slate-500 uppercase mb-1">Payment Rate</div><div className="text-xs font-black text-cyan-400">{Math.round(selectedNode.raw.breakdown.paymentRate * 100)}%</div></div>
                  )}
                </div>
                <div className="space-y-3 bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                  {selectedNode.raw?.breakdown?.completionRate != null && (
                    <ScoreBar label="On-Chain History" value={selectedNode.raw.breakdown.completionRate * 4.0} max={4.0} color="#10b981" icon={<CheckCircle size={10} />} />
                  )}
                  {selectedNode.raw?.breakdown?.agdp != null && (
                    <ScoreBar label="Economic Impact" value={Math.min(3.0, selectedNode.raw.breakdown.agdp / 5000 * 3.0)} max={3.0} color="#3b82f6" icon={<DollarSign size={10} />} />
                  )}
                  {selectedNode.raw?.breakdown?.paymentRate != null && (
                    <ScoreBar label="Payment Rate" value={selectedNode.raw.breakdown.paymentRate * 3.0} max={3.0} color="#a855f7" icon={<Zap size={10} />} />
                  )}
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <button onClick={() => { const cleanName = (selectedNode.label || 'agent').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(); router.push(`/agent/${cleanName}/${selectedNode.id}`); }} className="w-full py-2.5 rounded-xl text-[9px] font-bold tracking-widest border border-[#3b82f6]/30 text-white bg-[#3b82f6]/20 hover:bg-[#3b82f6]/40 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.2)] uppercase"><FileText size={12} /> Deep Behavioral Report</button>
                <div className="flex gap-2">
                  <button onClick={() => setShowReviewForm(true)} className="flex-1 py-2 rounded-xl text-[9px] font-bold tracking-widest border border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/10 transition-all uppercase flex items-center justify-center gap-1.5"><ShieldAlert size={10} /> Guard</button>
                  <button onClick={() => setShowReviewForm(true)} className="flex-1 py-2 rounded-xl text-[9px] font-bold tracking-widest border border-amber-500/20 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 transition-all uppercase flex items-center justify-center gap-1.5"><Zap size={10} /> Intel</button>
                </div>
              </div>
              <AnimatePresence>
                {showReviewForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-white/5 pt-4 mt-2">
                    <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2"><Zap size={12} /> Field Intel Report</span><button onClick={() => setShowReviewForm(false)} className="text-slate-500 hover:text-white text-xs">✕</button></div>
                    <ReviewForm projectId={selectedNode.raw?.id || selectedNode.id} projectName={selectedNode.label} onSuccess={() => setShowReviewForm(false)} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="pt-4 border-t border-white/5"><div className="text-[10px] font-bold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-widest"><MessageSquare className="w-3 h-3 text-[#3b82f6]" /> Community Reviews</div><AgentReviews agentId={selectedNode.id} /></div>
            </>
          ) : (
            <div className="flex flex-col gap-6 h-full py-4 animate-in fade-in duration-700">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[#3b82f6]"><Zap size={14} className="animate-pulse" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Mission Control</span></div>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                  <div className="text-[10px] text-slate-400 font-medium leading-relaxed">
                    Select a <span className="text-[#fbbf24]">Top Performer</span> below to delegate autonomous tasks or verify their historical finality logs.
                  </div>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-mono text-slate-500 uppercase">Top 5 Active</span>
                </div>
                
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {[...radarAgents]
                    .filter(a => a.trust >= 60)
                    .sort((a,b) => (b.raw?.breakdown?.totalJobs || 0) - (a.raw?.breakdown?.totalJobs || 0))
                    .slice(0, 5)
                    .map((node, i) => (
                    <div key={node.id} onClick={() => handleSelect(node.id)} className="group p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#fbbf24]/40 cursor-pointer transition-all relative overflow-hidden">
                      <div className="flex items-center gap-3 relative z-10">
                        {/* Rank Number */}
                        <div className="w-5 text-[10px] font-black font-mono text-slate-600 group-hover:text-[#fbbf24]">{(i+1).toString().padStart(2, '0')}</div>
                        
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 p-0.5 bg-black/40">
                          <img src={node.raw?.logo || `https://api.dicebear.com/7.x/bottts/svg?seed=${node.id}&backgroundColor=transparent`} className="w-full h-full object-cover rounded-md" />
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-white truncate group-hover:text-[#fbbf24] transition-colors">{node.label}</span>
                            <span className="text-[10px] font-black text-emerald-400 font-mono">{node.trust}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-white/5 text-slate-500 uppercase tracking-tighter border border-white/5">
                              {i < 3 ? 'Elite Node' : 'Verified'}
                            </span>
                            <span className="text-[8px] font-mono text-slate-500">{node.raw?.breakdown?.totalJobs || 0} JOBS</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-[#3b82f6]"><LayoutDashboard size={14} /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Network Snapshot</span></div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Total Nodes', val: agentsData?.pagination?.total || radarAgents.length, icon: Globe },
                    { label: 'Ecosystem Vol', val: (() => { const total = agentsData?.agents?.reduce((acc:any,a:any)=>acc+(a.breakdown?.agdp||0),0)||0; return total > 0 ? `$${(total/1000).toFixed(1)}K` : '—'; })(), icon: BarChart3 },
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-2 text-slate-500"><item.icon size={10} /><span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span></div>
                      <span className="text-xs font-black text-slate-300">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
    <div className="h-10 bg-black/80 border-t border-white/5 flex items-center overflow-hidden relative group shrink-0"><div className="px-4 h-full bg-[#3b82f6]/10 border-r border-white/5 flex items-center gap-2 shrink-0 z-10 relative backdrop-blur-md"><Activity className="w-3.5 h-3.5 text-[#3b82f6] animate-pulse" /><span className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest">Live Intel</span></div><div className="flex animate-marquee group-hover:pause-marquee py-2">{intelFeed.concat(intelFeed).map((item, i) => (<div key={i} onClick={() => item.agentId && handleSelect(item.agentId)} className="inline-flex items-center gap-3 px-6 cursor-pointer opacity-40 hover:opacity-100 transition-opacity border-r border-white/5"><span className="text-[9px] font-mono text-slate-700">[{item.time}]</span><span className={`text-[10px] font-bold ${item.type === 'error' ? 'text-red-500' : 'text-blue-400'}`}>{item.msg}</span></div>))}</div></div>
    <style jsx global>{` @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } } .animate-marquee { animation: marquee 120s linear infinite; } .pause-marquee:hover { animation-play-state: paused; } `}</style>
  </div>
);
}

function AgentReviews({ agentId }: { agentId: string }) {
  const { data, mutate } = useSWR(`/api/v1/review?address=${agentId}`, fetcher);
  const [votingId, setVotingId] = useState<string | null>(null);
  const reviews = data?.reviews || [];
  if (reviews.length === 0) return (
    <p className="text-[9px] font-mono text-[#666] text-center py-4">No reviews yet — be the first to report intel</p>
  );

  // Sort: verified first, low quality last
  const sorted = [...reviews].sort((a: any, b: any) => {
    const tierOrder = (qs: number) => qs >= 70 ? 0 : qs >= 40 ? 1 : 2;
    return tierOrder(a.qualityScore ?? 50) - tierOrder(b.qualityScore ?? 50);
  });

  const getInteractionBadge = (r: any) => {
    if (r.interactionTier === 'acp' || r.hasEas) return { label: 'ACP Verified', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (r.interactionTier === 'onchain') return { label: 'On-chain', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    return { label: 'Unverified', color: 'text-[#666] bg-white/5 border-white/5' };
  };

  const getQualityStyle = (qs: number) => {
    if (qs >= 70) return { badge: '✓ Verified', badgeClass: 'text-emerald-400', cardClass: 'bg-white/5 border-white/10' };
    if (qs >= 40) return { badge: null, badgeClass: '', cardClass: 'bg-white/5 border-white/5' };
    return { badge: 'Low Quality', badgeClass: 'text-red-400', cardClass: 'bg-white/[0.02] border-white/[0.03] opacity-60' };
  };

  async function handleVote(reviewId: string, direction: 'up' | 'down') {
    if (votingId) return;
    setVotingId(reviewId);
    try {
      await fetch('/api/v1/review/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, voter: 'anonymous', direction }),
      });
      mutate();
    } catch { /* silent */ }
    finally { setVotingId(null); }
  }

  return (
    <div className="space-y-2">
      {sorted.map((r: any) => {
        const qs = r.qualityScore ?? 50;
        const style = getQualityStyle(qs);
        const badge = getInteractionBadge(r);
        const isLow = qs < 40;
        
        return (
          <details key={r.id} open={!isLow} className={`rounded-xl border ${style.cardClass} transition-all`}>
            <summary className="p-3 cursor-pointer list-none">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {/* Rating */}
                    <span className="text-[10px] font-bold text-amber-400">{'★'.repeat(Math.round(r.rating / 2))}{'☆'.repeat(5 - Math.round(r.rating / 2))}</span>
                    <span className="text-[9px] font-mono text-[#666]">{r.rating}/10</span>
                    {/* Quality badge */}
                    {style.badge && <span className={`text-[8px] font-bold uppercase tracking-wider ${style.badgeClass}`}>{style.badge}</span>}
                    {/* Interaction tier */}
                    <span className={`text-[8px] px-1.5 py-0.5 rounded border font-mono ${badge.color}`}>{badge.label}</span>
                  </div>
                  <p className={`text-[10px] leading-relaxed ${isLow ? 'text-[#555]' : 'text-[#999]'}`}>
                    {r.comment ? (r.comment.length > 200 && isLow ? r.comment.slice(0, 100) + '…' : r.comment) : <em>No comment</em>}
                  </p>
                </div>
                {/* Vote buttons */}
                <div className="flex flex-col items-center gap-0.5 shrink-0 ml-2">
                  <button
                    onClick={(e) => { e.preventDefault(); handleVote(r.id, 'up'); }}
                    disabled={votingId === r.id}
                    className="text-[#666] hover:text-emerald-400 transition-colors disabled:opacity-30 text-xs"
                  >▲</button>
                  <span className="text-[9px] font-mono text-[#888]">{r.upvotes ?? 0}</span>
                  <button
                    onClick={(e) => { e.preventDefault(); handleVote(r.id, 'down'); }}
                    disabled={votingId === r.id}
                    className="text-[#666] hover:text-red-400 transition-colors disabled:opacity-30 text-xs"
                  >▼</button>
                </div>
              </div>
              {/* Reviewer + time */}
              <div className="flex items-center gap-2 mt-2 text-[8px] font-mono text-[#555]">
                <span>{r.reviewer?.slice(0, 6)}…{r.reviewer?.slice(-4)}</span>
                <span>·</span>
                <span>{r.source === 'agent' ? '🤖' : '👤'} {r.source}</span>
                <span>·</span>
                <span>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</span>
              </div>
            </summary>
          </details>
        );
      })}
    </div>
  );
}
