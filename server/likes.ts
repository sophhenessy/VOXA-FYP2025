import { Router } from "express";
import { db } from "@db";
import { likes } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

// Verify user middleware
const requireAuth = (req: any, res: any, next: any) => {
  console.log('Likes auth check:', {
    isAuthenticated: req.isAuthenticated?.(),
    userId: req.user?.id
  });

  if (!req.user?.id) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
};

// Add JSON handling middleware
router.use(requireAuth);
router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Get user's liked places
router.get("/likes", async (req, res) => {
  try {
    const userId = (req.user as any).id;
    console.log('Fetching likes for user:', userId);

    const userLikes = await db.select({
      id: likes.id,
      placeId: likes.placeId,
      placeName: likes.placeName,
      placeAddress: likes.placeAddress,
      placeType: likes.placeType,
      rating: likes.rating,
      priceLevel: likes.priceLevel,
      createdAt: likes.createdAt
    })
    .from(likes)
    .where(eq(likes.userId, userId))
    .orderBy(desc(likes.createdAt));

    console.log('Found likes:', userLikes);
    res.json(userLikes || []);
  } catch (error) {
    console.error('Error fetching likes:', error);
    res.status(500).json({ 
      error: "Failed to fetch likes",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Add a like
router.post("/likes", async (req, res) => {
  try {
    console.log('Received like request body:', req.body); // Debug log

    const { placeId, placeName, placeAddress, placeType, rating, priceLevel } = req.body;
    const userId = (req.user as any).id;

    // Validate required fields
    if (!placeId || !placeName) {
      console.error('Missing required fields:', { placeId, placeName });
      return res.status(400).json({ 
        error: "Missing required fields",
        details: {
          placeId: !placeId ? "Place ID is required" : null,
          placeName: !placeName ? "Place name is required" : null
        }
      });
    }

    // Check if already liked
    const existingLike = await db.select()
      .from(likes)
      .where(and(
        eq(likes.userId, userId),
        eq(likes.placeId, placeId)
      ))
      .limit(1);

    if (existingLike.length > 0) {
      return res.status(400).json({ error: "Place already liked" });
    }

    // Insert new like
    console.log('Inserting like with data:', {
      userId,
      placeId,
      placeName,
      placeAddress,
      placeType,
      rating,
      priceLevel
    });

    const result = await db.insert(likes).values({
      userId,
      placeId,
      placeName,
      placeAddress,
      placeType,
      rating,
      priceLevel,
      createdAt: new Date(),
    });

    console.log('Insert result:', result);
    res.json({ message: "Place liked successfully" });
  } catch (error) {
    console.error('Error liking place:', error);
    res.status(500).json({ 
      error: "Failed to like place",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Unlike a place
router.delete("/likes/:placeId", async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const placeId = req.params.placeId;

    await db.delete(likes)
      .where(and(
        eq(likes.userId, userId),
        eq(likes.placeId, placeId)
      ));

    res.json({ message: "Place unliked successfully" });
  } catch (error) {
    console.error('Error unliking place:', error);
    res.status(500).json({ 
      error: "Failed to unlike place",
      details: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

export { router as likesRouter };