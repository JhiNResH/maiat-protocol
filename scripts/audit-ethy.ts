import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- ETHY INTERACTION AUDIT ---');
  
  // Find Ethy
  const ethy = await prisma.project.findFirst({
    where: { name: { contains: 'ethy', mode: 'insensitive' } }
  });

  if (!ethy) {
    console.log('❌ Ethy project not found in database.');
    return;
  }

  const addr = ethy.address.toLowerCase();
  console.log(`Found Ethy: ${ethy.name} (${addr})`);

  // Count interactions
  const asSeller = await prisma.outcomeReport.count({
    where: { sellerAddress: addr }
  });
  const asBuyer = await prisma.outcomeReport.count({
    where: { buyerAddress: addr }
  });

  console.log(`Interactions as Seller: ${asSeller}`);
  console.log(`Interactions as Buyer: ${asBuyer}`);

  // Sample relations
  const sample = await prisma.outcomeReport.findMany({
    where: {
      OR: [
        { sellerAddress: addr },
        { buyerAddress: addr }
      ]
    },
    take: 5
  });

  console.log('Sample relations raw data:');
  console.log(JSON.stringify(sample, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
