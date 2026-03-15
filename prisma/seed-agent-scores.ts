import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const agents = [
  { wallet: '0x1234567890abcdef1234567890abcdef12345678', trust: 92, completion: 0.95, payment: 0.98, expire: 0.02, jobs: 847 },
  { wallet: '0x2345678901abcdef2345678901abcdef23456789', trust: 87, completion: 0.91, payment: 0.95, expire: 0.05, jobs: 623 },
  { wallet: '0x3456789012abcdef3456789012abcdef34567890', trust: 83, completion: 0.88, payment: 0.92, expire: 0.08, jobs: 512 },
  { wallet: '0x4567890123abcdef4567890123abcdef45678901', trust: 78, completion: 0.85, payment: 0.89, expire: 0.11, jobs: 389 },
  { wallet: '0x5678901234abcdef5678901234abcdef56789012', trust: 74, completion: 0.82, payment: 0.86, expire: 0.14, jobs: 298 },
  { wallet: '0x6789012345abcdef6789012345abcdef67890123', trust: 69, completion: 0.78, payment: 0.83, expire: 0.17, jobs: 234 },
  { wallet: '0x7890123456abcdef7890123456abcdef78901234', trust: 64, completion: 0.74, payment: 0.79, expire: 0.21, jobs: 178 },
  { wallet: '0x8901234567abcdef8901234567abcdef89012345', trust: 58, completion: 0.68, payment: 0.74, expire: 0.26, jobs: 134 },
  { wallet: '0x9012345678abcdef9012345678abcdef90123456', trust: 45, completion: 0.55, payment: 0.62, expire: 0.38, jobs: 89 },
  { wallet: '0xa123456789abcdefa123456789abcdefa1234567', trust: 31, completion: 0.42, payment: 0.48, expire: 0.52, jobs: 43 },
];

const names = ['Virtuals Protocol', 'GAME by Virtuals', 'Luna by Virtuals', 'aixbt', 'Spectral', 'Wayfinder', 'Autonolas', 'Fetch.ai', 'SingularityNET', 'Ocean Protocol'];

async function main() {
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    await prisma.agentScore.upsert({
      where: { walletAddress: a.wallet },
      update: {},
      create: {
        walletAddress: a.wallet,
        trustScore: a.trust,
        completionRate: a.completion,
        paymentRate: a.payment,
        expireRate: a.expire,
        totalJobs: a.jobs,
        rawMetrics: { name: names[i], chain: 'base', tier: a.trust >= 80 ? 'A' : a.trust >= 60 ? 'B' : 'C' },
      }
    });
  }
  console.log(`✅ Seeded ${agents.length} agent scores`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
