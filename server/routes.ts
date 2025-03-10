import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { likesRouter } from "./likes";
import { recommendationsRouter } from "./recommendations";
import reviewsRouter from "./reviews";
import { tripsRouter } from "./trips";
import { socialRouter } from "./social";
import groupsRouter from "./groups";
import express from "express";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, './uploads');
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

export function registerRoutes(app: Express): Server {
  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  // Create directory for group avatars
  const groupAvatarsDir = path.join(uploadsDir, 'group-avatars');
  if (!fs.existsSync(groupAvatarsDir)) {
    fs.mkdirSync(groupAvatarsDir);
  }

  // Setup CORS with credentials
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Serve uploaded files
  app.use('/uploads', express.static(uploadsDir));
  app.use('/group-avatars', express.static(groupAvatarsDir));

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Setup authentication before API routes
  setupAuth(app);

  // First register all API routes
  app.use("/api", likesRouter);
  app.use("/api", recommendationsRouter);
  app.use("/api/reviews", reviewsRouter);
  app.use("/api/trips", tripsRouter);
  app.use("/api", socialRouter);
  app.use("/api/groups", groupsRouter);

  // Then add authentication check middleware AFTER routes are registered
  app.use('/api', (req, res, next) => {
    // List of paths that don't require authentication
    const publicPaths = [
      '/api/register',
      '/api/login',
      '/api/logout',
      '/api/trips/public',
      '/api/trips/shared'
    ];

    // Skip auth check for public paths
    if (publicPaths.some(path => req.path.startsWith(path))) {
      console.log('Skipping auth check for public path:', req.path);
      return next();
    }

    console.log('Auth middleware check:', {
      path: req.path,
      method: req.method,
      isAuthenticated: req.isAuthenticated?.(),
      userId: req.user?.id,
      session: req.session
    });

    if (!req.isAuthenticated()) {
      console.log('Unauthorized access attempt:', {
        path: req.path,
        method: req.method,
        isAuthenticated: false
      });
      return res.status(401).json({ error: "Not authenticated" });
    }

    next();
  });

  // Profile update endpoint
  app.put('/api/profile', async (req, res) => {
    try {
      if (!req.user?.id) {
        console.log('Unauthorized profile update attempt');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { username, displayName, bio, location } = req.body;
      console.log('Updating profile for user:', req.user.id, 'with data:', { username, displayName, bio, location });

      const updatedUser = await db
        .update(users)
        .set({
          username,
          displayName,
          bio,
          location
        })
        .where(eq(users.id, req.user.id))
        .returning();

      if (!updatedUser.length) {
        console.error('User not found in database:', req.user.id);
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('Profile updated successfully:', updatedUser[0]);
      res.json(updatedUser[0]);
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Avatar update endpoint
  app.put('/api/profile/avatar', upload.single('avatar'), async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No avatar file provided' });
      }

      const avatarUrl = `/uploads/${req.file.filename}`;

      const updatedUser = await db
        .update(users)
        .set({
          avatarUrl
        })
        .where(eq(users.id, req.user.id))
        .returning();

      if (!updatedUser.length) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(updatedUser[0]);
    } catch (error) {
      console.error('Avatar update error:', error);
      res.status(500).json({ error: 'Failed to update avatar' });
    }
  });

  // In development, let Vite handle all non-API routes
  if (process.env.NODE_ENV !== 'production') {
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      next();
    });
  }

  const httpServer = createServer(app);
  return httpServer;
}