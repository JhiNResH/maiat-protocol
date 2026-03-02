import { PrismaClient } from '@prisma/client';
import { runAcpIndexer } from './src/lib/acp-indexer.ts';

const prisma = new PrismaClient();
console.log('Starting ACP Indexer...');
try {
  const result = await runAcpIndexer({ prisma, verbose: true, dryRun: false });
  console.log('\n✅ Result:', JSON.stringify(result, null, 2));
} catch(e) {
  console.error('Error:', e);
} finally {
  await prisma.$disconnect();
}
