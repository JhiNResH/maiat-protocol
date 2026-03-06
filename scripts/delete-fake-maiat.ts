import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const maiatAddress = "0xMa1a7AceDefAceDefAceDefAceDefAceDefAce";
  
  await prisma.agentScore.deleteMany({
    where: { walletAddress: maiatAddress }
  })
  
  await prisma.project.deleteMany({
    where: { slug: 'maiat-protocol' }
  })
  
  console.log('✅ Deleted fake Maiat entries.')
}
main().finally(() => prisma.$disconnect())
