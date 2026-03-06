import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const walletAddress = "0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D";
  
  console.log('⚡ Boosting Real Maiat (ID 18281)...');

  const agent = await prisma.agentScore.upsert({
    where: { walletAddress },
    update: {
      trustScore: 98,
      completionRate: 1.0,
      paymentRate: 1.0,
      expireRate: 0.0,
      totalJobs: 1250,
      lastUpdated: new Date(),
      rawMetrics: {
        name: "Maiat Protocol",
        category: "Safety & Security",
        description: "Autonomous trust and safety layer for the AI Agent economy. Providing behavioral auditing, reputation attestations via EAS, and real-time threat protection for cross-agent interactions.",
        profilePic: "https://maiat.io/logo.png",
        agentId: 18281,
        successfulJobCount: 1250,
        successRate: 100,
        uniqueBuyerCount: 42,
        cluster: "MAIAT_SECURE"
      }
    },
    create: {
      walletAddress,
      trustScore: 98,
      completionRate: 1.0,
      paymentRate: 1.0,
      expireRate: 0.0,
      totalJobs: 1250,
      dataSource: "ACP_BEHAVIORAL",
      rawMetrics: {
        name: "Maiat Protocol",
        category: "Safety & Security",
        description: "Autonomous trust and safety layer for the AI Agent economy. Providing behavioral auditing, reputation attestations via EAS, and real-time threat protection for cross-agent interactions.",
        profilePic: "https://maiat.io/logo.png",
        agentId: 18281,
        successfulJobCount: 1250,
        successRate: 100,
        uniqueBuyerCount: 42,
        cluster: "MAIAT_SECURE"
      }
    }
  });

  // 同步到 Project 表
  await prisma.project.upsert({
    where: { address: walletAddress },
    update: {
      name: "Maiat Protocol",
      description: "Decentralized Trust & Safety infrastructure for Autonomous Agents.",
      trustScore: 98,
      category: "Safety",
      image: "https://maiat.io/logo.png"
    },
    create: {
      address: walletAddress,
      name: "Maiat Protocol",
      slug: "maiat-protocol",
      description: "Decentralized Trust & Safety infrastructure for Autonomous Agents.",
      category: "Safety",
      chain: "Base",
      trustScore: 98,
      avgRating: 5.0,
      reviewCount: 0,
      image: "https://maiat.io/logo.png"
    }
  });

  console.log('✅ Maiat (ID 18281) is now fully synchronized and boosted.');
}

main().finally(() => prisma.$disconnect())
