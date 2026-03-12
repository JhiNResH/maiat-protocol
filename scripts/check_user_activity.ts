
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== User Activity Report ===');

  const users = await prisma.user.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5
  });
  console.log('\n--- Latest Active Users ---');
  users.forEach((u: any) => console.log(`${u.address} | Rep: ${u.reputationScore} | Reviews: ${u.totalReviews}`));

  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { project: true, reviewer: true }
  });
  console.log('\n--- Latest Reviews (Review Model) ---');
  reviews.forEach((r: any) => console.log(`[${r.createdAt.toISOString()}] User ${r.reviewer.address.slice(0,6)} on Project ${r.project.name}: ${r.content.substring(0, 50)}...`));

  const trustReviews = await prisma.trustReview.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('\n--- Latest TrustReviews (TrustReview Model) ---');
  trustReviews.forEach((tr: any) => console.log(`[${tr.createdAt.toISOString()}] Reviewer ${tr.reviewer.slice(0,6)} on ${tr.address.slice(0,6)}: Rating ${tr.rating}`));

  const votes = await prisma.vote.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { voter: true }
  });
  console.log('\n--- Latest Votes (Vote Model) ---');
  votes.forEach((v: any) => console.log(`[${v.createdAt.toISOString()}] User ${v.voter.address.slice(0,6)} voted ${v.direction}`));

  const marketPositions = await prisma.marketPosition.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('\n--- Latest Market Positions ---');
  marketPositions.forEach((mp: any) => console.log(`[${mp.createdAt.toISOString()}] User ${mp.voterId.slice(0,6)} bet ${mp.amount} on Project/Market ${mp.projectId}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
