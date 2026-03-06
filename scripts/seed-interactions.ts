import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching projects (agents)...');
  // Get top 20 projects to form a nice cluster
  const projects = await prisma.project.findMany({
    take: 20,
    select: { id: true, address: true, name: true }
  });

  if (projects.length < 2) {
    console.log('Not enough projects to create interactions.');
    return;
  }

  console.log(`Found ${projects.length} projects. Generating mock interactions...`);

  const reports = [];
  
  // Create 50 random interactions between these agents
  for (let i = 0; i < 50; i++) {
    const buyerIndex = Math.floor(Math.random() * projects.length);
    let sellerIndex = Math.floor(Math.random() * projects.length);
    
    // Ensure buyer and seller are different
    while (sellerIndex === buyerIndex) {
      sellerIndex = Math.floor(Math.random() * projects.length);
    }

    const buyer = projects[buyerIndex];
    const seller = projects[sellerIndex];

    reports.push({
      buyerAddress: buyer.address.toLowerCase(),
      sellerAddress: seller.address.toLowerCase(),
      result: 'success',
      jobId: `mock-job-${Date.now()}-${i}`,
      notes: 'Mocked successful task execution for visualization',
      createdAt: new Date(),
    });
  }

  // Insert into DB
  await prisma.outcomeReport.createMany({
    data: reports,
  });

  console.log(`Successfully generated ${reports.length} mock interactions!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
