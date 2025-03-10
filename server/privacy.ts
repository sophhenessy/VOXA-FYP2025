import { type Request, Response, NextFunction } from 'express';
import { db } from "@db";
import { users, dataProcessingLogs, follows, likes, reviews, trips } from "@db/schema";
import { eq, lt } from "drizzle-orm";

// GDPR compliance middleware
export const privacyMiddleware = {
  // Data Processing Records (GDPR Article 30)
  logDataProcessing: async (userId: number, processType: string, description: string) => {
    await db.insert(dataProcessingLogs).values({
      userId,
      processType,
      description,
      timestamp: new Date()
    });
  },

  // Data Export (GDPR Article 20)
  exportUserData: async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const userData = {
      profile: req.user,
      reviews: await db.select().from(reviews).where(eq(reviews.userId, req.user.id)),
      likes: await db.select().from(likes).where(eq(likes.userId, req.user.id)),
      trips: await db.select().from(trips).where(eq(trips.userId, req.user.id)),
      follows: await db.select().from(follows).where(eq(follows.followerId, req.user.id)),
      processingHistory: await db.select().from(dataProcessingLogs).where(eq(dataProcessingLogs.userId, req.user.id))
    };

    await privacyMiddleware.logDataProcessing(req.user.id, 'DATA_EXPORT', 'User requested data export');

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=user-data.json');
    res.json(userData);
  },

  // Cookie Consent (GDPR Article 7)
  cookieConsent: {
    check: (req: Request, res: Response, next: NextFunction) => {
      if (!req.cookies?.cookieConsent && !req.path.includes('/privacy')) {
        return res.status(451).json({ 
          error: "Cookie consent required",
          requiredCookies: {
            essential: "Required for site functionality",
            analytics: "Used for site improvement",
            marketing: "Used for personalized content"
          }
        });
      }
      next();
    },
    update: async (req: Request, res: Response) => {
      const { essential, analytics, marketing } = req.body;
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });

      await db.update(users)
        .set({ cookiePreferences: { essential, analytics, marketing } })
        .where(eq(users.id, req.user.id));

      res.json({ message: "Cookie preferences updated" });
    }
  },

  // Data Retention (GDPR Article 5)
  cleanupExpiredData: async () => {
    const retentionPeriod = 24 * 60 * 60 * 1000 * 365; // 1 year
    const cutoffDate = new Date(Date.now() - retentionPeriod);

    await db.transaction(async (tx) => {
      // Only delete from dataProcessingLogs as we don't want to affect active users
      await tx.delete(dataProcessingLogs).where(lt(dataProcessingLogs.timestamp, cutoffDate));
    });
  },

  // Third-party Data Sharing (GDPR Article 13)
  updateDataSharingPreferences: async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const { allowThirdPartySharing } = req.body;
    await db.update(users)
      .set({ dataSharingConsent: allowThirdPartySharing })
      .where(eq(users.id, req.user.id));

    await privacyMiddleware.logDataProcessing(
      req.user.id,
      'UPDATE_SHARING_PREFERENCES',
      `Third-party data sharing consent updated to: ${allowThirdPartySharing}`
    );

    res.json({ message: "Data sharing preferences updated" });
  },

  // Data deletion handler (GDPR Article 17)
  deleteUserData: async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    await db.transaction(async (tx) => {
      await tx.delete(reviews).where(eq(reviews.userId, req.user!.id));
      await tx.delete(likes).where(eq(likes.userId, req.user!.id));
      await tx.delete(trips).where(eq(trips.userId, req.user!.id));
      await tx.delete(follows).where(eq(follows.followerId, req.user!.id));
      await tx.delete(users).where(eq(users.id, req.user!.id));
    });

    req.logout(() => {
      res.clearCookie('connect.sid');
      res.json({ message: "Account and all associated data deleted successfully" });
    });
  }
};