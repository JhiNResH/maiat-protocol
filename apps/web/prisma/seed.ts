/**
 * Maiat Seed — Data Cleanup Only
 * Clears old data to allow for fresh indexing.
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Clearing all data...')

  await prisma.vote.deleteMany({})
  await prisma.review.deleteMany({})
  await prisma.project.deleteMany({})
  await prisma.user.deleteMany({})
  
  console.log('✅ Done! Database is clean.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
