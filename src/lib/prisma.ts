import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Ensure SSL for production (Supabase requires it)
const dbUrl = process.env.DATABASE_URL || ''
const datasourceUrl = dbUrl.includes('sslmode') ? dbUrl : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}sslmode=require`

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasourceUrl,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
