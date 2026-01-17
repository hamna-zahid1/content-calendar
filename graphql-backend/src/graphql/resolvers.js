const pool = require('../config/database');
const redis = require('../config/redis');
const { hashPassword, comparePassword, generateToken } = require('../utils/auth');
const { checkRateLimit } = require('../utils/rateLimit');
const { generateContentCalendar } = require('../services/groqService');
const { v4: uuidv4 } = require('uuid');

const resolvers = {
  Query: {
    me: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const result = await pool.query(
        'SELECT id, email FROM users WHERE id = $1',
        [user.userId]
      );
      
      return result.rows[0];
    },

    getPlans: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const result = await pool.query(
        `SELECT id, name, niche, platform, goal, tone, created_at, updated_at 
         FROM content_plans WHERE user_id = $1 ORDER BY created_at DESC`,
        [user.userId]
      );
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        niche: row.niche,
        platform: row.platform,
        goal: row.goal,
        tone: row.tone,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        posts: []
      }));
    },

    getPlan: async (_, { id }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const planResult = await pool.query(
        `SELECT id, name, niche, platform, goal, tone, created_at, updated_at 
         FROM content_plans WHERE id = $1 AND user_id = $2`,
        [id, user.userId]
      );
      
      if (planResult.rows.length === 0) {
        throw new Error('Plan not found');
      }
      
      const postsResult = await pool.query(
        `SELECT id, plan_id, day, date, format, caption, hashtags, status, scheduled_at 
         FROM posts WHERE plan_id = $1 ORDER BY day ASC`,
        [id]
      );
      
      const plan = planResult.rows[0];
      return {
        id: plan.id,
        name: plan.name,
        niche: plan.niche,
        platform: plan.platform,
        goal: plan.goal,
        tone: plan.tone,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
        posts: postsResult.rows.map(post => ({
          id: post.id,
          planId: post.plan_id,
          day: post.day,
          date: post.date,
          format: post.format,
          caption: post.caption,
          hashtags: post.hashtags || [],
          status: post.status,
          scheduledAt: post.scheduled_at
        }))
      };
    },
  },

  Mutation: {
    signup: async (_, { email, password }) => {
      // Check if user exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        throw new Error('User already exists');
      }
      
      const passwordHash = await hashPassword(password);
      
      const result = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [email, passwordHash]
      );
      
      const user = result.rows[0];
      const token = generateToken(user.id, user.email);
      
      return { token, user };
    },

    login: async (_, { email, password }) => {
      const result = await pool.query(
        'SELECT id, email, password_hash FROM users WHERE email = $1',
        [email]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Invalid credentials');
      }
      
      const user = result.rows[0];
      const valid = await comparePassword(password, user.password_hash);
      
      if (!valid) {
        throw new Error('Invalid credentials');
      }
      
      const token = generateToken(user.id, user.email);
      
      return {
        token,
        user: { id: user.id, email: user.email }
      };
    },

    createPlan: async (_, { input }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { name, niche, platform, goal, tone } = input;
      
      const result = await pool.query(
        `INSERT INTO content_plans (user_id, name, niche, platform, goal, tone) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id, name, niche, platform, goal, tone, created_at, updated_at`,
        [user.userId, name, niche, platform, goal, tone]
      );
      
      const plan = result.rows[0];
      return {
        id: plan.id,
        name: plan.name,
        niche: plan.niche,
        platform: plan.platform,
        goal: plan.goal,
        tone: plan.tone,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
        posts: []
      };
    },

    generateCalendar: async (_, { planId }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Check rate limit
      const rateLimitCheck = await checkRateLimit(user.userId);
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded. Try again in ${rateLimitCheck.retryAfter} seconds.`);
      }
      
      // Get plan details
      const planResult = await pool.query(
        `SELECT id, name, niche, platform, goal, tone 
         FROM content_plans WHERE id = $1 AND user_id = $2`,
        [planId, user.userId]
      );
      
      if (planResult.rows.length === 0) {
        throw new Error('Plan not found');
      }
      
      const plan = planResult.rows[0];
      
      // Check cache
      const cacheKey = `calendar:${planId}`;
      const cached = await redis.get(cacheKey);
      
      let calendarData;
      if (cached) {
        console.log('Returning cached calendar');
        calendarData = JSON.parse(cached);
      } else {
        // Generate with Groq
        calendarData = await generateContentCalendar({
          niche: plan.niche,
          platform: plan.platform,
          goal: plan.goal,
          tone: plan.tone
        });
        
        // Cache for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(calendarData));
      }
      
      // Delete existing posts
      await pool.query('DELETE FROM posts WHERE plan_id = $1', [planId]);
      
      // Insert new posts
      const startDate = new Date();
      for (const post of calendarData.posts) {
        const postDate = new Date(startDate);
        postDate.setDate(startDate.getDate() + post.day - 1);
        
        // Parse time
        const [hours, minutes] = (post.time || '09:00').split(':');
        postDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        await pool.query(
          `INSERT INTO posts (plan_id, day, date, format, caption, hashtags, status, scheduled_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            planId,
            post.day,
            postDate,
            post.format,
            post.caption,
            post.hashtags,
            'draft',
            postDate
          ]
        );
      }
      
      // Fetch updated plan with posts
      const postsResult = await pool.query(
        `SELECT id, plan_id, day, date, format, caption, hashtags, status, scheduled_at 
         FROM posts WHERE plan_id = $1 ORDER BY day ASC`,
        [planId]
      );
      
      return {
        id: plan.id,
        name: plan.name,
        niche: plan.niche,
        platform: plan.platform,
        goal: plan.goal,
        tone: plan.tone,
        createdAt: planResult.rows[0].created_at,
        updatedAt: planResult.rows[0].updated_at,
        posts: postsResult.rows.map(post => ({
          id: post.id,
          planId: post.plan_id,
          day: post.day,
          date: post.date,
          format: post.format,
          caption: post.caption,
          hashtags: post.hashtags || [],
          status: post.status,
          scheduledAt: post.scheduled_at
        }))
      };
    },

    updatePost: async (_, { input }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { postId, caption, hashtags, scheduledAt, status } = input;
      
      // Verify ownership
      const checkResult = await pool.query(
        `SELECT p.id FROM posts p 
         JOIN content_plans cp ON p.plan_id = cp.id 
         WHERE p.id = $1 AND cp.user_id = $2`,
        [postId, user.userId]
      );
      
      if (checkResult.rows.length === 0) {
        throw new Error('Post not found or access denied');
      }
      
      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramIndex = 1;
      
      if (caption !== undefined) {
        updates.push(`caption = $${paramIndex}`);
        values.push(caption);
        paramIndex++;
      }
      if (hashtags !== undefined) {
        updates.push(`hashtags = $${paramIndex}`);
        values.push(hashtags);
        paramIndex++;
      }
      if (scheduledAt !== undefined) {
        updates.push(`scheduled_at = $${paramIndex}`);
        values.push(scheduledAt);
        paramIndex++;
      }
      if (status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }
      
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(postId);
      
      const result = await pool.query(
        `UPDATE posts SET ${updates.join(', ')} 
         WHERE id = $${paramIndex} 
         RETURNING id, plan_id, day, date, format, caption, hashtags, status, scheduled_at`,
        values
      );
      
      const post = result.rows[0];
      return {
        id: post.id,
        planId: post.plan_id,
        day: post.day,
        date: post.date,
        format: post.format,
        caption: post.caption,
        hashtags: post.hashtags || [],
        status: post.status,
        scheduledAt: post.scheduled_at
      };
    },

    deletePlan: async (_, { id }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const result = await pool.query(
        'DELETE FROM content_plans WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, user.userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Plan not found');
      }
      
      // Clear cache
      await redis.del(`calendar:${id}`);
      
      return true;
    },

    exportPlan: async (_, { id, format }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      
      const planResult = await pool.query(
        `SELECT id, name, niche, platform, goal, tone 
         FROM content_plans WHERE id = $1 AND user_id = $2`,
        [id, user.userId]
      );
      
      if (planResult.rows.length === 0) {
        throw new Error('Plan not found');
      }
      
      const postsResult = await pool.query(
        `SELECT day, date, format, caption, hashtags, status, scheduled_at 
         FROM posts WHERE plan_id = $1 ORDER BY day ASC`,
        [id]
      );
      
      if (format === 'csv') {
        let csv = 'Day,Date,Platform,Format,Caption,Hashtags,Status,Scheduled At\n';
        
        postsResult.rows.forEach(post => {
          const date = new Date(post.date).toLocaleDateString();
          const hashtags = (post.hashtags || []).join(' ');
          const scheduledAt = post.scheduled_at ? new Date(post.scheduled_at).toLocaleString() : '';
          
          csv += `${post.day},"${date}","${planResult.rows[0].platform}","${post.format}","${post.caption.replace(/"/g, '""')}","${hashtags}","${post.status}","${scheduledAt}"\n`;
        });
        
        return { data: csv, format: 'csv' };
      } else {
        // JSON format
        const data = {
          plan: planResult.rows[0],
          posts: postsResult.rows
        };
        
        return { data: JSON.stringify(data, null, 2), format: 'json' };
      }
    },
  },
};

module.exports = resolvers;