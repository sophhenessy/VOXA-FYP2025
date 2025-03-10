import express from "express";
import { db } from "@db";
import { users, follows, trips, reviews } from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type { Request } from "express";

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
  isAuthenticated(): boolean;
}

// Get user's social stats
router.get("/users/:username/stats", async (req: AuthenticatedRequest, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get follower counts using separate queries for better accuracy
    const followersCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, user.id))
      .then(result => Number(result[0].count));

    const followingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerId, user.id))
      .then(result => Number(result[0].count));

    res.json({
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error("Error fetching social stats:", error);
    res.status(500).json({ error: "Failed to fetch social stats" });
  }
});

// Get public profile data
router.get("/users/:username/public", async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
      columns: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        location: true,
        avatarUrl: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get follower counts
    const followersCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, user.id))
      .then(result => result[0].count);

    const followingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerId, user.id))
      .then(result => result[0].count);

    // Get public trips count
    const publicTripsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(trips)
      .where(and(
        eq(trips.userId, user.id),
        eq(trips.isPublic, true)
      ))
      .then(result => result[0].count);

    // Get public reviews count
    const publicReviewsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(and(
        eq(reviews.userId, user.id),
        eq(reviews.isPublic, true)
      ))
      .then(result => result[0].count);

    // Check if the current user is following this profile
    let isFollowing = false;
    const authenticatedReq = req as AuthenticatedRequest;
    if (authenticatedReq.isAuthenticated() && authenticatedReq.user) {
      const followRecord = await db.query.follows.findFirst({
        where: and(
          eq(follows.followerId, authenticatedReq.user.id),
          eq(follows.followingId, user.id)
        ),
      });
      isFollowing = !!followRecord;
    }

    res.json({
      ...user,
      followersCount,
      followingCount,
      publicTripsCount,
      publicReviewsCount,
      isFollowing,
    });
  } catch (error) {
    console.error("Error fetching public profile:", error);
    res.status(500).json({ error: "Failed to fetch public profile" });
  }
});

// Get user profile with follower counts
router.get("/users/:username", async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
      columns: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        location: true,
        avatarUrl: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get follower counts
    const followersCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, user.id))
      .then(result => result[0].count);

    const followingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerId, user.id))
      .then(result => result[0].count);

    // Check if the current user is following this profile
    let isFollowing = false;
    const authenticatedReq = req as AuthenticatedRequest;
    if (authenticatedReq.isAuthenticated() && authenticatedReq.user) {
      const followRecord = await db.query.follows.findFirst({
        where: and(
          eq(follows.followerId, authenticatedReq.user.id),
          eq(follows.followingId, user.id)
        ),
      });
      isFollowing = !!followRecord;
    }

    res.json({
      ...user,
      followersCount,
      followingCount,
      isFollowing,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Follow a user
router.post("/social/follow/:userId", async (req: AuthenticatedRequest, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const targetUserId = parseInt(req.params.userId);

    if (targetUserId === req.user!.id) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if already following
    const existingFollow = await db.query.follows.findFirst({
      where: and(
        eq(follows.followerId, req.user!.id),
        eq(follows.followingId, targetUserId)
      ),
    });

    if (existingFollow) {
      return res.status(400).json({ error: "Already following this user" });
    }

    // Create follow relationship
    await db.insert(follows).values({
      followerId: req.user!.id,
      followingId: targetUserId,
    });

    res.json({ message: "Successfully followed user" });
  } catch (error) {
    console.error("Error following user:", error);
    res.status(500).json({ error: "Failed to follow user" });
  }
});

// Unfollow a user
router.post("/social/unfollow/:userId", async (req: AuthenticatedRequest, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const targetUserId = parseInt(req.params.userId);

    if (targetUserId === req.user!.id) {
      return res.status(400).json({ error: "Cannot unfollow yourself" });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete follow relationship
    await db.delete(follows)
      .where(
        and(
          eq(follows.followerId, req.user!.id),
          eq(follows.followingId, targetUserId)
        )
      );

    res.json({ message: "Successfully unfollowed user" });
  } catch (error) {
    console.error("Error unfollowing user:", error);
    res.status(500).json({ error: "Failed to unfollow user" });
  }
});

// Get user's followers
router.get("/users/:username/followers", async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const followers = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, user.id));

    res.json(followers);
  } catch (error) {
    console.error("Error fetching followers:", error);
    res.status(500).json({ error: "Failed to fetch followers" });
  }
});

// Get users being followed by user
router.get("/users/:username/following", async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const following = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, user.id));

    res.json(following);
  } catch (error) {
    console.error("Error fetching following:", error);
    res.status(500).json({ error: "Failed to fetch following" });
  }
});

// Get user's public trips
router.get("/users/:username/trips", async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userTrips = await db.query.trips.findMany({
      where: and(
        eq(trips.userId, user.id),
        eq(trips.isPublic, true)
      ),
      orderBy: [desc(trips.createdAt)],
    });

    res.json(userTrips);
  } catch (error) {
    console.error("Error fetching user trips:", error);
    res.status(500).json({ error: "Failed to fetch user trips" });
  }
});

// Get user's reviews
router.get("/users/:username/reviews", async (req, res) => {
  try {
    console.log('Fetching reviews for username:', req.params.username);

    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
    });

    if (!user) {
      console.log('User not found:', req.params.username);
      return res.status(404).json({ error: "User not found" });
    }

    console.log('Found user:', user.id);

    // Get all reviews for the user, both public and private
    const userReviews = await db.query.reviews.findMany({
      where: eq(reviews.userId, user.id),
      orderBy: [desc(reviews.createdAt)],
      columns: {
        id: true,
        placeId: true,
        rating: true,
        comment: true,
        createdAt: true,
        placeName: true,
        location: true,
        isPublic: true
      }
    });

    console.log('Found reviews:', userReviews);

    res.json(userReviews);
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    res.status(500).json({ error: "Failed to fetch user reviews" });
  }
});

export const socialRouter = router;