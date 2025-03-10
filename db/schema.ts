import { pgTable, text, serial, integer, timestamp, jsonb, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Define user roles enum
export const userRoleEnum = pgEnum('user_role', ['casual', 'admin', 'business']);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  // Profile fields
  displayName: text("display_name"),
  bio: text("bio"),
  location: text("location"),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").default('casual'),  // Make it nullable for existing records
  // Business-specific fields
  businessName: text("business_name"),
  businessAddress: text("business_address"),
  businessDescription: text("business_description"),
  // OAuth and account management
  resetToken: text("resetToken"),
  resetTokenExpiry: text("resetTokenExpiry"),
  preferences: jsonb("preferences").default({}).notNull(),
});

// New table for following relationships
export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").references(() => users.id).notNull(),
  followingId: integer("following_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add new group-related tables
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").default("member").notNull(), // 'admin' or 'member'
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const groupMessages = pgTable("group_messages", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add group field to reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  placeId: text("place_id").notNull(),
  placeName: text("place_name"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  isPublic: boolean("is_public").default(true).notNull(),
  groupId: integer("group_id").references(() => groups.id),
  location: jsonb("location").$type<{
    city?: string;
    country?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const reviewLikes = pgTable("review_likes", {
  id: serial("id").primaryKey(),
  reviewId: serial("review_id").references(() => reviews.id),
  userId: serial("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Create base schemas
const baseUserSchema = createSelectSchema(users);
export const insertUserSchema = createInsertSchema(users);

// Extend the schemas to match the API responses
export const selectUserSchema = baseUserSchema.extend({
  message: z.string().optional(),
});

export const likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  placeId: text("place_id").notNull(),
  placeName: text("place_name").notNull(),
  placeAddress: text("place_address"),
  placeType: text("place_type"),
  rating: integer("rating"),
  priceLevel: integer("price_level"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// New trips table
export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isPublic: boolean("is_public").default(false).notNull(),
  // Make location fields optional for existing records
  locationName: text("location_name"),
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Junction table for trip places
export const tripPlaces = pgTable("trip_places", {
  id: serial("id").primaryKey(),
  tripId: serial("trip_id").references(() => trips.id),
  placeId: text("place_id").notNull(),
  placeName: text("place_name").notNull(),
  placeAddress: text("place_address"),
  notes: text("notes"),
  visitDate: timestamp("visit_date"),
  order: integer("order"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const recommendations = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  placeId: text("place_id").notNull(),
  placeName: text("place_name").notNull(),
  placeAddress: text("place_address"),
  placeType: text("place_type"),
  score: integer("score").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = z.infer<typeof selectUserSchema>;

// Add new types for trips
export const insertTripSchema = createInsertSchema(trips);
export const selectTripSchema = createSelectSchema(trips);
export type InsertTrip = typeof trips.$inferInsert;
export type SelectTrip = typeof trips.$inferSelect;

// Add new types for trip places
export const insertTripPlaceSchema = createInsertSchema(tripPlaces);
export const selectTripPlaceSchema = createSelectSchema(tripPlaces);
export type InsertTripPlace = typeof tripPlaces.$inferInsert;
export type SelectTripPlace = typeof tripPlaces.$inferSelect;

// Add new types for follows
export const insertFollowSchema = createInsertSchema(follows);
export const selectFollowSchema = createSelectSchema(follows);
export type InsertFollow = typeof follows.$inferInsert;
export type SelectFollow = typeof follows.$inferSelect;

// Add new types for groups
export const insertGroupSchema = createInsertSchema(groups);
export const selectGroupSchema = createSelectSchema(groups);
export type InsertGroup = typeof groups.$inferInsert;
export type SelectGroup = typeof groups.$inferSelect;

// Add new types for group members
export const insertGroupMemberSchema = createInsertSchema(groupMembers);
export const selectGroupMemberSchema = createSelectSchema(groupMembers);
export type InsertGroupMember = typeof groupMembers.$inferInsert;
export type SelectGroupMember = typeof groupMembers.$inferSelect;

// Add new types for group messages
export const insertGroupMessageSchema = createInsertSchema(groupMessages);
export const selectGroupMessageSchema = createSelectSchema(groupMessages);
export type InsertGroupMessage = typeof groupMessages.$inferInsert;
export type SelectGroupMessage = typeof groupMessages.$inferSelect;