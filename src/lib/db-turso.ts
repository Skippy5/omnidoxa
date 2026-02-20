import { createClient } from "@libsql/client";

// In production/Vercel, we MUST have Turso configured
if (!process.env.TURSO_DATABASE_URL) {
  console.error('❌ TURSO_DATABASE_URL environment variable is not set!');
  console.error('   Please add it to your Vercel Environment Variables');
  throw new Error("TURSO_DATABASE_URL is not set - check Vercel environment variables");
}

if (!process.env.TURSO_AUTH_TOKEN) {
  console.error('❌ TURSO_AUTH_TOKEN environment variable is not set!');
  console.error('   Please add it to your Vercel Environment Variables');
  throw new Error("TURSO_AUTH_TOKEN is not set - check Vercel environment variables");
}

console.log('✅ Turso client initializing with URL:', process.env.TURSO_DATABASE_URL.substring(0, 30) + '...');

export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
