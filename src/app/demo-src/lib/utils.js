export function scoreFromAddress(address) {
  if (!address || address.length < 10) return 50;
  const hex = address.replace(/^0x/, '').slice(0, 8);
  return parseInt(hex, 16) % 101;
}

export function tokenVerdictFromAddress(address) {
  if (!address || address.length < 14) return 0;
  const hex = address.replace(/^0x/, '').slice(8, 12);
  const val = parseInt(hex, 16) % 100;
  if (val < 60) return 0;
  if (val < 80) return 1;
  if (val < 90) return 2;
  return 3;
}

export const VERDICT_LABELS = ['Safe', 'Honeypot', 'High Tax', 'Unverified'];

// Pre-built judge profiles for the playground
export const JUDGE_PRESETS = [
  { name: 'Judge Alpha', address: '0xaaaa000000000000000000000000000000000001', trustScore: 92, quality: 'good', history: '147 evaluations, 96% accuracy' },
  { name: 'Judge Beta', address: '0xbbbb000000000000000000000000000000000002', trustScore: 78, quality: 'good', history: '83 evaluations, 89% accuracy' },
  { name: 'Judge Gamma', address: '0xcccc000000000000000000000000000000000003', trustScore: 55, quality: 'good', history: '31 evaluations, 82% accuracy' },
  { name: 'Judge Delta', address: '0xdddd000000000000000000000000000000000004', trustScore: 28, quality: 'bad', history: '12 evaluations, 41% accuracy' },
  { name: 'Judge Zero', address: '0x0000000000000000000000000000000000000005', trustScore: 0, quality: 'new', history: 'First evaluation — no history' },
];

export const PROJECT_PRESETS = [
  { name: 'ERC-8183 Open Build', desc: 'Trust hooks for agentic commerce job lifecycle (Virtuals)', prize: '$2,000+' },
  { name: 'Agents With Receipts — ERC-8004', desc: 'On-chain agent identity with trust scoring', prize: '$2,000' },
  { name: 'Synthesis Open Track', desc: 'Community-funded open track for AI agent builders', prize: '$28,000' },
  { name: 'Escrow Ecosystem Extensions', desc: 'Novel arbiter types, verification primitives, trust models (Alkahest)', prize: '$2,500' },
  { name: "Student Founder's Bet", desc: 'Best student projects in AI agent × web3 (college.xyz)', prize: '$500 + travel' },
];

export function shortenAddress(addr) {
  if (!addr || addr.length < 12) return addr || '';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}
