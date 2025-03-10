import { Router } from "express";
import { db } from "@db";
import { likes, recommendations } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const router = Router();

// Helper function to calculate recommendation score
function calculateScore(
  userPreferences: { [key: string]: number },
  placeType: string,
  rating: number,
  priceLevel: number
): number {
  let score = 0;
  
  // Base score from place type preference
  score += (userPreferences[placeType] || 0) * 2;
  
  // Add points for high ratings
  score += rating * 10;
  
  // Price level compatibility (assuming user preference is stored)
  if (userPreferences.preferredPriceLevel === priceLevel) {
    score += 20;
  }
  
  return score;
}

// Get personalized recommendations
router.get("/api/recommendations", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Not logged in" });
    }

    // Get user's liked places
    const userLikes = await db.select()
      .from(likes)
      .where(eq(likes.userId, req.user.id))
      .orderBy(desc(likes.createdAt));

    // Extract preferences from liked places
    const preferences: { [key: string]: number } = {};
    userLikes.forEach(like => {
      if (like.placeType) {
        preferences[like.placeType] = (preferences[like.placeType] || 0) + 1;
      }
    });

    // Generate recommendations based on preferences
    const recommendations = await Promise.all(
      Object.entries(preferences)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3) // Top 3 preferred categories
        .map(async ([placeType]) => {
          // Find similar places in the same category
          const similarPlaces = await db.select()
            .from(likes)
            .where(
              and(
                eq(likes.placeType, placeType),
                sql`${likes.userId} != ${req.user!.id}`
              )
            )
            .limit(5);

          return similarPlaces.map(place => ({
            ...place,
            score: calculateScore(
              preferences,
              place.placeType || '',
              place.rating || 0,
              place.priceLevel || 0
            ),
            reason: `Based on your interest in ${placeType.toLowerCase().replace('_', ' ')} places`
          }));
        })
    );

    // Flatten and sort recommendations by score
    const flattenedRecommendations = recommendations
      .flat()
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Return top 10 recommendations

    res.json(flattenedRecommendations);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
});

export { router as recommendationsRouter };
