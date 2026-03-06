import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- MAIAT PROJECT RELATIONSHIP MAP ---');
  
  const interactions = await prisma.outcomeReport.groupBy({
    by: ['buyerAddress', 'sellerAddress'],
    _count: {
      id: true
    },
    where: {
      result: 'success'
    },
    orderBy: {
      _count: {
        id: 'desc'
      }
    },
    take: 20
  });

  const addresses = new Set();
  interactions.forEach(i => {
    addresses.add(i.buyerAddress.toLowerCase());
    addresses.add(i.sellerAddress.toLowerCase());
  });

  const projects = await prisma.project.findMany({
    where: {
      address: {
        in: Array.from(addresses) as string[]
      }
    },
    select: {
      address: true,
      name: true
    }
  });

  const nameMap = new Map();
  projects.forEach(p => nameMap.set(p.address.toLowerCase(), p.name));

  console.log('Top Successful Collaborations:');
  interactions.forEach(i => {
    const buyer = nameMap.get(i.buyerAddress.toLowerCase()) || i.buyerAddress.slice(0, 10);
    const seller = nameMap.get(i.sellerAddress.toLowerCase()) || i.sellerAddress.slice(0, 10);
    console.log(`[Buyer] ${buyer.padEnd(20)} -> [Seller] ${seller.padEnd(20)} | Jobs: ${i._count.id}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
