function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number | undefined {
  try {
    // Validate coordinates
    const coords = [lat1, lon1, lat2, lon2];
    if (coords.some(coord => coord === undefined || coord === null || isNaN(coord))) {
      console.log('Invalid coordinates:', { lat1, lon1, lat2, lon2 });
      return undefined;
    }

    // Convert to radians
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lon1Rad = (lon1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const lon2Rad = (lon2 * Math.PI) / 180;

    // Haversine formula
    const R = 6371; // Earth's radius in kilometers
    const dLat = lat2Rad - lat1Rad;
    const dLon = lon2Rad - lon1Rad;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Number(distance.toFixed(1));
  } catch (error) {
    console.error('Error calculating distance:', error);
    return undefined;
  }
}

// Helper function to validate and process location data
function processLocation(
  location: any,
  userLat?: number,
  userLng?: number
): LocationData | null {
  try {
    // Basic validation
    if (!location || typeof location !== 'object') {
      console.log('Invalid location object:', location);
      return null;
    }

    // Validate coordinates
    if (!location.coordinates?.lat || !location.coordinates?.lng) {
      console.log('Missing coordinates:', location);
      return null;
    }

    const processedLocation: LocationData = {
      coordinates: {
        lat: Number(location.coordinates.lat),
        lng: Number(location.coordinates.lng)
      },
      formatted_address: location.formatted_address || '',
    };

    // Calculate distance if user coordinates are provided
    if (typeof userLat === 'number' && typeof userLng === 'number') {
      const distance = calculateDistance(
        userLat,
        userLng,
        processedLocation.coordinates.lat,
        processedLocation.coordinates.lng
      );

      if (distance !== undefined) {
        processedLocation.distance = distance;
        console.log('Calculated distance:', distance, 'km');
      }
    }

    return processedLocation;
  } catch (error) {
    console.error('Error processing location:', error);
    return null;
  }
}

import { Router } from "express";
import { db } from "../db";
import { reviews, users, reviewLikes, follows, groupMembers } from "../db/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";

const router = Router();

interface LocationData {
  coordinates: {
    lat: number;
    lng: number;
  };
  formatted_address: string;
  distance?: number;
  city?: string;
  country?: string;
}

// Get community reviews
router.get("/community", async (req: any, res) => {
  try {
    // Check authentication first
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = req.user?.id;
    const userLat = req.query.userLat ? parseFloat(req.query.userLat) : undefined;
    const userLng = req.query.userLng ? parseFloat(req.query.userLng) : undefined;

    console.log('Processing community reviews with coordinates:', { userLat, userLng });

    const communityReviews = await db
      .select({
        id: reviews.id,
        placeId: reviews.placeId,
        placeName: reviews.placeName,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        username: users.username,
        location: reviews.location,
        groupId: reviews.groupId,
        groupName: sql<string>`(
          SELECT name FROM ${groupMembers}
          JOIN groups ON groups.id = group_members.group_id
          WHERE group_members.group_id = ${reviews.groupId}
          LIMIT 1
        )`.as('group_name'),
        likes: count(reviewLikes.id).as('likes_count'),
        isLiked: userId ?
          sql<boolean>`EXISTS (
            SELECT 1 FROM ${reviewLikes} rl
            WHERE rl.review_id = ${reviews.id}
            AND rl.user_id = ${userId}
          )`.as('is_liked') :
          sql<boolean>`false`.as('is_liked')
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .leftJoin(reviewLikes, eq(reviews.id, reviewLikes.reviewId))
      .where(eq(reviews.isPublic, true))
      .groupBy(
        reviews.id,
        users.id,
        users.username,
        reviews.placeId,
        reviews.placeName,
        reviews.rating,
        reviews.comment,
        reviews.createdAt,
        reviews.location,
        reviews.groupId
      )
      .orderBy(desc(reviews.createdAt));

    const formattedReviews = communityReviews.map(review => {
      const location = review.location ? processLocation(review.location, userLat, userLng) : null;
      return {
        ...review,
        location
      };
    });

    res.json(formattedReviews);
  } catch (error) {
    console.error('Error fetching community reviews:', error);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

// Get following reviews
router.get("/following", async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    console.log('Fetching following reviews for user:', req.user.id);
    const userLat = req.query.userLat ? parseFloat(req.query.userLat) : undefined;
    const userLng = req.query.userLng ? parseFloat(req.query.userLng) : undefined;

    const followingReviews = await db
      .select({
        id: reviews.id,
        placeId: reviews.placeId,
        placeName: reviews.placeName,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        username: users.username,
        location: reviews.location,
        likes: count(reviewLikes.id).as('likes_count'),
        isLiked: sql<boolean>`EXISTS (
          SELECT 1 FROM ${reviewLikes} rl
          WHERE rl.review_id = ${reviews.id}
          AND rl.user_id = ${req.user.id}
        )`.as('is_liked')
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .leftJoin(reviewLikes, eq(reviews.id, reviewLikes.reviewId))
      .innerJoin(follows, eq(reviews.userId, follows.followingId))
      .where(and(
        eq(follows.followerId, req.user.id),
        eq(reviews.isPublic, true)
      ))
      .groupBy(
        reviews.id,
        users.id,
        users.username,
        reviews.placeId,
        reviews.placeName,
        reviews.rating,
        reviews.comment,
        reviews.createdAt,
        reviews.location
      )
      .orderBy(desc(reviews.createdAt));

    console.log('Found following reviews:', followingReviews.length);

    const formattedReviews = followingReviews.map(review => ({
      ...review,
      location: review.location ? processLocation(review.location, userLat, userLng) : null
    }));

    res.json(formattedReviews);
  } catch (error) {
    console.error('Error fetching following reviews:', error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Get place reviews
router.get("/place/:placeId", async (req: any, res) => {
  try {
    const { placeId } = req.params;
    const userLat = req.query.userLat ? parseFloat(req.query.userLat) : undefined;
    const userLng = req.query.userLng ? parseFloat(req.query.userLng) : undefined;

    console.log('Processing request with coordinates:', { userLat, userLng });

    // Allow unauthenticated access to place reviews
    const userId = req.user?.id;

    const placeReviews = await db
      .select({
        id: reviews.id,
        placeId: reviews.placeId,
        placeName: reviews.placeName,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        username: users.username,
        location: reviews.location,
        likes: count(reviewLikes.id).as('likes_count'),
        isLiked: userId ?
          sql<boolean>`EXISTS (
            SELECT 1 FROM ${reviewLikes} rl
            WHERE rl.review_id = ${reviews.id}
            AND rl.user_id = ${userId}
          )`.as('is_liked') :
          sql<boolean>`false`.as('is_liked')
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .leftJoin(reviewLikes, eq(reviews.id, reviewLikes.reviewId))
      .where(eq(reviews.placeId, placeId))
      .groupBy(
        reviews.id,
        users.id,
        users.username,
        reviews.placeId,
        reviews.placeName,
        reviews.rating,
        reviews.comment,
        reviews.createdAt,
        reviews.location
      )
      .orderBy(desc(reviews.createdAt));

    const formattedReviews = placeReviews.map(review => ({
      ...review,
      location: review.location ? processLocation(review.location, userLat, userLng) : null
    }));

    console.log('Sending formatted reviews:', formattedReviews);
    res.json(formattedReviews);
  } catch (error) {
    console.error('Error fetching place reviews:', error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Like a review
router.post("/:reviewId/like", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { reviewId } = req.params;

    // Check if already liked
    const existingLike = await db.select()
      .from(reviewLikes)
      .where(and(
        eq(reviewLikes.reviewId, parseInt(reviewId)),
        eq(reviewLikes.userId, req.user.id)
      ))
      .limit(1);

    if (existingLike.length > 0) {
      return res.status(400).json({ message: "Already liked this review" });
    }

    await db.insert(reviewLikes).values({
      reviewId: parseInt(reviewId),
      userId: req.user.id
    });

    res.status(201).json({ message: "Review liked successfully" });
  } catch (error) {
    console.error('Error liking review:', error);
    res.status(500).json({ message: "Failed to like review" });
  }
});

// Unlike a review
router.delete("/:reviewId/like", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { reviewId } = req.params;

    await db.delete(reviewLikes)
      .where(and(
        eq(reviewLikes.reviewId, parseInt(reviewId)),
        eq(reviewLikes.userId, req.user.id)
      ));

    res.status(204).send();
  } catch (error) {
    console.error('Error unliking review:', error);
    res.status(500).json({ message: "Failed to unlike review" });
  }
});

// Get user reviews
router.get("/", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const userReviews = await db
      .select({
        id: reviews.id,
        placeId: reviews.placeId,
        placeName: reviews.placeName,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        likes: count(reviewLikes.id)
      })
      .from(reviews)
      .leftJoin(reviewLikes, eq(reviews.id, reviewLikes.reviewId))
      .where(eq(reviews.userId, req.user.id))
      .groupBy(reviews.id)
      .orderBy(desc(reviews.createdAt));
    res.json(userReviews);
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});


// Post a new review
router.post("/", async (req: any, res) => {
  try {
    console.log('Review submission started');
    if (!req.user?.id) {
      console.log('User not authenticated');
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { placeId, rating, comment, placeName, location, groupId } = req.body;
    console.log('Received review data:', { 
      placeId, 
      rating, 
      comment, 
      placeName, 
      location,
      groupId,
      userId: req.user.id 
    });

    if (!placeId || !rating) {
      console.log('Missing required fields:', { placeId, rating });
      return res.status(400).json({ error: "Missing required fields" });
    }

    // If groupId is provided, verify user is a member of the group
    if (groupId) {
      console.log('Verifying group membership:', { groupId, userId: req.user.id });
      const groupMember = await db
        .select()
        .from(groupMembers)
        .where(and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, req.user.id)
        ))
        .limit(1);

      if (groupMember.length === 0) {
        console.log('User not a member of group');
        return res.status(403).json({ error: "Not a member of this group" });
      }
    }

    const processedLocation = processLocation(location);
    if (!processedLocation) {
      console.error('Invalid location data:', location);
      return res.status(400).json({ error: "Invalid location data" });
    }

    console.log('Processed location:', processedLocation);

    console.log('Attempting to insert review into database');
    const [newReview] = await db
      .insert(reviews)
      .values({
        userId: req.user.id,
        placeId,
        rating,
        comment: comment || '',
        placeName: placeName || null,
        location: processedLocation,
        isPublic: true,
        groupId: groupId || null
      })
      .returning();

    console.log('Review created successfully:', newReview);

    // Fetch the username for the response
    const user = await db
      .select({
        username: users.username
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    const createdReview = {
      ...newReview,
      username: user[0].username,
      location: processedLocation,
      likes: 0,
      isLiked: false
    };

    console.log('Sending response:', createdReview);
    res.status(201).json(createdReview);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: "Failed to create review" });
  }
});

// Update a review
router.put("/:id", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { id } = req.params;
    const { rating, comment } = req.body;

    // Verify review ownership
    const review = await db
      .select()
      .from(reviews)
      .where(and(
        eq(reviews.id, parseInt(id)),
        eq(reviews.userId, req.user.id)
      ))
      .limit(1);

    if (review.length === 0) {
      return res.status(403).json({ message: "Not authorized to update this review" });
    }

    const updatedReview = await db
      .update(reviews)
      .set({ rating, comment })
      .where(eq(reviews.id, parseInt(id)))
      .returning();
    res.json(updatedReview[0]);
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: "Failed to update review" });
  }
});

// Delete a review
router.delete("/:id", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { id } = req.params;

    // Verify review ownership
    const review = await db
      .select()
      .from(reviews)
      .where(and(
        eq(reviews.id, parseInt(id)),
        eq(reviews.userId, req.user.id)
      ))
      .limit(1);

    if (review.length === 0) {
      return res.status(403).json({ message: "Not authorized to delete this review" });
    }

    // First delete associated likes
    await db.delete(reviewLikes)
      .where(eq(reviewLikes.reviewId, parseInt(id)));

    // Then delete the review
    await db.delete(reviews)
      .where(eq(reviews.id, parseInt(id)));

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: "Failed to delete review" });
  }
});

// Search users
router.get("/search/users", async (req: any, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.json([]);
    }

    const searchResults = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
      })
      .from(users)
      .where(
        sql`LOWER(${users.username}) LIKE LOWER(${'%' + query + '%'}) 
        OR LOWER(${users.displayName}) LIKE LOWER(${'%' + query + '%'})`
      )
      .limit(10);

    res.json(searchResults);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: "Failed to search users" });
  }
});

export default router;