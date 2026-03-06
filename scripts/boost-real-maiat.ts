import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const walletAddress = "0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D";
  
  const agent = await prisma.agentScore.update({
    where: { walletAddress },
    data: {
      trustScore: 98,
      completionRate: 1.0,
      paymentRate: 1.0,
      totalJobs: 1500,
      rawMetrics: {
        name: "Maiat Protocol",
        category: "Security",
        description: "Real-time behavioral monitoring and trust attestation protocol for autonomous agents.",
        profilePic: "https://maiat.io/logo.png",
        agentId: 18281,
        successfulJobCount: 1500,
        successRate: 100
      }
    }
  })
  
  console.log('✅ Boosted real Maiat agent:', agent.walletAddress)
}
main().finally(() => prisma.$disconnect())
