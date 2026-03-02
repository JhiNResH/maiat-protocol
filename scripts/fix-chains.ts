import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ETH_CONTRACTS: Record<string, string> = {
  '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': 'Ethereum',
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': 'Ethereum',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'Ethereum',
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'Ethereum',
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 'Ethereum',
};

async function main() {
  let fixed = 0;
  for (const [addr, chain] of Object.entries(ETH_CONTRACTS)) {
    const r = await prisma.project.updateMany({
      where: { address: { equals: addr, mode: 'insensitive' }, chain: { not: chain } },
      data: { chain },
    });
    if (r.count > 0) { console.log(`Fixed: ${addr.slice(0,10)}... → ${chain}`); fixed += r.count; }
  }
  console.log(`Done. Fixed: ${fixed} records`);
  await prisma.$disconnect();
}

main().catch(console.error);
