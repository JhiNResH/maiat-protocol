'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Shield, ArrowRight, CheckCircle2, Radio, Database,
  Globe, Cpu, Zap, ChevronRight, ExternalLink,
  Play, Pause, RotateCcw, Clock, Link2
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

type Step = {
  id: number
  title: string
  subtitle: string
  description: string
  icon: any
  color: string
  details: string[]
  code?: string
}

// ============================================================================
// DEMO STEPS — Chainlink CRE Trust Oracle Flow
// ============================================================================

const STEPS: Step[] = [
  {
    id: 1,
    title: 'Agent Queries Trust Score',
    subtitle: 'Any AI agent via HTTP',
    description: 'An autonomous agent (e.g., a DeFi router) needs to verify whether a counterparty is trustworthy before executing a transaction.',
    icon: Cpu,
    color: '#EF4444',
    details: [
      'Agent calls POST /api/v1/trust-score',
      'Passes target project name or address',
      'No SDK required — just HTTP',
      'Free tier: 100 req/day'
    ],
    code: `curl -X POST https://maiat.xyz/api/v1/trust-score \\
  -H "Content-Type: application/json" \\
  -d '{"agentAddress": "0x1234..."}'`
  },
  {
    id: 2,
    title: 'Maiat Aggregates Trust Data',
    subtitle: 'Multi-source scoring engine',
    description: 'Maiat\'s scoring engine aggregates on-chain history, contract analysis, community reviews, and blacklist data into a single 0-10 trust score.',
    icon: Database,
    color: '#7C3AED',
    details: [
      'On-Chain History (weight: 4.0) — tx count, age, volume',
      'Contract Analysis (weight: 3.0) — verified source, audit status',
      'Blacklist Check (weight: 2.0) — known scam databases',
      'Activity Score (weight: 1.0) — recent engagement'
    ],
    code: `// Score Breakdown
{
  "onChainHistory": 8.2,    // 4.0 weight
  "contractAnalysis": 7.5,  // 3.0 weight
  "blacklistCheck": 10.0,   // 2.0 weight
  "activityScore": 6.0,     // 1.0 weight
  "overall": 8.07           // weighted average
}`
  },
  {
    id: 3,
    title: 'Chainlink CRE Workflow Triggers',
    subtitle: 'Decentralized oracle execution',
    description: 'When a score is requested, Chainlink\'s Compute Runtime Environment (CRE) triggers a workflow that fetches, validates, and prepares the trust score for on-chain attestation.',
    icon: Link2,
    color: '#375BD2',
    details: [
      'CRE Workflow receives trigger event',
      'Fetches latest trust data from Maiat API',
      'Validates data integrity with consensus',
      'Prepares signed attestation payload'
    ],
    code: `// Chainlink CRE Workflow (YAML)
triggers:
  - type: on-demand
    config:
      requester: "0x..."

consensus:
  - type: offchain_reporting
    config:
      report_codec: "trust_score_v1"

targets:
  - type: write_base-sepolia
    config:
      address: "0xf662902ca2..."   # TrustScoreOracle
      function: "updateScore(address,uint256)"`
  },
  {
    id: 4,
    title: 'On-Chain Attestation',
    subtitle: 'Base Sepolia → TrustScoreOracle',
    description: 'The validated trust score is written on-chain via the TrustScoreOracle contract on Base Sepolia, creating an immutable, verifiable attestation.',
    icon: Shield,
    color: '#10B981',
    details: [
      'TrustScoreOracle.updateScore() called by CRE',
      'Score stored with timestamp + block number',
      'Emits TrustScoreUpdated event',
      'Queryable by any smart contract or dApp'
    ],
    code: `// TrustScoreOracle.sol (Base Sepolia)
// 0xf662902ca227baba3a4d11a1bc58073e0b0d1139

function updateScore(
  address target,
  uint256 score    // 0-1000 (10.0 = 1000)
) external onlyOracle {
  scores[target] = Score(score, block.timestamp);
  emit TrustScoreUpdated(target, score, block.timestamp);
}`
  },
  {
    id: 5,
    title: 'TrustGateHook Enforces',
    subtitle: 'Uniswap v4 integration',
    description: 'The TrustGateHook reads on-chain trust scores and blocks swaps involving untrusted counterparties — protecting DeFi users automatically.',
    icon: Zap,
    color: '#F59E0B',
    details: [
      'Uniswap v4 hook checks score before swap',
      'Minimum threshold: 5.0 (configurable)',
      'Below threshold → swap reverted',
      'Zero user friction — enforcement is invisible'
    ],
    code: `// TrustGateHook.sol (Base Sepolia)
// 0xf6065fb076090af33ee0402f7e902b2583e7721e

function beforeSwap(
  address sender, PoolKey calldata key, ...
) external override returns (bytes4) {
  uint256 score = oracle.getScore(sender);
  require(score >= minScore, "Trust score too low");
  return BaseHook.beforeSwap.selector;
}`
  }
]

// ============================================================================
// ANIMATED STEP CARD
// ============================================================================

function StepCard({ step, isActive, isComplete, onClick }: {
  step: Step
  isActive: boolean
  isComplete: boolean
  onClick: () => void
}) {
  const Icon = step.icon
  return (
    <button
      onClick={onClick}
      className={`w-full text-left transition-all duration-500 rounded-xl border p-5 ${
        isActive
          ? 'border-[color:var(--step-color)] bg-[color:var(--step-color)]/5 shadow-lg shadow-[color:var(--step-color)]/5'
          : isComplete
            ? 'border-zinc-700/50 bg-zinc-900/30 opacity-70'
            : 'border-zinc-800/50 bg-zinc-900/20 opacity-40'
      }`}
      style={{ '--step-color': step.color } as any}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-500 ${
            isActive ? 'scale-110' : ''
          }`}
          style={{
            background: isComplete || isActive ? `${step.color}15` : '#18181b',
            border: `1px solid ${isComplete || isActive ? step.color + '40' : '#27272a'}`
          }}
        >
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5" style={{ color: step.color }} />
          ) : (
            <Icon className="w-5 h-5" style={{ color: isActive ? step.color : '#71717a' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: step.color }}>
              Step {step.id}
            </span>
            {isActive && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                <Radio className="w-3 h-3 animate-pulse" style={{ color: step.color }} />
                Active
              </span>
            )}
          </div>
          <h3 className={`text-sm font-medium mt-1 ${isActive ? 'text-zinc-100' : 'text-zinc-400'}`}>
            {step.title}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">{step.subtitle}</p>
        </div>
      </div>
    </button>
  )
}

// ============================================================================
// DETAIL PANEL
// ============================================================================

function DetailPanel({ step }: { step: Step }) {
  const Icon = step.icon
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: `${step.color}15`, border: `1px solid ${step.color}30` }}
          >
            <Icon className="w-6 h-6" style={{ color: step.color }} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">{step.title}</h2>
            <p className="text-sm text-zinc-500">{step.subtitle}</p>
          </div>
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed">{step.description}</p>
      </div>

      {/* Details */}
      <div className="space-y-2">
        {step.details.map((detail, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: step.color }} />
            <span className="text-zinc-300">{detail}</span>
          </div>
        ))}
      </div>

      {/* Code */}
      {step.code && (
        <div className="rounded-lg border border-zinc-800 bg-[#0a0a0f] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/80">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Code</span>
          </div>
          <pre className="p-4 text-xs font-mono text-zinc-400 overflow-x-auto leading-relaxed">
            {step.code}
          </pre>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// FLOW VISUALIZATION
// ============================================================================

function FlowDiagram({ activeStep }: { activeStep: number }) {
  const nodes = [
    { label: 'Agent', color: '#EF4444' },
    { label: 'Maiat API', color: '#7C3AED' },
    { label: 'CRE', color: '#375BD2' },
    { label: 'On-Chain', color: '#10B981' },
    { label: 'Hook', color: '#F59E0B' },
  ]
  return (
    <div className="flex items-center justify-center gap-1 py-4 overflow-x-auto">
      {nodes.map((node, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all duration-500 border ${
              i + 1 === activeStep
                ? 'scale-110 shadow-lg'
                : i + 1 < activeStep
                  ? 'opacity-60'
                  : 'opacity-30'
            }`}
            style={{
              background: i + 1 <= activeStep ? `${node.color}15` : '#18181b',
              borderColor: i + 1 <= activeStep ? `${node.color}40` : '#27272a',
              color: i + 1 <= activeStep ? node.color : '#52525b',
              boxShadow: i + 1 === activeStep ? `0 0 20px ${node.color}20` : 'none'
            }}
          >
            {node.label}
          </div>
          {i < nodes.length - 1 && (
            <ArrowRight
              className="w-3 h-3 flex-shrink-0 transition-all duration-500"
              style={{
                color: i + 1 < activeStep ? nodes[i + 1].color : '#27272a'
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function DemoPage() {
  const [activeStep, setActiveStep] = useState(1)
  const [autoPlay, setAutoPlay] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const nextStep = useCallback(() => {
    setActiveStep(prev => prev < STEPS.length ? prev + 1 : 1)
  }, [])

  // Auto-play timer
  useEffect(() => {
    if (!autoPlay) return
    const interval = setInterval(() => {
      setElapsed(prev => {
        if (prev >= 100) {
          nextStep()
          return 0
        }
        return prev + 2
      })
    }, 80)
    return () => clearInterval(interval)
  }, [autoPlay, nextStep])

  const handleStepClick = (id: number) => {
    setActiveStep(id)
    setElapsed(0)
  }

  const currentStep = STEPS[activeStep - 1]

  return (
    <div className="min-h-screen bg-[#050508] text-zinc-100">
      {/* Top Bar */}
      <div className="border-b border-zinc-800/60 bg-[#050508]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/explore" className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors">
              <Shield className="w-5 h-5 text-[#EF4444]" />
              <span className="font-semibold text-sm">Maiat Protocol</span>
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">CRE Demo</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/JhiNResH/maiat-protocol"
              target="_blank"
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              GitHub <ExternalLink className="w-3 h-3" />
            </a>
            <Link
              href="/docs"
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Docs <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#375BD2]/30 bg-[#375BD2]/5 text-[#375BD2] text-xs font-mono mb-4">
            <Link2 className="w-3 h-3" /> Powered by Chainlink CRE
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Trust Score Oracle Flow
          </h1>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto leading-relaxed">
            How Maiat delivers verifiable, on-chain trust scores for AI agents
            using Chainlink&apos;s Compute Runtime Environment.
          </p>
        </div>

        {/* Flow Diagram */}
        <FlowDiagram activeStep={activeStep} />

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mt-4 mb-8">
          <button
            onClick={() => { setAutoPlay(!autoPlay); setElapsed(0) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
          >
            {autoPlay ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {autoPlay ? 'Pause' : 'Auto-Play'}
          </button>
          <button
            onClick={() => { setActiveStep(1); setElapsed(0); setAutoPlay(false) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          {autoPlay && (
            <div className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${elapsed}%`,
                  background: currentStep.color
                }}
              />
            </div>
          )}
        </div>

        {/* Main Content: Steps + Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Step List */}
          <div className="lg:col-span-2 space-y-3">
            {STEPS.map((step) => (
              <StepCard
                key={step.id}
                step={step}
                isActive={step.id === activeStep}
                isComplete={step.id < activeStep}
                onClick={() => handleStepClick(step.id)}
              />
            ))}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-3">
            <div className="sticky top-20 rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-6">
              <DetailPanel key={activeStep} step={currentStep} />
            </div>
          </div>
        </div>

        {/* Contracts */}
        <div className="mt-16 rounded-xl border border-zinc-800/40 bg-zinc-900/10 p-6">
          <h3 className="text-sm font-mono uppercase tracking-wider text-zinc-500 mb-4">Deployed Contracts (Base Sepolia)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 bg-[#050508]">
              <div>
                <p className="text-xs font-mono text-emerald-400">TrustScoreOracle</p>
                <p className="text-[11px] font-mono text-zinc-600 mt-1">0xf662902ca227baba3a4d11a1bc58073e0b0d1139</p>
              </div>
              <a
                href="https://sepolia.basescan.org/address/0xf662902ca227baba3a4d11a1bc58073e0b0d1139"
                target="_blank"
                className="text-zinc-600 hover:text-zinc-400"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 bg-[#050508]">
              <div>
                <p className="text-xs font-mono text-amber-400">TrustGateHook</p>
                <p className="text-[11px] font-mono text-zinc-600 mt-1">0xf6065fb076090af33ee0402f7e902b2583e7721e</p>
              </div>
              <a
                href="https://sepolia.basescan.org/address/0xf6065fb076090af33ee0402f7e902b2583e7721e"
                target="_blank"
                className="text-zinc-600 hover:text-zinc-400"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-10 text-center">
          <p className="text-xs text-zinc-600 mb-4">
            Built for Chainlink Convergence Hackathon — February 2026
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/explore"
              className="px-5 py-2.5 rounded-lg bg-[#EF4444] text-white text-sm font-medium hover:bg-[#EF4444]/90 transition-colors"
            >
              Explore Projects →
            </Link>
            <Link
              href="/docs"
              className="px-5 py-2.5 rounded-lg border border-zinc-800 text-zinc-400 text-sm font-medium hover:border-zinc-700 hover:text-zinc-200 transition-colors"
            >
              API Docs
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
