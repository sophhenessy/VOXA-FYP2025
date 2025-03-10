import { Router } from "express";
import { db } from "../db";
import { groups, groupMembers, groupMessages, users, reviews } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import multer from "multer";
import path from "path";

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: './uploads/group-avatars',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type'));
      return;
    }
    cb(null, true);
  }
});

// Authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

// Apply authentication middleware to all routes
router.use(requireAuth);

// Create a new group
router.post("/", upload.single('avatar'), async (req: any, res) => {
  try {
    const { name, description } = req.body;
    const avatarUrl = req.file ? `/group-avatars/${req.file.filename}` : null;

    const [newGroup] = await db.insert(groups)
      .values({
        name,
        description,
        avatarUrl,
        createdBy: req.user.id,
      })
      .returning();

    // Add creator as admin member
    await db.insert(groupMembers)
      .values({
        groupId: newGroup.id,
        userId: req.user.id,
        role: 'admin'
      });

    res.status(201).json(newGroup);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ message: "Failed to create group" });
  }
});

// Get all groups
router.get("/", async (req: any, res) => {
  try {
    // First, get all groups with basic information
    const allGroups = await db.select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      avatarUrl: groups.avatarUrl,
      createdAt: groups.createdAt,
      createdBy: groups.createdBy,
      creatorUsername: users.username,
      creatorDisplayName: users.displayName,
    })
    .from(groups)
    .leftJoin(users, eq(groups.createdBy, users.id))
    .orderBy(desc(groups.createdAt));

    // Then, for each group, get the member count and joined status
    const enrichedGroups = await Promise.all(
      allGroups.map(async (group) => {
        const memberCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(groupMembers)
          .where(eq(groupMembers.groupId, group.id));

        const isJoined = await db
          .select()
          .from(groupMembers)
          .where(and(
            eq(groupMembers.groupId, group.id),
            eq(groupMembers.userId, req.user.id)
          ))
          .limit(1);

        const userRole = isJoined.length > 0 ? isJoined[0].role : null;

        return {
          ...group,
          memberCount: memberCount[0].count,
          isJoined: isJoined.length > 0,
          userRole: userRole,
          isAdmin: userRole === 'admin'
        };
      })
    );

    res.json(enrichedGroups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: "Failed to fetch groups" });
  }
});

// Update a group
router.put("/:groupId", upload.single('avatar'), async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;

    // Check if user is admin of the group
    const memberInfo = await db
      .select()
      .from(groupMembers)
      .where(and(
        eq(groupMembers.groupId, parseInt(groupId)),
        eq(groupMembers.userId, req.user.id),
        eq(groupMembers.role, 'admin')
      ))
      .limit(1);

    if (memberInfo.length === 0) {
      return res.status(403).json({ message: "Not authorized to edit this group" });
    }

    const updateData: any = {
      name,
      description,
    };

    if (req.file) {
      updateData.avatarUrl = `/group-avatars/${req.file.filename}`;
    }

    const [updatedGroup] = await db
      .update(groups)
      .set(updateData)
      .where(eq(groups.id, parseInt(groupId)))
      .returning();

    res.json(updatedGroup);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ message: "Failed to update group" });
  }
});

// Join a group
router.post("/:groupId/join", async (req: any, res) => {
  try {
    const { groupId } = req.params;

    const existingMember = await db
      .select()
      .from(groupMembers)
      .where(and(
        eq(groupMembers.groupId, parseInt(groupId)),
        eq(groupMembers.userId, req.user.id)
      ))
      .limit(1);

    if (existingMember.length > 0) {
      return res.status(400).json({ message: "Already a member of this group" });
    }

    await db.insert(groupMembers)
      .values({
        groupId: parseInt(groupId),
        userId: req.user.id,
        role: 'member'
      });

    res.status(201).json({ message: "Successfully joined group" });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ message: "Failed to join group" });
  }
});

// Leave a group
router.delete("/:groupId/leave", async (req: any, res) => {
  try {
    const { groupId } = req.params;

    await db.delete(groupMembers)
      .where(and(
        eq(groupMembers.groupId, parseInt(groupId)),
        eq(groupMembers.userId, req.user.id)
      ));

    res.status(204).send();
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ message: "Failed to leave group" });
  }
});

// Get group messages
router.get("/:groupId/messages", async (req: any, res) => {
  try {
    const { groupId } = req.params;

    // Verify user is a member of the group
    const isMember = await db
      .select()
      .from(groupMembers)
      .where(and(
        eq(groupMembers.groupId, parseInt(groupId)),
        eq(groupMembers.userId, req.user.id)
      ))
      .limit(1);

    if (isMember.length === 0) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    const messages = await db
      .select({
        id: groupMessages.id,
        content: groupMessages.content,
        createdAt: groupMessages.createdAt,
        username: users.username,
        avatarUrl: users.avatarUrl
      })
      .from(groupMessages)
      .innerJoin(users, eq(groupMessages.userId, users.id))
      .where(eq(groupMessages.groupId, parseInt(groupId)))
      .orderBy(desc(groupMessages.createdAt));

    res.json(messages);
  } catch (error) {
    console.error('Error fetching group messages:', error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// Send a message to a group
router.post("/:groupId/messages", async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const { content } = req.body;

    // Verify user is a member of the group
    const isMember = await db
      .select()
      .from(groupMembers)
      .where(and(
        eq(groupMembers.groupId, parseInt(groupId)),
        eq(groupMembers.userId, req.user.id)
      ))
      .limit(1);

    if (isMember.length === 0) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    const [newMessage] = await db
      .insert(groupMessages)
      .values({
        groupId: parseInt(groupId),
        userId: req.user.id,
        content
      })
      .returning();

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// Add new endpoint to get group reviews
router.get("/:groupId/reviews", async (req: any, res) => {
  try {
    const { groupId } = req.params;

    // Verify user is a member of the group
    const isMember = await db
      .select()
      .from(groupMembers)
      .where(and(
        eq(groupMembers.groupId, parseInt(groupId)),
        eq(groupMembers.userId, req.user.id)
      ))
      .limit(1);

    if (isMember.length === 0) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    // Fetch reviews that belong to this group
    const groupReviews = await db
      .select({
        id: reviews.id,
        userId: reviews.userId,
        placeId: reviews.placeId,
        placeName: reviews.placeName,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        username: users.username,
        location: reviews.location,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.groupId, parseInt(groupId)))
      .orderBy(desc(reviews.createdAt));

    res.json(groupReviews);
  } catch (error) {
    console.error('Error fetching group reviews:', error);
    res.status(500).json({ message: "Failed to fetch group reviews" });
  }
});

export default router;