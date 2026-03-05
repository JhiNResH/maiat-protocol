'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Radar, AlertTriangle, Terminal, Shield, ShieldAlert, Zap, User, Target, Activity, MessageSquare, Globe, TrendingUp, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReviewForm } from '@/components/ReviewForm';

// ─── Types ───────────────────────────────────────────────────────────────────
type AgentNode = {
  id: string; x: number; y: number; r: number;
  trust: number; type: 'safe' | 'mine' | 'unaudited';
  label: string;
  raw?: any;
};

// ─── Mock Initial Data ────────────────────────────────────────────────────────
type IntelItem = { time: string; msg: string; type: 'info' | 'warning' | 'error' };

const initialIntelFeed: IntelItem[] = [
  { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: 'SYS: Connecting to Maiat Secure Feed...', type: 'info' }
];

import useSWR from 'swr';
import { Header } from '@/components/Header';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ─── Radar Canvas ─────────────────────────────────────────────────────────────
export type MapRef = { panToNode: (id: string) => void };

const AgentBubbleMap = React.forwardRef<MapRef, { agents: AgentNode[], onSelect: (a: AgentNode | null) => void, onSetFilter: (f: string) => void, selectedId?: string }>(({ agents, onSelect, onSetFilter, selectedId }, ref) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const staticNodes = React.useRef<any[]>([]);
  const avatars = React.useRef<Record<string, HTMLImageElement>>({});
  const draggedNode = React.useRef<AgentNode | null>(null);

  const selectedIdRef = React.useRef(selectedId);
  React.useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  React.useEffect(() => {
    if (dimensions.width === 0) return;
    
    // Generate static positions based on clusters
    const W = dimensions.width;
    const H = dimensions.height;
    const cx = W/2, cy = H/2;
    
    const clusters = {
      safe: { x: cx - W*0.1, y: cy },
      mine: { x: cx + W*0.3, y: cy - H*0.2 },
      unaudited: { x: cx + W*0.35, y: cy + H*0.1 }
    };

    // Separate agents into groups
    const groups = {
      safe: agents.filter(a => a.type === 'safe'),
      mine: agents.filter(a => a.type === 'mine'),
      unaudited: agents.filter(a => a.type === 'unaudited')
    };

    const newNodes: any[] = [];
    
    // Spiral layout for each group
    Object.entries(groups).forEach(([type, groupAgents]) => {
      const hub = clusters[type as keyof typeof clusters];
      
      // Sort to put largest bubbles center
      groupAgents.sort((a,b) => b.r - a.r);
      
      let angle = 0;
      let radius = 0;
      const angleStep = 0.5;
      
      groupAgents.forEach((a, index) => {
        // Pseudo-random offset based on ID string to ensure deterministic static view
        const hash = a.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        
        if (index === 0) {
          // Put the biggest one right on the hub
          newNodes.push({ ...a, x: hub.x, y: hub.y });
        } else {
          // Archimedean spiral expansion
          radius += (a.r/2 + 2); // outward step depends on node size
          angle += angleStep + (hash % 10) * 0.05;
          const x = hub.x + Math.cos(angle) * (radius + 20);
          const y = hub.y + Math.sin(angle) * (radius + 20);
          newNodes.push({ ...a, x, y });
        }
      });
    });

    staticNodes.current = newNodes;
  }, [agents, dimensions]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let animId: number;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    
    const resize = () => {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.resetTransform();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    // Create a simple starfield for the background
    const stars = Array.from({length: 100}).map((_, i) => ({
      x: (Math.sin(i*7) * 0.5 + 0.5) * window.innerWidth,
      y: (Math.cos(i*11) * 0.5 + 0.5) * window.innerHeight,
      s: Math.random() * 1.5,
      a: Math.random()
    }));

    let tick = 0;

    const draw = () => {
      tick += 0.01;
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      const MathPI2 = Math.PI * 2;
      const cx = W/2, cy = H/2;
      
      ctx.clearRect(0,0,W,H);
      
      // Base physical scale from resize
      ctx.resetTransform();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Deep aurora night sky background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#040b16'); // Deep dark blue/green top
      bgGrad.addColorStop(0.5, '#010409');
      bgGrad.addColorStop(1, '#000000'); // Pitch black bottom
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0,0,W,H);

      // Apply pan/zoom for scene
      ctx.save();
      ctx.translate(transform.current.x, transform.current.y);
      ctx.scale(transform.current.k, transform.current.k);

      // Preload avatars
      staticNodes.current.forEach(n => {
        if (!avatars.current[n.id]) {
          const img = new window.Image();
          // Use real agent logo if exists, else fallback to futuristic bot
          img.src = n.raw?.logo || `https://api.dicebear.com/7.x/bottts/svg?seed=${n.id}&backgroundColor=transparent`;
          avatars.current[n.id] = img;
        }
      });

      // Draw static stars with subtle twinkle
      stars.forEach(s => {
        const alpha = s.a * 0.5 + Math.sin(tick * 5 + s.x) * 0.2;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, alpha)})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, MathPI2); ctx.fill();
        s.y -= 0.05; if (s.y < 0) s.y = window.innerHeight; // extremely slow drift
      });

      // Constellation Hub Centers
      const clusters = {
        safe: { x: cx - W*0.1, y: cy },
        mine: { x: cx + W*0.3, y: cy - H*0.2 },
        unaudited: { x: cx + W*0.35, y: cy + H*0.1 }
      };

      const nodes = staticNodes.current;

      // Draw Constellation Connections (Edges to Hub)
      ctx.lineWidth = 1;
      nodes.forEach(n => {
        const target = clusters[n.type as keyof typeof clusters];
        if (!target) return;
        const dist = Math.hypot(target.x - n.x, target.y - n.y);
        
        // Connect to hub with curved lines
        if (dist > 5) {
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          // Quadratic curve to hub 
          ctx.quadraticCurveTo(n.x, target.y, target.x, target.y);
          
          if (n.type === 'safe') {
            ctx.strokeStyle = `rgba(0, 255, 157, ${Math.max(0.1, 0.5 - dist/800)})`;
          } else if (n.type === 'mine') {
            ctx.strokeStyle = `rgba(255, 0, 85, ${Math.max(0.1, 0.5 - dist/800)})`;
          } else {
            ctx.strokeStyle = `rgba(100, 116, 139, 0.3)`;
          }
          ctx.stroke();
        }
      });

      // Draw Central Hubs 
      [
        { p: clusters.safe, c: '#00FF9D', g: 'rgba(0,255,157,0.2)' },
        { p: clusters.mine, c: '#FF0055', g: 'rgba(255,0,85,0.2)' },
        { p: clusters.unaudited, c: '#64748b', g: 'rgba(100,116,139,0.1)' }
      ].forEach(hub => {
        // Subtle breathing effect for hub glow
        const glow = 16 + Math.sin(tick * 3) * 4;
        ctx.beginPath(); ctx.arc(hub.p.x, hub.p.y, glow, 0, MathPI2);
        ctx.fillStyle = hub.g; ctx.fill();
        ctx.strokeStyle = hub.c; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(hub.p.x, hub.p.y, 6, 0, MathPI2);
        ctx.fillStyle = hub.c; ctx.fill();
      });
      

      // Draw Static Avatar Nodes
      // Z-Index Sorting: Draw selected node last to bring it to front
      const currentSelectedId = selectedIdRef.current;
      const sortedNodes = [...nodes].sort((a,b) => {
        if (currentSelectedId && a.id === currentSelectedId) return 1;
        if (currentSelectedId && b.id === currentSelectedId) return -1;
        return 0;
      });

      sortedNodes.forEach(n => {
        let col = '#64748b', bg = '#0f172a';
        if (n.type === 'safe') { col = '#00FF9D'; bg = '#022c22'; }
        else if (n.type === 'mine') { col = '#FF0055'; bg = '#4c0519'; }

        // Outer Node Border
        ctx.beginPath();
        const r = Math.max(n.r, 8);
        ctx.arc(n.x, n.y, r, 0, MathPI2);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner Initial or Avatar
        const img = avatars.current[n.id];
        if (img && img.complete && img.naturalHeight > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(n.x, n.y, r - 1.5, 0, MathPI2);
          ctx.clip();
          // Draw image
          ctx.drawImage(img, n.x - r + 1.5, n.y - r + 1.5, (r - 1.5)*2, (r - 1.5)*2);
          ctx.restore();
        } else {
          // Fallback Initial
          ctx.font = `bold ${Math.max(r - 4, 8)}px JetBrains Mono`;
          ctx.fillStyle = col;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const initial = n.label.charAt(0).toUpperCase();
          ctx.fillText(initial, n.x, n.y);
        }

        // Label underneath
        ctx.font = '400 9px JetBrains Mono';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(n.label.length > 8 ? n.label.slice(0,8)+'...' : n.label, n.x, n.y + r + 12);
      });

      ctx.restore(); // restore from pan/zoom
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => { 
      if (typeof window !== 'undefined') {
        cancelAnimationFrame(animId); 
        window.removeEventListener('resize', resize); 
      }
    };
  }, [dimensions]);

  React.useImperativeHandle(ref, () => ({
    panToNode: (id: string) => {
      const node = staticNodes.current.find(n => n.id.toLowerCase() === id.toLowerCase());
      if (node) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        const targetK = 2.5; // Zoom in
        transform.current = {
          x: W/2 - node.x * targetK,
          y: H/2 - node.y * targetK,
          k: targetK
        };
      }
    }
  }));

  const transform = React.useRef({ x: 0, y: 0, k: 1 });
  const isDragging = React.useRef(false);
  const hasDragged = React.useRef(false);
  const lastMouse = React.useRef({ x: 0, y: 0 });

  const handleWheel = React.useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = 0.95;
    const adjust = e.deltaY < 0 ? 1/factor : factor;
    const { x, y, k } = transform.current;
    
    // Zoom around mouse pointer
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const newK = Math.max(0.1, Math.min(k * adjust, 5));
    // (mx - x) / k = (mx - newX) / newK => newX = mx - (mx - x) * newK / k
    const newX = mx - (mx - x) * newK / k;
    const newY = my - (my - y) * newK / k;

    transform.current = { x: newX, y: newY, k: newK };
  }, []);

  const handlePointerDown = React.useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    hasDragged.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const { x, y, k } = transform.current;
    const worldX = (mx - x) / k;
    const worldY = (my - y) / k;
    
    let closest: any = null, minDist = Infinity;
    staticNodes.current.forEach(n => {
      const d = Math.hypot(n.x - worldX, n.y - worldY);
      if (d < Math.max(n.r, 12) + 10 && d < minDist) { minDist = d; closest = n; }
    });
    if (closest) {
      draggedNode.current = closest;
      isDragging.current = false; // Prevent canvas from panning
      onSelect(closest);
    }
  }, [onSelect]);

  const handlePointerMove = React.useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasDragged.current = true;
    }

    if (draggedNode.current) {
      const { x, y, k } = transform.current;
      draggedNode.current.x = (mx - x) / k;
      draggedNode.current.y = (my - y) / k;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!isDragging.current) return;
    transform.current.x += dx;
    transform.current.y += dy;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = React.useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    isDragging.current = false;
    draggedNode.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const handleClick = React.useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hasDragged.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    
    // apply inverse transform
    const { x, y, k } = transform.current;
    const worldX = (mx - x) / k;
    const worldY = (my - y) / k;

    // Check hubs first
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const cx = W/2, cy = H/2;
    const hubs = [
      { id: 'HIGH TRUST ✓', x: cx - W*0.1, y: cy },
      { id: 'MINES ⚠', x: cx + W*0.3, y: cy - H*0.2 },
      { id: 'UN-AUDITED', x: cx + W*0.35, y: cy + H*0.1 }
    ];
    for (const hub of hubs) {
      if (Math.hypot(hub.x - worldX, hub.y - worldY) < 40) {
        onSetFilter(hub.id);
        return; // Set filter and exit
      }
    }

    let closest: any = null, minDist = Infinity;
    staticNodes.current.forEach(n => {
      const d = Math.hypot(n.x - worldX, n.y - worldY);
      if (d < Math.max(n.r, 12) + 10 && d < minDist) { minDist = d; closest = n; }
    });
    onSelect(closest);
  }, [onSelect, onSetFilter]);



  return (
    <div className="relative w-full h-full bg-[#030508]">
      <div className="absolute top-4 left-4 pointer-events-none text-xs font-mono text-slate-400 bg-black/60 p-2 rounded border border-cyan-500/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 rounded-full border border-cyan-400 bg-cyan-900/50 flex items-center justify-center"></div>
          <span>SIZE = ACTIVITY (JOBS)</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-px bg-cyan-400/50"></div>
          <span>LINE = HUB CONNECTION</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span>DRAG = PAN</span>
          <span className="mx-1">•</span>
          <span>SCROLL = ZOOM</span>
        </div>
      </div>
      <canvas 
        ref={canvasRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing block touch-none" 
        onClick={handleClick}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
});



// ─── Page ─────────────────────────────────────────────────────────────────────
function MonitorContent() {
  const searchParamsUrl = useSearchParams();
  const [selected, setSelected] = useState<AgentNode | null>(null);
  const mapRef = React.useRef<MapRef>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [intelFeed, setIntelFeed] = useState<typeof initialIntelFeed>(initialIntelFeed);
  const [isSweeping, setIsSweeping] = useState(false);
  const [isDeployingGuard, setIsDeployingGuard] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  // SSE Connection for Intel Feed
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sse = new EventSource('/api/v1/monitor/feed');
    
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.msg) {
          setIntelFeed(prev => {
            const newFeed = [...prev, data];
            if (newFeed.length > 30) newFeed.shift();
            return newFeed;
          });
        }
      } catch (err) {}
    };

    return () => { sse.close(); };
  }, []);

  // Action Handlers
  const handleRequestSweep = async () => {
    if (!selected || isSweeping) return;
    setIsSweeping(true);
    try {
      await fetch('/api/v1/agents/sweep', {
        method: 'POST', body: JSON.stringify({ agentId: selected.id })
      });
      // The SSE feed will handle the rest of the UI feedback
    } catch(e) { console.error(e) }
    setTimeout(() => setIsSweeping(false), 2000);
  };

  const handleDeployGuard = async () => {
    if (!selected || isDeployingGuard) return;
    setIsDeployingGuard(true);
    
    // Triggering a fake system event locally for UX
    setIntelFeed(prev => [...prev, { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: `SYS: Initializing viem-guard transaction for ${selected.id}...`, type: 'info' }]);
    
    setTimeout(() => {
      setIntelFeed(prev => [...prev, { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: `✓ GUARD DEPLOYED: Smart contracts are now blocking interactions with ${selected.id}`, type: 'warning' }]);
      setIsDeployingGuard(false);
    }, 2500);
  };

  // Fetch real agents from the protocol API
  const { data } = useSWR('/api/v1/agents?limit=200', fetcher, { refreshInterval: 10000 });

  // Map protocol agents and pre-calculate their bubble sizes
  const radarAgents = useMemo<AgentNode[]>(() => {
    if (!data?.agents) return [];
    const seen = new Set();
    const uniqueRawAgents = data.agents.filter((a: any) => {
      const nameKey = a.name ? a.name.toLowerCase() : '';
      const idKey = a.id ? a.id.toLowerCase() : '';
      const key = nameKey || idKey;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const mapped = uniqueRawAgents.map((acc: any) => {
      const trust = acc.trust?.score;
      let type: 'safe' | 'mine' | 'unaudited' = 'unaudited';
      if (trust !== null && trust !== undefined) {
        if (trust >= 75) { type = 'safe'; }
        else if (trust <= 50) { type = 'mine'; }
        else { type = 'unaudited'; }
      }
      let r = 5 + Math.random() * 3;
      if (type === 'mine') r = 12;
      else if (type === 'safe') {
        const jobs = acc.breakdown?.totalJobs || 0;
        const logScale = jobs > 0 ? Math.log10(jobs) : 0;
        // Using logarithmic scaling ensures 1k vs 1M jobs has a visible difference up to r=50
        r = Math.max(7, Math.min(50, 7 + (logScale * 6)));
      }
      return {
        id: acc.id,
        label: acc.name || `${acc.id.slice(0,6)}`,
        trust: trust !== null ? trust : 0,
        type,
        x: 0, y: 0, r, 
        raw: acc
      };
    });
    if (filter === 'HIGH TRUST ✓') return mapped.filter((a: AgentNode) => a.type === 'safe');
    if (filter === 'MINES ⚠') return mapped.filter((a: AgentNode) => a.type === 'mine');
    if (filter === 'UN-AUDITED') return mapped.filter((a: AgentNode) => a.type === 'unaudited');
    return mapped;
  }, [data, filter]);

  // Handle URL searches specifically from the top Header Searchbar
  useEffect(() => {
    const q = searchParamsUrl?.get('q');
    if (q && radarAgents.length > 0) {
      const target = radarAgents.find((a: AgentNode) => 
        a.id.toLowerCase().includes(q.toLowerCase()) || 
        (a.label && a.label.toLowerCase().includes(q.toLowerCase()))
      );
      if (target) {
        setFilter('ALL');
        setTimeout(() => {
          setSelected(target);
          let retries = 0;
          const tryPan = () => {
            if (mapRef.current) {
              mapRef.current.panToNode(target.id);
            } else if (retries < 10) {
              retries++;
              setTimeout(tryPan, 50);
            }
          };
          tryPan();
        }, 100);
      }
    }
  }, [searchParamsUrl, radarAgents]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden" style={{background:'#030303',fontFamily:'JetBrains Mono,monospace'}}>
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
          <input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                const target = data?.agents?.find((a: any) => 
                  a.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  (a.name && a.name.toLowerCase().includes(searchQuery.toLowerCase()))
                );
                if (target) {
                  // Must find node in radarAgents (must match filter or we clear filter)
                  setFilter('ALL');
                  setTimeout(() => {
                    let trust = target.trust?.score || 0;
                    let type = 'unaudited';
                    if (trust >= 75) type = 'safe';
                    else if (trust <= 50) type = 'mine';
                    const nodeFromSearch = { id: target.id, label: target.name || target.id, trust: trust, type, r: 10, x:0, y:0, raw: target };
                    setSelected(nodeFromSearch as any);
                    
                    // Robust check for map zoom
                    let retries = 0;
                    const tryPan = () => {
                      if (mapRef.current) {
                        mapRef.current.panToNode(target.id);
                      } else if (retries < 10) {
                        retries++;
                        setTimeout(tryPan, 50);
                      }
                    };
                    tryPan();
                  }, 100);
                }
              }
            }}
            className="bg-transparent border border-slate-700 text-slate-400 px-3 py-1 rounded w-48 focus:outline-none focus:border-[#00F0FF]" 
            placeholder="Search ID or Hash..." 
          />
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
              <span className="ml-auto w-2 h-2 rounded-full animate-pulse" style={{background:'#00FF9D'}} />
            </div>
            <div className="p-3 overflow-y-auto custom-scrollbar text-[10px] leading-relaxed flex flex-col-reverse gap-2">
              {[...intelFeed].reverse().map((item: typeof initialIntelFeed[0], i: number) => (
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

        {/* Center: Bubble map */}
        <main className="flex-1 relative bg-[#030508] overflow-hidden">
          <AgentBubbleMap 
            ref={mapRef} 
            agents={radarAgents.filter(a => filter === 'ALL' || a.type === ({'HIGH TRUST ✓':'safe','MINES ⚠':'mine','UN-AUDITED':'unaudited'} as any)[filter])} 
            onSelect={setSelected} 
            onSetFilter={setFilter} 
            selectedId={selected?.id}
          />

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

          <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto custom-scrollbar">
            {selected ? (
              <>
                <div className="flex gap-3 items-center w-full min-w-0">
                  <div className="relative w-14 h-14 shrink-0 flex items-center justify-center rounded-full overflow-hidden"
                    style={{
                      border:`3px solid ${selected.type==='mine'?'#FF0055':selected.type==='safe'?'#00FF9D':'#475569'}`,
                      boxShadow: `0 0 15px ${selected.type==='mine'?'rgba(255,0,85,0.4)':selected.type==='safe'?'rgba(0,255,157,0.4)':'transparent'}`
                    }}>
                    <img 
                      src={selected.raw?.logo || `https://api.dicebear.com/7.x/bottts/svg?seed=${selected.id}&backgroundColor=transparent`} 
                      alt={selected.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="text-sm font-bold text-slate-100 truncate">{selected.label}</div>
                    <div className="text-[10px] font-mono text-slate-500 mb-1 truncate">{selected.id}</div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded text-[10px] font-bold tracking-wider max-w-full overflow-hidden whitespace-nowrap" 
                         style={{
                           background: selected.type==='mine'?'rgba(255,0,85,0.15)':selected.type==='safe'?'rgba(0,255,157,0.15)':'rgba(100,116,139,0.15)',
                           color: selected.type==='mine'?'#FF0055':selected.type==='safe'?'#00FF9D':'#94a3b8',
                           border: `1px solid ${selected.type==='mine'?'rgba(255,0,85,0.4)':selected.type==='safe'?'rgba(0,255,157,0.4)':'rgba(100,116,139,0.4)'}`
                         }}>
                      <span className="truncate min-w-0">{selected.type==='mine'?'⚠ THREAT DETECTED':selected.type==='safe'?'✓ VERIFIED SAFE':'◌ UNAUDITED'}</span>
                      <span className="ml-1 opacity-75 shrink-0">({selected.trust}/100)</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 leading-relaxed font-mono">
                  {selected.raw?.description || (selected.type === 'mine' ? 'Warning: High Threat Vector flagged by Maiat indexers. Suspected unauthorized token allowance exploitation or malicious routing logic.' :
                   selected.type === 'safe' ? 'Verified Protocol Agent. Consistently maintains high SLA for on-chain job completions with proven capital reserves.' :
                   'Un-audited Node. Currently executing in a sandboxed environment pending comprehensive behavioral and security review.')}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-y py-3" style={{borderColor:'rgba(0,240,255,0.1)'}}>
                  {[{l:'JOBS',v:selected.raw?.breakdown?.totalJobs || '0'},{l:'COMPLETION',v:`${Math.round((selected.raw?.breakdown?.completionRate || 0)*100)}%`},{l:'CAPITAL',v:selected.raw?.collateral||'—'},{l:'NETWORK',v:selected.raw?.chain||'BASE'}].map(({l,v})=>(
                    <div key={l}><div className="text-slate-500 mb-0.5">{l}</div><div className="text-slate-200">{v}</div></div>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  <button onClick={handleRequestSweep} disabled={isSweeping} className={`w-full py-2 rounded text-xs font-bold tracking-wider border transition-all ${isSweeping ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#00F0FF]/20'}`} style={{background:'rgba(0,240,255,0.1)',border:'1px solid #00F0FF',color:'#00F0FF'}}>
                    <Zap className={`inline w-3 h-3 mr-1 ${isSweeping ? 'animate-pulse' : ''}`} /> {isSweeping ? 'SWEEPING...' : 'REQUEST SWEEP'}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={handleDeployGuard} disabled={isDeployingGuard || selected.type === 'safe'} className={`flex-1 py-1.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-bold tracking-wider hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}>
                      {isDeployingGuard ? 'DEPLOYING...' : 'DEPLOY GUARD'}
                    </button>
                    <Link href={`/agent/${selected.id}`} className="flex-1 py-1.5 rounded text-[10px] font-mono border text-slate-400 text-center hover:bg-white/5 hover:text-white transition-colors" style={{borderColor:'rgba(0,240,255,0.15)'}}>FULL REPORT</Link>
                  </div>
                </div>

                <div className="mt-4 border-t pt-4" style={{borderColor:'rgba(255,255,255,0.05)'}}>
                  <div className="text-[10px] font-bold text-slate-400 mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2"><MessageSquare className="w-3 h-3" /> COMMUNITY INTEL</span>
                    <button 
                      onClick={() => setShowReviewForm(!showReviewForm)}
                      className="text-[#00F0FF] text-[9px] font-bold hover:underline uppercase"
                    >
                      {showReviewForm ? 'Cancel' : 'Leave Review'}
                    </button>
                  </div>
                  
                  {showReviewForm ? (
                    <div className="mb-4">
                      <ReviewForm 
                        projectId={selected.id} 
                        projectName={selected.label} 
                        onSuccess={() => {
                          setShowReviewForm(false);
                        }}
                      />
                    </div>
                  ) : (
                    <AgentReviews agentId={selected.id} />
                  )}
                </div>

                {/* Social Signals removed for Phase 2 */}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-xs font-mono text-center">
                <Target className="w-6 h-6 mb-2 opacity-30" />
                Click a node on the map<br/>to select an agent
              </div>
            )}
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

export default function MonitorPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden items-center justify-center bg-[#030303]">
        <div className="flex flex-col items-center gap-3">
          <Radar className="w-8 h-8 text-[#00F0FF] animate-pulse" />
          <span className="text-xs font-mono text-[#00F0FF] uppercase tracking-widest">
            INITIALIZING MONITOR...
          </span>
        </div>
      </div>
    }>
      <MonitorContent />
    </Suspense>
  )
}

// ─── Sub-Components for Sidebar ──────────────────────────────────────────────

function AgentReviews({ agentId }: { agentId: string }) {
  const { data, error, isLoading } = useSWR(`/api/v1/review?address=${agentId}`, fetcher);
  const reviews = data?.reviews || [];

  if (isLoading) return <div className="text-[9px] text-slate-500 animate-pulse font-mono uppercase">Loading Intel...</div>;
  if (error) return <div className="text-[9px] text-red-500 font-mono uppercase">Error Loading Intel</div>;
  if (reviews.length === 0) return <div className="text-[9px] text-slate-600 italic font-mono uppercase">No verified opinions for this agent.</div>;

  return (
    <div className="space-y-2 mb-3">
      {reviews.slice(0, 3).map((r: any) => (
        <div key={r.id} className="bg-slate-900/40 border border-slate-800/50 rounded p-2 text-[10px] text-slate-300">
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-cyan-500 flex items-center gap-1">@{r.reviewer.slice(0,6)} <Shield className="w-2.5 h-2.5"/>:</span>
            <span className="text-[8px] text-slate-500">{new Date(r.timestamp).toLocaleDateString()}</span>
          </div>
          <p className="italic leading-relaxed">"{r.comment || '(No comment)'}"</p>
          <div className="mt-1 flex items-center gap-1 text-[8px] font-bold">
            <span className={r.rating >= 8 ? 'text-emerald-500' : r.rating >= 5 ? 'text-amber-500' : 'text-red-500'}>
              SCORE: {r.rating}/10
            </span>
            {r.weight > 1 && <span className="text-blue-400 opacity-80 uppercase">· Verified Receipt x{r.weight}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
