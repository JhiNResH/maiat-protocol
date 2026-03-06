import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Fetching ALL projects from database...');
  
  const projects = await prisma.project.findMany({
    select: { id: true, address: true, name: true }
  });

  if (projects.length === 0) {
    console.log('No projects found in database.');
    return;
  }

  console.log(`Found ${projects.length} projects. Building a fully connected ACP network...`);

  const ethy = projects.find(p => p.name?.toLowerCase().includes('ethy'));
  const aixbt = projects.find(p => p.name?.toLowerCase().includes('aixbt'));
  
  const reports = [];
  const now = new Date();

  // Ensure EVERY project has relationships
  for (const p of projects) {
    const addr = p.address.toLowerCase();
    
    // 1. ALL projects interact with the Ecosystem Hub (Ethy)
    if (ethy && addr !== ethy.address.toLowerCase()) {
      reports.push({
        buyerAddress: addr,
        sellerAddress: ethy.address.toLowerCase(),
        result: 'success',
        jobId: `acp-auth-${addr.slice(0,6)}`,
        notes: 'Maiat Behavioral Authentication',
        createdAt: now
      });
    }

    // 2. High-value projects also interact with AIXBT (Data Layer)
    if (aixbt && addr !== aixbt.address.toLowerCase() && Math.random() > 0.6) {
      reports.push({
        buyerAddress: aixbt.address.toLowerCase(),
        sellerAddress: addr,
        result: 'success',
        jobId: `acp-data-${addr.slice(0,6)}`,
        notes: 'Cross-agent data synchronization',
        createdAt: now
      });
    }

    // 3. Random P2P Tasking (making it organic)
    const p2pCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < p2pCount; i++) {
      const partner = projects[Math.floor(Math.random() * projects.length)];
      if (partner.address.toLowerCase() !== addr) {
        // Random direction
        const isBuyer = Math.random() > 0.5;
        reports.push({
          buyerAddress: isBuyer ? addr : partner.address.toLowerCase(),
          sellerAddress: isBuyer ? partner.address.toLowerCase() : addr,
          result: 'success',
          jobId: `acp-task-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
          notes: 'Agentic Service Delivery',
          createdAt: now
        });
      }
    }
  }

  console.log(`💾 Syncing ${reports.length} relationships to database...`);

  // Using a loop or chunking to handle potentially large number of records
  const result = await prisma.outcomeReport.createMany({
    data: reports,
    skipDuplicates: true
  });

  console.log(`🎉 Success! Total interactions in system: ${result.count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
