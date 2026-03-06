import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const agents = await prisma.agentScore.findMany({
    where: {
      OR: [
        { rawMetrics: { path: ['id'], equals: 18281 } },
        { rawMetrics: { path: ['id'], equals: "18281" } }
      ]
    }
  })
  console.log(JSON.stringify(agents, null, 2))
}
main().finally(() => prisma.$disconnect())
