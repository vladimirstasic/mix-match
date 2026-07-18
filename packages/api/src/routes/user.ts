import { Router } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireUser, getUserId } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { analyses, users, segments, follows } from '../db/schema.js';
import { findAnalysis, findSegment, findUser, ensureUser } from '../db/helpers.js';
import { config } from '../config.js';

export const userRouter = Router();

userRouter.get('/user/profile', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const user = await findUser(userId);
  if (!user) {
    res.json({ username: null });
    return;
  }

  // Compute badges dynamically
  const analysisCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(analyses)
    .where(eq(analyses.userId, userId));
  const badges: string[] = [];
  if (Number(analysisCount[0]?.count) >= 1) badges.push('first-mix');
  if (Number(analysisCount[0]?.count) >= 10) badges.push('power-scanner');

  res.json({
    username: user.username,
    plan: user.plan,
    creditsRemaining: user.creditsRemaining,
    creditsResetAt: user.creditsResetAt,
    isFoundingMember: user.isFoundingMember,
    isAdmin: user.isAdmin,
    betaMode: config.betaMode,
    badges,
  });
});

userRouter.get('/user/analyses', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const rows = await db
    .select({
      id: analyses.id,
      filename: analyses.filename,
      status: analyses.status,
      createdAt: analyses.createdAt,
      isPublic: analyses.isPublic,
      isFavorite: analyses.isFavorite,
      slug: analyses.slug,
      tags: analyses.tags,
    })
    .from(analyses)
    .where(eq(analyses.userId, userId))
    .orderBy(desc(analyses.createdAt))
    .limit(50);

  res.json(rows);
});

userRouter.patch('/user/profile', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const { username } = req.body;
  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username required' });
    return;
  }

  const slug = username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50);
  if (slug.length < 3) {
    res.status(400).json({ error: 'Username must be at least 3 characters' });
    return;
  }

  try {
    await db.update(users).set({ username: slug }).where(eq(users.clerkId, userId));
    res.json({ username: slug });
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }
    throw err;
  }
});

userRouter.get('/dj/:username', async (req, res) => {
  const username = req.params.username as string;

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) {
    res.status(404).json({ error: 'DJ not found' });
    return;
  }

  const mixes = await db
    .select({
      id: analyses.id,
      filename: analyses.filename,
      status: analyses.status,
      createdAt: analyses.createdAt,
      slug: analyses.slug,
    })
    .from(analyses)
    .where(and(eq(analyses.userId, user.clerkId), eq(analyses.isPublic, true)))
    .orderBy(desc(analyses.createdAt))
    .limit(20);

  // Compute badges dynamically
  const analysisCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(analyses)
    .where(eq(analyses.userId, user.clerkId));
  const badges: string[] = [];
  if (Number(analysisCount[0]?.count) >= 1) badges.push('first-mix');
  if (Number(analysisCount[0]?.count) >= 10) badges.push('power-scanner');

  res.json({ username: user.username, mixes, badges });
});

// GET /api/dj/:username/og — returns HTML with OG meta tags for social sharing
userRouter.get('/dj/:username/og', async (req, res) => {
  const username = req.params.username as string;
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) {
    res.status(404).send('Not found');
    return;
  }

  const mixCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(analyses)
    .where(and(eq(analyses.userId, user.clerkId), eq(analyses.isPublic, true)));
  const count = Number(mixCount[0]?.count ?? 0);

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const title = esc(`@${user.username} — DJ profile on MixMatch`);
  const description = esc(`${count} mix${count !== 1 ? 'es' : ''} identified by MixMatch.`);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const publicUrl = `${frontendUrl}/dj/${encodeURIComponent(username)}`;
  const imageUrl = `${frontendUrl}/og-image.png`;

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="profile" />
  <meta property="og:url" content="${publicUrl}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <p><a href="${publicUrl}">View on MixMatch</a></p>
</body>
</html>`);
});

userRouter.patch('/analysis/:id/tags', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const analysisId = req.params.id as string;
  const { tags } = req.body;
  if (!Array.isArray(tags)) {
    res.status(400).json({ error: 'Tags must be an array' });
    return;
  }

  const analysis = await findAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (analysis.userId !== userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  await db.update(analyses).set({ tags }).where(eq(analyses.id, analysisId));
  res.json({ tags });
});

userRouter.patch('/analysis/:id/favorite', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const analysisId = req.params.id as string;
  const analysis = await findAnalysis(analysisId);
  if (!analysis || analysis.userId !== userId) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const newVal = !analysis.isFavorite;
  await db.update(analyses).set({ isFavorite: newVal }).where(eq(analyses.id, analysisId));
  res.json({ isFavorite: newVal });
});

userRouter.patch('/segments/:id/bookmark', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const segmentId = req.params.id as string;
  const segment = await findSegment(segmentId);
  if (!segment) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const analysis = await findAnalysis(segment.analysisId);
  if (!analysis || analysis.userId !== userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const newVal = !(segment as any).isBookmarked;
  await db.update(segments).set({ isBookmarked: newVal }).where(eq(segments.id, segmentId));
  res.json({ isBookmarked: newVal });
});

userRouter.post('/analysis/:id/reprocess', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const analysisId = req.params.id as string;
  const analysis = await findAnalysis(analysisId);
  if (!analysis) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (analysis.userId !== userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }
  if (!analysis.chunksDir) {
    res.status(410).json({ error: 'Audio files expired, please re-upload' });
    return;
  }

  // Reset status
  await db
    .update(analyses)
    .set({ status: 'pending', processedChunks: 0, results: null, metrics: null, error: null, updatedAt: new Date() })
    .where(eq(analyses.id, analysisId));

  // Delete old segments
  await db.delete(segments).where(eq(segments.analysisId, analysisId));

  res.json({ message: 'Analysis reset. Please re-upload the file to reprocess.' });
});

// POST /api/dj/:username/follow — toggle follow
userRouter.post('/dj/:username/follow', requireUser, async (req, res) => {
  const userId = getUserId(req);

  await ensureUser(userId);

  const username = req.params.username as string;
  const existing = await db
    .select()
    .from(follows)
    .where(and(eq(follows.followerId, userId), eq(follows.followingUsername, username)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(follows).where(eq(follows.id, existing[0].id));
    res.json({ following: false });
  } else {
    await db.insert(follows).values({ followerId: userId, followingUsername: username });
    res.json({ following: true });
  }
});

// GET /api/user/feed — mixes from followed DJs
userRouter.get('/user/feed', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const myFollows = await db.select().from(follows).where(eq(follows.followerId, userId));
  const usernames = myFollows.map(f => f.followingUsername);

  if (usernames.length === 0) {
    res.json([]);
    return;
  }

  // Get user IDs for followed usernames
  const followedUsers = await db
    .select()
    .from(users)
    .where(
      sql`${users.username} IN (${sql.join(
        usernames.map(u => sql`${u}`),
        sql`, `,
      )})`,
    );

  const userIds = followedUsers.map(u => u.clerkId);
  if (userIds.length === 0) {
    res.json([]);
    return;
  }

  const mixes = await db
    .select({
      id: analyses.id,
      filename: analyses.filename,
      status: analyses.status,
      createdAt: analyses.createdAt,
      slug: analyses.slug,
    })
    .from(analyses)
    .where(
      and(
        sql`${analyses.userId} IN (${sql.join(
          userIds.map(id => sql`${id}`),
          sql`, `,
        )})`,
        eq(analyses.isPublic, true),
      ),
    )
    .orderBy(desc(analyses.createdAt))
    .limit(20);

  res.json(mixes);
});

// GET /api/user/analytics — view counts for user's mixes
userRouter.get('/user/analytics', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const mixes = await db
    .select({
      id: analyses.id,
      filename: analyses.filename,
      viewCount: analyses.viewCount,
      createdAt: analyses.createdAt,
    })
    .from(analyses)
    .where(eq(analyses.userId, userId))
    .orderBy(desc(analyses.viewCount))
    .limit(20);

  const totalViews = mixes.reduce((sum, m) => sum + (m.viewCount || 0), 0);

  res.json({ totalViews, mixes });
});

// GET /api/user/stats — top artists/genres/avg BPM across all identified segments
userRouter.get('/user/stats', requireUser, async (req, res) => {
  const userId = getUserId(req);

  const identifiedFilter = and(eq(analyses.userId, userId), eq(segments.status, 'identified'));

  const topArtists = await db
    .select({ artist: segments.artist, count: sql<number>`count(*)` })
    .from(segments)
    .innerJoin(analyses, eq(segments.analysisId, analyses.id))
    .where(and(identifiedFilter, sql`${segments.artist} is not null`))
    .groupBy(segments.artist)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const topGenres = await db
    .select({ genre: segments.genre, count: sql<number>`count(*)` })
    .from(segments)
    .innerJoin(analyses, eq(segments.analysisId, analyses.id))
    .where(and(identifiedFilter, sql`${segments.genre} is not null`))
    .groupBy(segments.genre)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const [totals] = await db
    .select({
      trackCount: sql<number>`count(*)`,
      avgBpm: sql<number | null>`avg(${segments.bpm})`,
      mixCount: sql<number>`count(distinct ${analyses.id})`,
    })
    .from(segments)
    .innerJoin(analyses, eq(segments.analysisId, analyses.id))
    .where(identifiedFilter);

  res.json({
    trackCount: Number(totals?.trackCount ?? 0),
    mixCount: Number(totals?.mixCount ?? 0),
    avgBpm: totals?.avgBpm != null ? Math.round(Number(totals.avgBpm)) : null,
    topArtists: topArtists.map(a => ({ artist: a.artist as string, count: Number(a.count) })),
    topGenres: topGenres.map(g => ({ genre: g.genre as string, count: Number(g.count) })),
  });
});
