// Authentication Middleware
// apps/api/src/middleware/auth.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../server';

// Initialize Supabase Admin client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      supabaseId: string;
      email: string;
      name?: string;
    };
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Skip auth for health check
  if (request.url === '/health') {
    return;
  }

  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT with Supabase
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    // Get or create user in our database
    let user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      select: {
        id: true,
        supabaseId: true,
        email: true,
        name: true,
      },
    });

    // Auto-create user if doesn't exist (first login)
    if (!user) {
      user = await prisma.user.create({
        data: {
          supabaseId: supabaseUser.id,
          email: supabaseUser.email!,
          name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
          settings: {
            create: {}, // Create default settings
          },
        },
        select: {
          id: true,
          supabaseId: true,
          email: true,
          name: true,
        },
      });

      // Create default portfolio for new user
      await prisma.portfolio.create({
        data: {
          userId: user.id,
          name: 'Main Portfolio',
          isDefault: true,
        },
      });
    }

    request.user = user;
  } catch (err) {
    request.log.error(err, 'Auth middleware error');
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}
