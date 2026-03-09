import { PrismaClient } from "@prisma/client";
import { scoreReviewQuality } from "@/lib/review-quality";

const prisma = new PrismaClient();

async function main() {
  const reviews = await prisma.trustReview.findMany({
    select: { id: true, address: true, rating: true, comment: true, qualityScore: true },
  });
  
  console.log(`Found ${reviews.length} reviews to rescore`);
  
  for (const r of reviews) {
    const result = await scoreReviewQuality({
      address: r.address,
      rating: r.rating,
      comment: r.comment,
    });
    
    await prisma.trustReview.update({
      where: { id: r.id },
      data: { qualityScore: result.qualityScore },
    });
    
    console.log(`${r.id}: ${r.qualityScore} → ${result.qualityScore} | "${(r.comment ?? '').slice(0, 50)}..."`);
  }
  
  console.log("Done");
  await prisma.$disconnect();
}

main().catch(console.error);
