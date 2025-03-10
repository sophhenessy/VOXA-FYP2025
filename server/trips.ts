import express from "express";
import { db } from "@db";
import { trips, tripPlaces, users } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";

const router = express.Router();

// Middleware to ensure user is authenticated
function ensureAuthenticated(req: any, res: any, next: any) {
  console.log('Trips auth check:', {
    isAuthenticated: req.isAuthenticated?.(),
    userId: req.user?.id,
    session: req.session
  });

  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}

// Get public trips - no authentication required
router.get("/public", async (req, res) => {
  try {
    console.log('Fetching public trips');
    const publicTrips = await db.query.trips.findMany({
      where: eq(trips.isPublic, true),
      orderBy: [desc(trips.createdAt)],
    });

    console.log('Found public trips:', publicTrips);

    // For each trip, count the number of places
    const tripsWithPlacesCount = await Promise.all(
      publicTrips.map(async (trip) => {
        const places = await db.query.tripPlaces.findMany({
          where: eq(tripPlaces.tripId, trip.id),
        });

        // Get the username for each trip
        const user = await db.query.users.findFirst({
          where: eq(users.id, trip.userId),
          columns: {
            username: true,
          },
        });

        console.log(`Processing trip ${trip.id}:`, {
          places: places.length,
          username: user?.username
        });

        return {
          ...trip,
          username: user?.username,
          placesCount: places.length,
        };
      })
    );

    console.log('Sending processed trips:', tripsWithPlacesCount);
    res.json(tripsWithPlacesCount);
  } catch (error) {
    console.error("Error fetching public trips:", error);
    res.status(500).json({ error: "Failed to fetch public trips" });
  }
});

// Get shared/public trip by ID - no authentication required
router.get("/shared/:id", async (req, res) => {
  try {
    console.log('Fetching shared trip:', req.params.id);
    const trip = await db.query.trips.findFirst({
      where: and(
        eq(trips.id, parseInt(req.params.id)),
        eq(trips.isPublic, true)
      ),
    });

    if (!trip) {
      return res.status(404).json({ error: "Trip not found or is private" });
    }

    // Get the username for the trip
    const user = await db.query.users.findFirst({
      where: eq(users.id, trip.userId),
      columns: {
        username: true,
      },
    });

    // Get the places for this trip
    const places = await db.query.tripPlaces.findMany({
      where: eq(tripPlaces.tripId, trip.id),
    });

    console.log('Found shared trip:', { ...trip, username: user?.username, places });

    res.json({ 
      ...trip, 
      username: user?.username,
      places 
    });
  } catch (error) {
    console.error("Error fetching shared trip:", error);
    res.status(500).json({ error: "Failed to fetch shared trip" });
  }
});

// Get all trips for the current user
router.get("/", ensureAuthenticated, async (req, res) => {
  try {
    console.log('Fetching trips for user:', req.user!.id);

    const userTrips = await db.query.trips.findMany({
      where: eq(trips.userId, req.user!.id),
      orderBy: [desc(trips.createdAt)],
    });

    console.log('Found trips:', userTrips);
    res.json(userTrips);
  } catch (error) {
    console.error("Error fetching trips:", error);
    res.status(500).json({ error: "Failed to fetch trips" });
  }
});

// Get a single trip by ID (for authenticated users)
router.get("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const trip = await db.query.trips.findFirst({
      where: eq(trips.id, parseInt(req.params.id)),
    });

    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }

    if (trip.userId !== req.user!.id) {
      return res.status(403).json({ error: "Not authorized to view this trip" });
    }

    // Get the places for this trip
    const places = await db.query.tripPlaces.findMany({
      where: eq(tripPlaces.tripId, trip.id),
    });

    res.json({ ...trip, places });
  } catch (error) {
    console.error("Error fetching trip:", error);
    res.status(500).json({ error: "Failed to fetch trip" });
  }
});

// Create a new trip
router.post("/", ensureAuthenticated, async (req, res) => {
  try {
    console.log('Creating new trip for user:', req.user!.id);
    console.log('Trip data:', req.body);

    const { name, description, startDate, endDate, isPublic } = req.body;

    const [newTrip] = await db.insert(trips).values({
      userId: req.user!.id,
      name,
      description,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      isPublic: isPublic || false,
    }).returning();

    console.log('Created trip:', newTrip);
    res.json(newTrip);
  } catch (error) {
    console.error("Error creating trip:", error);
    res.status(500).json({ error: "Failed to create trip" });
  }
});

// Update trip details
router.patch("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, startDate, endDate, isPublic } = req.body;

    const trip = await db.query.trips.findFirst({
      where: eq(trips.id, parseInt(id)),
    });

    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }

    if (trip.userId !== req.user!.id) {
      return res.status(403).json({ error: "Not authorized to update this trip" });
    }

    const [updatedTrip] = await db
      .update(trips)
      .set({
        name: name !== undefined ? name : trip.name,
        description: description !== undefined ? description : trip.description,
        startDate: startDate !== undefined ? startDate : trip.startDate,
        endDate: endDate !== undefined ? endDate : trip.endDate,
        isPublic: isPublic !== undefined ? isPublic : trip.isPublic,
      })
      .where(eq(trips.id, parseInt(id)))
      .returning();

    res.json(updatedTrip);
  } catch (error) {
    console.error("Error updating trip:", error);
    res.status(500).json({ error: "Failed to update trip" });
  }
});

export const tripsRouter = router;