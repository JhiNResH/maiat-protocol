import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up mock interaction reports...');
  const result = await prisma.outcomeReport.deleteMany({
    where: {
      notes: 'Mocked successful task execution for visualization'
    }
  });
  console.log(`Successfully deleted ${result.count} mock records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
