import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const agent = await prisma.agentScore.findUnique({
    where: { walletAddress: "0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D" }
  })
  console.log(JSON.stringify(agent, null, 2))
}
main().finally(() => prisma.$disconnect())
