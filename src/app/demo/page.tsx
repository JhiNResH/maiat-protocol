'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Shield, ArrowRight, CheckCircle2, Radio, Database,
  Globe, Cpu, Zap, ChevronRight, ExternalLink,
  Play, Pause, RotateCcw, Clock, Link2, Gavel, FileCheck, BookOpen
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
// DEMO STEPS — ERC-8183 Agentic Commerce Hook Lifecycle (Hackathon Judging)
// ============================================================================

const STEPS: Step[] = [
  {
    id: 1,
    title: 'Create Job & Fund',
    subtitle: 'Project Submits for Evaluation',
    description: 'A hackathon project calls createJob("evaluate my project") then fund() on the AgenticCommerce contract. MaiatACPHook.beforeAction(fund) intercepts to verify the project\'s trust score before accepting funds.',
    icon: Globe,
    color: '#3b82f6',
    details: [
      'Project calls AgenticCommerce.createJob("evaluate my project")',
      'Project calls fund() to escrow payment',
      'MaiatACPHook.beforeAction(fund) fires — checks client trust score via TrustScoreOracle',
      'Low-trust projects (score < threshold) are reverted with ClientTrustTooLow error',
      'Trusted projects pass through; FundGated(jobId, client, score, true) emitted'
    ],
    code: `// MaiatACPHook.sol — beforeAction(fund) check
function _checkClientTrust(uint256 jobId, bytes calldata data) internal {
    // data = abi.encode(caller, optParams) per ERC-8183 spec
    (address caller,) = abi.decode(data, (address, bytes));

    ITrustOracle.UserReputation memory rep = oracle.getUserData(caller);

    uint256 score = rep.initialized ? rep.reputationScore : 0;
    uint256 cappedScore = score > MAX_SCORE ? MAX_SCORE : score;

    if (!rep.initialized && !allowUninitialized) {
        revert MaiatACPHook__ClientNotInitialized(jobId, caller);
    } else if (rep.initialized && cappedScore < clientThreshold) {
        emit FundGated(jobId, caller, cappedScore, false);
        revert MaiatACPHook__ClientTrustTooLow(
            jobId, caller, cappedScore, clientThreshold
        );
    }

    totalFundGated++;
    emit FundGated(jobId, caller, cappedScore, true);
}`
  },
  {
    id: 2,
    title: 'Judge Submits Verdict',
    subtitle: 'AI Judge Reviews & Submits',
    description: 'An AI judge agent calls submit(jobId, verdict, evidence) to deliver its evaluation. MaiatACPHook.beforeAction(submit) checks the judge\'s trust score — only trusted judges can submit verdicts, protecting evaluation integrity.',
    icon: Gavel,
    color: '#6366f1',
    details: [
      'AI judge agent calls AgenticCommerce.submit(jobId, verdict, evidence)',
      'MaiatACPHook.beforeAction(submit) fires — checks judge\'s trust score',
      'Low-trust judges (score < providerThreshold) are blocked with ProviderTrustTooLow',
      'Trusted judges pass; SubmitChecked(jobId, provider, score, true) emitted',
      'Job status advances to Submitted — now ready for MaiatEvaluator'
    ],
    code: `// MaiatACPHook.sol — beforeAction(submit) check
function _checkProviderTrust(uint256 jobId, bytes calldata data) internal {
    (address caller,,) = abi.decode(data, (address, bytes32, bytes));

    ITrustOracle.UserReputation memory rep = oracle.getUserData(caller);

    uint256 score = rep.initialized ? rep.reputationScore : 0;
    uint256 cappedScore = score > MAX_SCORE ? MAX_SCORE : score;

    if (rep.initialized && cappedScore < providerThreshold) {
        emit SubmitChecked(jobId, caller, cappedScore, false);
        revert MaiatACPHook__ProviderTrustTooLow(
            jobId, caller, cappedScore, providerThreshold
        );
    }

    emit SubmitChecked(jobId, caller, cappedScore, true);
}

// Called from beforeAction dispatcher:
function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data)
    external override
{
    if (selector == FUND_SELECTOR)   { _checkClientTrust(jobId, data); }
    else if (selector == SUBMIT_SELECTOR) { _checkProviderTrust(jobId, data); }
    // Other selectors (setBudget, etc.) pass through without gating
}`
  },
  {
    id: 3,
    title: 'Evaluator Verifies Judge',
    subtitle: 'MaiatEvaluator Validates',
    description: 'MaiatEvaluator.evaluate(acpContract, jobId) is called to make the final verdict. It reads the judge\'s trust score from the oracle and decides: if score ≥ threshold AND not flagged → complete(); otherwise → reject().',
    icon: Shield,
    color: '#10B981',
    details: [
      'MaiatEvaluator.evaluate(acpContract, jobId) called',
      'Reads judge\'s (provider\'s) trust score from TrustScoreOracle',
      'Checks threat report count — flagged agents auto-rejected regardless of score',
      'Score ≥ threshold AND not flagged → acp.complete(jobId, reason, "")',
      'Score too low OR flagged → acp.reject(jobId, REASON_LOW_TRUST / REASON_FLAGGED, "")'
    ],
    code: `// MaiatEvaluator.sol — evaluate() decision logic
function evaluate(address acpContract, uint256 jobId) external nonReentrant {
    IAgenticCommerce acp = IAgenticCommerce(acpContract);
    IAgenticCommerce.Job memory job = acp.getJob(jobId);

    // Read provider score from oracle
    ITrustScoreOracle.UserReputation memory rep =
        oracle.getUserData(job.provider);

    uint256 cappedScore = rep.initialized
        ? (rep.reputationScore > MAX_SCORE ? MAX_SCORE : rep.reputationScore)
        : 0;

    bool shouldComplete;
    bytes32 reason;
    uint256 threats = threatReports[job.provider];

    if (threats >= threatThreshold && threatThreshold > 0) {
        shouldComplete = false;
        reason = REASON_FLAGGED;           // keccak256("FLAGGED_AGENT")
    } else if (!rep.initialized) {
        shouldComplete = false;
        reason = REASON_UNINITIALIZED;     // keccak256("UNINITIALIZED_PROVIDER")
    } else if (cappedScore >= threshold) {
        shouldComplete = true;
        reason = bytes32(cappedScore);     // attestation: the score itself
    } else {
        shouldComplete = false;
        reason = REASON_LOW_TRUST;         // keccak256("LOW_TRUST_SCORE")
    }

    evaluated[acpContract][jobId] = true;

    if (shouldComplete) { acp.complete(jobId, reason, ""); }
    else                { acp.reject(jobId, reason, "");   }

    emit EvaluationResult(
        acpContract, jobId, job.provider, cappedScore, shouldComplete, reason
    );
}`
  },
  {
    id: 4,
    title: 'Outcome Recorded',
    subtitle: 'Hook Records Result',
    description: 'After complete() or reject() is called, MaiatACPHook.afterAction fires and records the outcome on-chain. It emits JobOutcomeRecorded with both parties\' trust scores — picked up by the Wadjet off-chain indexer for ML training.',
    icon: Database,
    color: '#f59e0b',
    details: [
      'AgenticCommerce calls MaiatACPHook.afterAction(complete/reject)',
      'Hook reads job data and both parties\' current trust scores from oracle',
      'Emits JobOutcomeRecorded(jobId, provider, client, completed, providerScore, clientScore)',
      'Wadjet off-chain indexer picks up event for ML training data',
      'Outcome feeds back into trust score calculations for future interactions'
    ],
    code: `// MaiatACPHook.sol — _recordOutcome (called from afterAction)
function afterAction(uint256 jobId, bytes4 selector, bytes calldata)
    external override
{
    if (selector == COMPLETE_SELECTOR) { _recordOutcome(jobId, true);  }
    else if (selector == REJECT_SELECTOR)  { _recordOutcome(jobId, false); }
}

function _recordOutcome(uint256 jobId, bool completed) internal {
    // Read job data to get provider and client addresses
    IAgenticCommerceReader.Job memory job = acpContract.getJob(jobId);

    // Get current scores for both parties
    ITrustOracle.UserReputation memory providerRep =
        oracle.getUserData(job.provider);
    ITrustOracle.UserReputation memory clientRep =
        oracle.getUserData(job.client);

    uint256 providerScore = providerRep.initialized
        ? providerRep.reputationScore : 0;
    uint256 clientScore = clientRep.initialized
        ? clientRep.reputationScore : 0;

    if (completed) { totalCompleted++; } else { totalRejected++; }

    // Emit event — off-chain indexer (Wadjet) picks this up for ML training
    emit JobOutcomeRecorded(
        jobId,
        job.provider,
        job.client,
        completed,
        providerScore,
        clientScore
    );
}`
  },
  {
    id: 5,
    title: 'EAS Attestation',
    subtitle: 'Permanent On-Chain Receipt',
    description: 'An EAS (Ethereum Attestation Service) attestation is created with the evaluation result — an immutable on-chain receipt of the hackathon evaluation. This feeds back into trust scores for all future interactions.',
    icon: FileCheck,
    color: '#06b6d4',
    details: [
      'EAS attestation created via MaiatReceiptResolver schema',
      'Schema UID: 0x24b0db68...346d802 (Base Mainnet)',
      'Attestation encodes: jobId, provider, client, score, completed, timestamp',
      'Immutable proof — cannot be altered or deleted',
      'Wadjet ingests attestations → recalculates trust scores → oracle sync every 6h'
    ],
    code: `// EAS Schema & Attestation Flow
// Schema UID (Base Mainnet):
// 0x24b0db687434f15057bef6011b95f1324f2c38af06d0e636aea1c58bf346d802

// Schema fields:
// uint256 jobId          — ERC-8183 job identifier
// address provider       — AI judge's wallet address
// address client         — Hackathon project's address
// uint256 score          — Provider trust score at evaluation time (0-100)
// bool    completed      — true = passed, false = rejected
// bytes32 reason         — Reason code or score bytes

// Gated by MaiatReceiptResolver:
// Base Mainnet: 0xda696009655825124bcbfdd5755c0657d6d841c0

// Only MaiatAttester operator can create valid attestations:
// Operator: 0xB1e504aE1ce359B4C2a6DC5d63aE6199a415f312

// After attestation:
// Wadjet indexes → trust scores recalculated
// MaiatOracle.updateScore() called (Base Mainnet)
// Future jobs query updated on-chain score`
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
        <div className="rounded-lg border border-zinc-800 bg-[var(--bg-surface)] overflow-hidden">
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
    { label: 'Project', color: '#3b82f6' },
    { label: 'MaiatACPHook', color: '#6366f1' },
    { label: 'Judge', color: '#10B981' },
    { label: 'MaiatEvaluator', color: '#f59e0b' },
    { label: 'EAS', color: '#06b6d4' },
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
    <div className="min-h-screen bg-[var(--bg-page)] text-zinc-100">
      {/* Top Bar */}
      <div className="border-b border-zinc-800/60 bg-[rgba(5,5,8,0.8)] backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/monitor" className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors">
              <Shield className="w-5 h-5 text-[#3b82f6]" />
              <span className="font-semibold text-sm">Maiat Protocol</span>
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">ERC-8183 Demo</span>
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#6366f1]/30 bg-[#6366f1]/5 text-[#6366f1] text-xs font-mono mb-4">
            <BookOpen className="w-3 h-3" /> ERC-8183 Agentic Commerce
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            ERC-8183 Agentic Commerce Hook
          </h1>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto leading-relaxed">
            Trust-gated job lifecycle for AI agent commerce — MaiatACPHook and MaiatEvaluator
            protect every transition from fund to final EAS attestation.
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
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 bg-[var(--bg-page)]">
              <div>
                <p className="text-xs font-mono text-indigo-400">MaiatACPHook</p>
                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">ERC-8183 IACPHook — gates fund/submit lifecycle</p>
                <p className="text-[11px] font-mono text-zinc-600 mt-1">(Hookathon — address TBD)</p>
              </div>
              <a
                href="https://sepolia.basescan.org"
                target="_blank"
                className="text-zinc-600 hover:text-zinc-400"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 bg-[var(--bg-page)]">
              <div>
                <p className="text-xs font-mono text-emerald-400">MaiatEvaluator</p>
                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">Trust-based job evaluator — reads oracle scores</p>
                <p className="text-[11px] font-mono text-zinc-600 mt-1">(Hookathon — address TBD)</p>
              </div>
              <a
                href="https://sepolia.basescan.org"
                target="_blank"
                className="text-zinc-600 hover:text-zinc-400"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 bg-[var(--bg-page)]">
              <div>
                <p className="text-xs font-mono text-blue-400">TrustScoreOracle</p>
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
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 bg-[var(--bg-page)]">
              <div>
                <p className="text-xs font-mono text-cyan-400">EAS Resolver (Base Mainnet)</p>
                <p className="text-[11px] font-mono text-zinc-600 mt-1">0xda696009655825124bcbfdd5755c0657d6d841c0</p>
              </div>
              <a
                href="https://basescan.org/address/0xda696009655825124bcbfdd5755c0657d6d841c0"
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
            Built for Uniswap Hookathon — March 2026
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/monitor"
              className="px-5 py-2.5 rounded-lg bg-[#3b82f6] text-white text-sm font-medium hover:bg-[#3b82f6]/90 transition-colors"
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
