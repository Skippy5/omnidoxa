import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = {
    timestamp: new Date().toISOString(),
    env: {
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
      tursoUrlPrefix: process.env.TURSO_DATABASE_URL?.substring(0, 20) || 'NOT_SET',
    },
    runtime: 'nodejs',
    platform: process.env.VERCEL ? 'vercel' : 'local',
  };

  return NextResponse.json(health);
}
