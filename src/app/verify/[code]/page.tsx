'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { CheckCircle, Copy, ExternalLink, Shield, Twitter, Users } from 'lucide-react';
import { motion } from 'motion/react';

interface AgentInfo {
  address: string;
  name: string | null;
  twitterHandle: string | null;
  totalEndorsements: number;
  trustBoost: number;
  code: string;
  createdAt: string;
}

interface KyaResponse {
  agent: AgentInfo;
  endorsements: Array<{
    id: string;
    endorserAddress: string;
    tweetUrl: string;
    status: string;
    createdAt: string;
  }>;
  tweetTemplate: string;
}

type PageState = 'loading' | 'ready' | 'success' | 'error';

export default function VerifyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = params?.code as string;
  const referrer = searchParams?.get('ref') ?? null;

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [kya, setKya] = useState<KyaResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Endorsement form state
  const [endorserAddress, setEndorserAddress] = useState('');
  const [tweetUrl, setTweetUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState(false);

  // Load agent info
  const loadAgent = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/v1/kya/${code}`);
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error ?? 'Agent not found');
        setPageState('error');
        return;
      }
      const data: KyaResponse = await res.json();
      setKya(data);
      setPageState('ready');
    } catch {
      setErrorMsg('Failed to load agent info');
      setPageState('error');
    }
  }, [code]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  // Build tweet text, substituting referrer ENS
  const buildTweetText = () => {
    if (!kya) return '';
    const agentLabel = kya.agent.twitterHandle
      ? `@${kya.agent.twitterHandle}`
      : kya.agent.name ?? kya.agent.address.slice(0, 8);
    const ref = endorserAddress || referrer || 'yourENS';
    return `I trust ${agentLabel} 🛡️ #MaiatVerified ${code}\npassport.maiat.io/verify/${code}?ref=${ref}`;
  };

  const handleCopyTweet = async () => {
    const text = buildTweetText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenTwitter = () => {
    const text = encodeURIComponent(buildTweetText());
    window.open(`https://x.com/intent/tweet?text=${text}`, '_blank');
  };

  const handleEndorse = async () => {
    setFormError('');

    if (!endorserAddress || !/^0x[a-fA-F0-9]{40}$/i.test(endorserAddress)) {
      setFormError('Enter a valid wallet address (0x...)');
      return;
    }
    if (!tweetUrl || !/^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/.test(tweetUrl)) {
      setFormError('Paste a valid Twitter/X tweet URL');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/kya/endorse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          endorserAddress,
          tweetUrl,
          referrer: referrer ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? 'Endorsement failed');
        return;
      }

      setPageState('success');
    } catch {
      setFormError('Network error, please try again');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Design tokens (aligned with passport.maiat.io) ───────────────
  const bg = isDark ? 'bg-[#0A0A0A]' : 'bg-[#FDFDFB]';
  const text = isDark ? 'text-white' : 'text-black';
  const card = isDark
    ? 'bg-white/[0.03] border-white/[0.06] shadow-[inset_0_0_30px_rgba(255,255,255,0.01)]'
    : 'bg-white/60 border-black/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.04)]';
  const btnPrimary = isDark
    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-400 hover:to-purple-400 shadow-lg shadow-blue-500/20'
    : 'bg-black text-white hover:bg-black/90';
  const btnSecondary = isDark
    ? 'bg-white/[0.06] text-white/80 hover:bg-white/[0.1] border border-white/[0.08] backdrop-blur-sm'
    : 'bg-black/5 text-black hover:bg-black/10 border border-black/10';
  const inputClass = isDark
    ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-white/25 focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20'
    : 'bg-white border-black/10 text-black placeholder-black/30 focus:border-black/30';
  const subtle = isDark ? 'text-white/40' : 'text-gray-400';

  // ── Loading ───────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className={`min-h-screen ${bg} ${text} flex items-center justify-center relative overflow-hidden`}>
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none ${isDark ? 'bg-blue-900/20' : 'bg-blue-100/30'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] pointer-events-none ${isDark ? 'bg-purple-900/10' : 'bg-orange-50/40'}`} />
        <div className="animate-pulse text-center relative z-10">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className={subtle}>Loading agent info…</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <div className={`min-h-screen ${bg} ${text} flex items-center justify-center`}>
        <div className={`border rounded-2xl p-8 max-w-sm w-full mx-4 text-center ${card}`}>
          <Shield className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold mb-2">Agent not found</h2>
          <p className={`${subtle} text-sm`}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────
  if (pageState === 'success' && kya) {
    return (
      <div className={`min-h-screen ${bg} ${text} flex items-center justify-center px-4 relative overflow-hidden`}>
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none ${isDark ? 'bg-blue-900/20' : 'bg-blue-100/30'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] pointer-events-none ${isDark ? 'bg-purple-900/10' : 'bg-orange-50/40'}`} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className={`border rounded-2xl p-8 max-w-md w-full text-center backdrop-blur-sm relative z-10 ${card}`}
        >
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
          <h2 className="text-2xl font-bold mb-2">Endorsement recorded! 🎉</h2>
          <p className={`${subtle} mb-6`}>
            You endorsed <strong>{kya.agent.name ?? kya.agent.address.slice(0, 10) + '…'}</strong>
          </p>
          <div className={`border rounded-xl p-4 mb-6 ${card}`}>
            <p className="text-4xl mb-2">🪲 × 5</p>
            <p className="font-semibold">5 Scarab awarded to your wallet</p>
            <p className={`text-xs ${subtle} mt-1`}>Check your Scarab balance on your passport</p>
          </div>
          <a
            href={`/passport/${endorserAddress}`}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${btnPrimary}`}
          >
            View my passport
          </a>
        </motion.div>
      </div>
    );
  }

  // ── Main verify page ──────────────────────────────────────────────
  const agent = kya!.agent;
  const agentDisplayName = agent.name ?? `${agent.address.slice(0, 6)}…${agent.address.slice(-4)}`;

  return (
    <div className={`min-h-screen ${bg} ${text} relative overflow-hidden selection:bg-blue-500 selection:text-white`}>
      {/* Atmospheric Backgrounds — matching passport.maiat.io */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], x: [0, 20, 0], y: [0, -20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none ${isDark ? 'bg-blue-900/20' : 'bg-blue-100/30'}`}
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], x: [0, -30, 0], y: [0, 30, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] pointer-events-none ${isDark ? 'bg-purple-900/10' : 'bg-orange-50/40'}`}
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className={`absolute top-[30%] right-[10%] w-[25%] h-[25%] rounded-full blur-[100px] pointer-events-none ${isDark ? 'bg-indigo-900/10' : 'bg-indigo-100/20'}`}
      />

      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium border mb-5 backdrop-blur-sm ${isDark ? 'border-white/[0.08] bg-white/[0.04]' : 'border-black/[0.06] bg-white/60'}`}>
            <Shield className="w-3 h-3" />
            Know Your Agent
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">Endorse this agent</h1>
          <p className={`${subtle} text-sm`}>
            Tweet your support → get <span className="text-yellow-500">🪲 5 Scarab</span> reward
          </p>
        </motion.div>

        {/* Referrer badge */}
        {referrer && (
          <div className={`border rounded-xl px-4 py-3 mb-6 text-sm flex items-center gap-2 ${card}`}>
            <Users className="w-4 h-4 text-blue-400 shrink-0" />
            <span className={subtle}>Referred by</span>
            <span className="font-medium">{referrer}</span>
          </div>
        )}

        {/* Agent card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`border rounded-2xl p-6 mb-6 backdrop-blur-sm ${card}`}
        >
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/[0.06]' : 'bg-gradient-to-br from-blue-100 to-purple-100'}`}>
              <Shield className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold truncate">{agentDisplayName}</h2>
              {agent.twitterHandle && (
                <p className={`text-sm ${subtle}`}>@{agent.twitterHandle}</p>
              )}
              <p className={`text-xs font-mono ${subtle} truncate mt-1`}>{agent.address}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-xs font-mono px-2.5 py-1 rounded-lg ${isDark ? 'bg-white/[0.06] border border-white/[0.08] text-white/60' : 'bg-black/5 border border-black/[0.06] text-black/50'}`}>{code}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-white/[0.03] border border-white/[0.05]' : 'bg-black/[0.02] border border-black/[0.04]'}`}>
              <p className="text-2xl font-bold tracking-tight">{agent.totalEndorsements}</p>
              <p className={`text-xs mt-0.5 ${subtle}`}>endorsements</p>
            </div>
            <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-white/[0.03] border border-white/[0.05]' : 'bg-black/[0.02] border border-black/[0.04]'}`}>
              <p className="text-2xl font-bold tracking-tight text-emerald-400">+{agent.trustBoost}</p>
              <p className={`text-xs mt-0.5 ${subtle}`}>trust boost</p>
            </div>
          </div>
        </motion.div>

        {/* Step 1: Tweet */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={`border rounded-2xl p-6 mb-4 backdrop-blur-sm ${card}`}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <span className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold ${isDark ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>1</span>
            <h3 className="font-semibold">Tweet your endorsement</h3>
          </div>

          <div className={`border rounded-xl p-4 mb-4 font-mono text-sm whitespace-pre-wrap leading-relaxed ${isDark ? 'bg-black/20 border-white/[0.06] text-white/70' : 'bg-black/[0.02] border-black/[0.06] text-black/60'}`}>
            {buildTweetText()}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCopyTweet}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${btnSecondary}`}
            >
              {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy tweet'}
            </button>
            <button
              onClick={handleOpenTwitter}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${btnPrimary}`}
            >
              <Twitter className="w-4 h-4" />
              Tweet on X
            </button>
          </div>
        </motion.div>

        {/* Step 2: Submit proof */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className={`border rounded-2xl p-6 backdrop-blur-sm ${card}`}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <span className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold ${isDark ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' : 'bg-purple-50 text-purple-600 border border-purple-200'}`}>2</span>
            <h3 className="font-semibold">Submit your tweet proof</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${subtle}`}>Your wallet address</label>
              <input
                type="text"
                placeholder="0x..."
                value={endorserAddress}
                onChange={(e) => setEndorserAddress(e.target.value.trim())}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors ${inputClass}`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${subtle}`}>Tweet URL</label>
              <div className="relative">
                <ExternalLink className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${subtle}`} />
                <input
                  type="url"
                  placeholder="https://x.com/.../status/..."
                  value={tweetUrl}
                  onChange={(e) => setTweetUrl(e.target.value.trim())}
                  className={`w-full border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-colors ${inputClass}`}
                />
              </div>
            </div>

            {formError && (
              <p className="text-red-400 text-xs">{formError}</p>
            )}

            <button
              onClick={handleEndorse}
              disabled={submitting}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${btnPrimary}`}
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  🪲 Submit endorsement — earn 5 Scarab
                </>
              )}
            </button>

            <p className={`text-center text-xs ${subtle}`}>
              One endorsement per agent. Your tweet serves as on-chain proof.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
