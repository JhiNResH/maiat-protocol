import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function buildDatasourceUrl(): string | undefined {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return undefined // no DB configured — routes handle gracefully
  return dbUrl.includes('sslmode') ? dbUrl : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}sslmode=require`
}

const datasourceUrl = buildDatasourceUrl()

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/** true when a real DATABASE_URL is configured */
export const dbAvailable = !!datasourceUrl
