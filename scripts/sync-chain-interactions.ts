import { createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Virtuals ACP Contract on Base
const ACP_CONTRACT = '0xa6C9BA866992cfD7fd6460ba912bfa405adA9df0';

async function main() {
  console.log('🔗 Connecting to Base Mainnet...');
  const client = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  console.log('📡 Scanning for OutcomeReported events...');

  // Scan last 10,000 blocks (~35 hours)
  const currentBlock = await client.getBlockNumber();
  const fromBlock = currentBlock - 10000n;

  const logs = await client.getLogs({
    address: ACP_CONTRACT as `0x${string}`,
    event: parseAbiItem('event OutcomeReported(address indexed buyer, address indexed seller, uint256 jobId, uint8 result)'),
    fromBlock,
    toBlock: currentBlock,
  });

  console.log(`✅ Found ${logs.length} on-chain interactions!`);

  if (logs.length === 0) return;

  const reports = logs.map((log: any) => ({
    buyerAddress: log.args.buyer.toLowerCase(),
    sellerAddress: log.args.seller.toLowerCase(),
    jobId: log.args.jobId.toString(),
    result: log.args.result === 1 ? 'success' : 'failed',
    createdAt: new Date(),
  }));

  console.log(`💾 Syncing ${reports.length} reports to database...`);

  const result = await prisma.outcomeReport.createMany({
    data: reports,
    skipDuplicates: true,
  });

  console.log(`🎉 Successfully synced ${result.count} new on-chain relationships!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
