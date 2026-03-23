import { env } from "cloudflare:workers";

export function getDB(): D1Database | null {
  return (env as any).DB || null;
}
