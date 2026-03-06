import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const agents = await prisma.agentScore.findMany({
    where: {
      OR: [
        { walletAddress: { contains: 'maiat', mode: 'insensitive' } },
        { rawMetrics: { path: ['name'], string_contains: 'maiat' } }
      ]
    }
  })
  console.log(JSON.stringify(agents, null, 2))
}
main().finally(() => prisma.$disconnect())
