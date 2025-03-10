import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, userRoleEnum } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import cors from 'cors';

const scryptAsync = promisify(scrypt);
const MemoryStore = createMemoryStore(session);

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      displayName: string | null;
      bio: string | null;
      location: string | null;
      avatarUrl: string | null;
      role: 'casual' | 'admin' | 'business';
    }
  }
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.EXPRESS_SESSION_SECRET || 'dev-secret-do-not-use-in-production';
  const isProduction = process.env.NODE_ENV === 'production';

  // Configure session middleware
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'voxa.sid',
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      domain: isProduction ? '.replit.dev' : undefined
    },
    store: new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    })
  };

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport local strategy
  passport.use(
    new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password'
    }, async (email, password, done) => {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, email))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Invalid credentials" });
        }

        const isMatch = await comparePasswords(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Invalid credentials" });
        }

        return done(null, {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          location: user.location,
          avatarUrl: user.avatarUrl,
          role: user.role || 'casual' // Ensure a default role
        });
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          bio: users.bio,
          location: users.location,
          avatarUrl: users.avatarUrl,
          role: users.role
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        return done(null, false);
      }
      done(null, { ...user, role: user.role || 'casual' });
    } catch (err) {
      done(err);
    }
  });

  async function comparePasswords(supplied: string, stored: string) {
    const [hashedPassword, salt] = stored.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      supplied,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  }

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    if (!req.body.email || !req.body.password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        return res.status(500).json({ error: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: "Failed to establish session" });
        }
        return res.json({
          message: "Login successful",
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            role: user.role
          }
        });
      });
    })(req, res, next);
  });

  // Registration endpoint
  app.post("/api/register", async (req, res) => {
    try {
      console.log('Received registration request:', req.body);
      const { email, password, role = 'casual' } = req.body;

      if (!email || !password) {
        console.log('Missing required fields:', { email: !!email, password: !!password });
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.username, email))
        .limit(1);

      if (existingUser.length > 0) {
        console.log('User already exists:', email);
        return res.status(400).json({ error: "Email already registered" });
      }

      // Generate salt and hash password
      const salt = randomBytes(16).toString('hex');
      const hashedPassword = (await scryptAsync(password, salt, 64)) as Buffer;
      const passwordHash = `${hashedPassword.toString('hex')}.${salt}`;

      console.log('Creating new user...');

      // Create new user with all required fields
      const [newUser] = await db
        .insert(users)
        .values({
          username: email,
          password: passwordHash,
          role: role as typeof userRoleEnum.enumValues[number],
          displayName: null,
          bio: null,
          location: null,
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      console.log('User created successfully:', newUser);

      // Create user response object matching Express.User interface
      const userResponse: Express.User = {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.displayName,
        bio: newUser.bio,
        location: newUser.location,
        avatarUrl: newUser.avatarUrl,
        role: newUser.role || 'casual'
      };

      // Log the user in automatically
      req.login(userResponse, (err) => {
        if (err) {
          console.error('Auto-login error after registration:', err);
          return res.status(500).json({ error: "Failed to establish session" });
        }
        console.log('User logged in successfully after registration');
        return res.status(201).json(userResponse);
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(200).json({ 
        message: "Already logged out",
        shouldRedirect: true,
        redirectUrl: "/auth"
      });
    }

    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }

      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: "Session destruction failed" });
        }

        res.clearCookie('voxa.sid', {
          secure: isProduction,
          httpOnly: true,
          sameSite: isProduction ? 'none' : 'lax',
          path: '/',
          domain: isProduction ? '.replit.dev' : undefined
        });

        return res.json({
          message: "Logout successful",
          shouldRedirect: true,
          redirectUrl: "/auth"
        });
      });
    });
  });

  // Get current user endpoint
  app.get("/api/user", (req, res) => {
    console.log('GET /api/user - Auth status:', req.isAuthenticated());
    console.log('Session:', req.session);
    console.log('User:', req.user);

    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = req.user as Express.User;
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      location: user.location,
      avatarUrl: user.avatarUrl,
      role: user.role
    });
  });
}