import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const agents = await prisma.agentScore.findMany({
    where: {
      rawMetrics: {
        path: ['name'],
        string_contains: 'Maiat'
      }
    }
  })
  console.log(JSON.stringify(agents, null, 2))
}
main().finally(() => prisma.$disconnect())
