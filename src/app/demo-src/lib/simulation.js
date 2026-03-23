/**
 * Maiat8183 Evaluator Playground
 * 
 * Core narrative: "Who watches the watchmen?"
 * 
 * In ERC-8183 terms:
 *   - Clients = projects requesting evaluation (e.g., Synthesis hackathon submissions)
 *   - Providers = AI judge agents providing evaluation services
 *   - Evaluator = Maiat8183 — verifies judges are trustworthy before they can judge
 * 
 * The playground simulates a project being evaluated by multiple judges,
 * showing how Maiat8183 hooks gate, escrow, attest, and build judge reputation.
 */

import { scoreFromAddress, VERDICT_LABELS } from './utils.js';

/**
 * Simulate a single judge attempting to evaluate a project
 * Returns the hook pipeline for this judge
 */
export function simulateJudgeEvaluation({ judge, project, params }) {
  const {
    trustThreshold = 50,
    autoApproveThreshold = 70,
    escrowThreshold = 30,
    quorumSize = 3,
  } = params;

  const judgeScore = judge.trustScore ?? scoreFromAddress(judge.address);
  const steps = [];

  // ═══ 1. Judge applies to evaluate → beforeJobTaken() ═══
  // TrustGateACPHook: does this judge have enough trust to evaluate?
  const trustPass = judgeScore >= trustThreshold;
  steps.push({
    hook: 'TrustGateACPHook',
    timing: 'beforeJobTaken',
    action: `Can this judge evaluate? Score ${judgeScore} vs threshold ${trustThreshold}`,
    result: trustPass ? 'pass' : 'blocked',
    detail: trustPass
      ? `Judge score ${judgeScore} ≥ ${trustThreshold} — allowed to evaluate`
      : `Judge score ${judgeScore} < ${trustThreshold} — BLOCKED: not trusted enough to judge`,
  });

  if (!trustPass) {
    return {
      steps,
      verdict: 'blocked',
      reason: `Judge blocked by TrustGateACPHook (score ${judgeScore} < ${trustThreshold})`,
      judgeScore,
    };
  }

  // ═══ 2. Escrow check → FundTransferHook ═══
  // Low-trust judges have their reward escrowed until evaluation is verified
  const escrowRequired = judgeScore < escrowThreshold;
  steps.push({
    hook: 'FundTransferHook',
    timing: 'beforeJobTaken',
    action: escrowRequired
      ? `Escrow required — judge reward held until evaluation verified`
      : `No escrow needed — judge trusted for direct payment`,
    result: escrowRequired ? 'warn' : 'pass',
    detail: escrowRequired
      ? `Score ${judgeScore} < ${escrowThreshold} → reward locked in escrow until verified`
      : `Score ${judgeScore} ≥ ${escrowThreshold} → direct payment on completion`,
  });

  // ═══ 3. Judge submits verdict → TrustBasedEvaluator decides ═══
  let evalResult, evalDetail;
  if (judgeScore >= autoApproveThreshold) {
    evalResult = 'auto-approved';
    evalDetail = `Score ${judgeScore} ≥ ${autoApproveThreshold} — verdict AUTO-APPROVED, no review needed`;
  } else if (judgeScore >= Math.round(autoApproveThreshold * 0.5)) {
    evalResult = 'quorum-required';
    evalDetail = `Score ${judgeScore} in range [${Math.round(autoApproveThreshold * 0.5)}, ${autoApproveThreshold}) — needs ${quorumSize}-judge quorum consensus`;
  } else {
    evalResult = 'rejected';
    evalDetail = `Score ${judgeScore} < ${Math.round(autoApproveThreshold * 0.5)} — verdict REJECTED, judge too unreliable`;
  }

  steps.push({
    hook: 'TrustBasedEvaluator',
    timing: 'completeJob',
    action: `Judge submits verdict → evaluator checks if verdict is trustworthy`,
    result: evalResult === 'auto-approved' ? 'pass' : evalResult === 'quorum-required' ? 'warn' : 'blocked',
    detail: evalDetail,
  });

  // ═══ 4. AttestationHook — EAS receipt minted ═══
  steps.push({
    hook: 'AttestationHook',
    timing: 'afterAction',
    action: `Mint immutable EAS attestation for this evaluation`,
    result: 'pass',
    detail: `On-chain receipt: { project: ${project.name}, judge: ${judge.name}, verdict: ${evalResult}, timestamp: now } — non-revocable`,
  });

  // ═══ 5. MutualAttestationHook — bilateral reviews ═══
  steps.push({
    hook: 'MutualAttestationHook',
    timing: 'afterAction',
    action: `Enable Airbnb-style bilateral review (project ↔ judge)`,
    result: 'pass',
    detail: `Both project team and judge can rate each other (1-5 stars + EAS). Builds reputation for future evaluations.`,
  });

  const verdict = evalResult === 'auto-approved' ? 'approved' : evalResult === 'quorum-required' ? 'escalated' : 'rejected';
  return {
    steps,
    verdict,
    reason: evalDetail,
    judgeScore,
    escrowRequired,
  };
}

/**
 * Simulate multiple judges evaluating one project
 * Shows the full picture: which judges pass, which get blocked, final project outcome
 */
export function simulateProjectEvaluation({ project, judges, params }) {
  const results = judges.map((judge) => ({
    judge,
    ...simulateJudgeEvaluation({ judge, project, params }),
  }));

  const approved = results.filter((r) => r.verdict === 'approved');
  const escalated = results.filter((r) => r.verdict === 'escalated');
  const blocked = results.filter((r) => r.verdict === 'blocked');
  const rejected = results.filter((r) => r.verdict === 'rejected');

  // Project outcome: need quorum of approved judges
  const quorum = params.quorumSize || 3;
  let projectOutcome;
  if (approved.length >= quorum) {
    projectOutcome = 'evaluated';
  } else if (approved.length + escalated.length >= quorum) {
    projectOutcome = 'pending-quorum';
  } else {
    projectOutcome = 'insufficient-judges';
  }

  return {
    results,
    summary: {
      total: judges.length,
      approved: approved.length,
      escalated: escalated.length,
      blocked: blocked.length,
      rejected: rejected.length,
      quorumMet: approved.length >= quorum,
      projectOutcome,
    },
  };
}
