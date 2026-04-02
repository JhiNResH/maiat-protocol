// X Layer contract addresses — update after deployment
export const XLAYER_TESTNET_CHAIN_ID = 1952
export const XLAYER_MAINNET_CHAIN_ID = 196

// Testnet addresses (deploy with: forge script DeployXLayer.s.sol)
export const CONTRACTS = {
  skillRegistry: process.env.NEXT_PUBLIC_SKILL_REGISTRY || '0x0000000000000000000000000000000000000000',
  jobMarket: process.env.NEXT_PUBLIC_JOB_MARKET || '0x0000000000000000000000000000000000000000',
  reputationEngine: process.env.NEXT_PUBLIC_REPUTATION_ENGINE || '0x0000000000000000000000000000000000000000',
} as const

// Minimal ABIs for frontend interaction
export const SKILL_REGISTRY_ABI = [
  { type: 'function', name: 'createSkill', inputs: [{ name: 'name', type: 'string' }, { name: 'description', type: 'string' }, { name: 'price', type: 'uint256' }, { name: 'royaltyBps', type: 'uint16' }], outputs: [{ name: 'skillId', type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'buySkill', inputs: [{ name: 'skillId', type: 'uint256' }], outputs: [], stateMutability: 'payable' },
  { type: 'function', name: 'getSkill', inputs: [{ name: 'skillId', type: 'uint256' }], outputs: [{ name: 'creator', type: 'address' }, { name: 'name', type: 'string' }, { name: 'description', type: 'string' }, { name: 'price', type: 'uint256' }, { name: 'royaltyBps', type: 'uint16' }, { name: 'totalBuyers', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getAgentSkills', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: '', type: 'uint256[]' }], stateMutability: 'view' },
  { type: 'function', name: 'hasSkill', inputs: [{ name: '', type: 'address' }, { name: '', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'nextSkillId', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'event', name: 'SkillCreated', inputs: [{ name: 'skillId', type: 'uint256', indexed: true }, { name: 'creator', type: 'address', indexed: true }, { name: 'name', type: 'string', indexed: false }, { name: 'price', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'SkillPurchased', inputs: [{ name: 'skillId', type: 'uint256', indexed: true }, { name: 'buyer', type: 'address', indexed: true }, { name: 'creator', type: 'address', indexed: true }, { name: 'pricePaid', type: 'uint256', indexed: false }] },
] as const

export const JOB_MARKET_ABI = [
  { type: 'function', name: 'postJob', inputs: [{ name: 'description', type: 'string' }, { name: 'preferredSkillId', type: 'uint256' }], outputs: [{ name: 'jobId', type: 'uint256' }], stateMutability: 'payable' },
  { type: 'function', name: 'acceptJob', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'completeJob', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'rateJob', inputs: [{ name: 'jobId', type: 'uint256' }, { name: 'score', type: 'uint8' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'cancelJob', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'getJob', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [{ name: 'buyer', type: 'address' }, { name: 'worker', type: 'address' }, { name: 'description', type: 'string' }, { name: 'reward', type: 'uint256' }, { name: 'preferredSkillId', type: 'uint256' }, { name: 'status', type: 'uint8' }, { name: 'rating', type: 'uint8' }, { name: 'createdAt', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getOpenJobs', inputs: [], outputs: [{ name: '', type: 'uint256[]' }], stateMutability: 'view' },
  { type: 'function', name: 'nextJobId', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'event', name: 'JobPosted', inputs: [{ name: 'jobId', type: 'uint256', indexed: true }, { name: 'buyer', type: 'address', indexed: true }, { name: 'description', type: 'string', indexed: false }, { name: 'reward', type: 'uint256', indexed: false }, { name: 'preferredSkillId', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'JobAccepted', inputs: [{ name: 'jobId', type: 'uint256', indexed: true }, { name: 'worker', type: 'address', indexed: true }] },
  { type: 'event', name: 'JobCompleted', inputs: [{ name: 'jobId', type: 'uint256', indexed: true }, { name: 'worker', type: 'address', indexed: true }] },
  { type: 'event', name: 'JobRated', inputs: [{ name: 'jobId', type: 'uint256', indexed: true }, { name: 'buyer', type: 'address', indexed: true }, { name: 'rating', type: 'uint8', indexed: false }] },
] as const

export const REPUTATION_ENGINE_ABI = [
  { type: 'function', name: 'getReputation', inputs: [{ name: 'agent', type: 'address' }, { name: 'skillId', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getGlobalReputation', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'calculateFee', inputs: [{ name: 'agent', type: 'address' }, { name: 'baseFeeBps', type: 'uint256' }], outputs: [{ name: 'adjustedFeeBps', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getRatingCount', inputs: [{ name: 'agent', type: 'address' }, { name: 'skillId', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getRatedSkills', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: '', type: 'uint256[]' }], stateMutability: 'view' },
  { type: 'event', name: 'ReputationUpdated', inputs: [{ name: 'agent', type: 'address', indexed: true }, { name: 'skillId', type: 'uint256', indexed: true }, { name: 'newScore', type: 'uint256', indexed: false }] },
] as const

// Skill icons for demo
export const SKILL_ICONS: Record<number, string> = {
  1: '🍔', // Food Delivery
  2: '💱', // DEX Swap
  3: '🚗', // Ride Dispatch
  4: '📈', // Staking Optimizer
  5: '💬', // Customer Support
}

export const JOB_STATUS_LABELS = ['Open', 'In Progress', 'Completed', 'Rated', 'Cancelled'] as const
export const JOB_STATUS_COLORS = ['text-green-400', 'text-blue-400', 'text-yellow-400', 'text-purple-400', 'text-red-400'] as const
