import postgres from 'postgres';
import { logger } from './logger';

/**
 * Lazy-initialized Postgres client singleton.
 *
 * We intentionally defer creating the `postgres` client until the first call
 * to `getDb()` rather than at module load time. This is because `useRuntimeConfig()`
 * is a Nuxt composable that requires an active Nitro request context — calling it
 * at module scope (outside a handler or composable) would return an empty object
 * on startup and silently break the connection.
 *
 * The client is only created once and then reused across all subsequent requests
 * (connection pooling is handled internally by the `postgres` library).
 */
let _sql: ReturnType<typeof postgres> | null = null;

/**
 * Returns the shared Postgres client, initializing it on the first call.
 *
 * Throws an error if `NEON_DATABASE_URL` is not set in the runtime config,
 * so misconfiguration fails loudly at query time rather than silently.
 */
function getDb(): ReturnType<typeof postgres> {
  if (_sql) return _sql;

  const config = useRuntimeConfig();

  if (!config.neonDatabaseUrl) {
    throw new Error('[DB] NEON_DATABASE_URL is not configured. Chat history logging is disabled.');
  }

  _sql = postgres(config.neonDatabaseUrl as string, {
    ssl: 'require',
    // Maximum number of concurrent connections in the pool.
    // Neon's free tier allows up to 10; we keep this conservative.
    max: 5,
    // Close idle connections after 20 seconds to avoid holding Neon serverless
    // connections open unnecessarily between bursts of activity.
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return _sql;
}

/**
 * `db` is the application's single interface to the Neon Postgres database.
 *
 * All methods are fire-and-forget safe for compliance logging — they catch
 * and log their own errors rather than propagating them to the caller,
 * so a database outage never takes down the chat API.
 */
export const db = {
  /**
   * Appends a single message to the `chat_history` table.
   *
   * @param userId  - The Salesforce User ID from the session. Used to scope
   *                  history to the individual user for compliance and recall.
   * @param role    - `'user'` for the human's message, `'model'` for the AI reply.
   * @param content - The raw text content of the message.
   *
   * Silently no-ops if any argument is missing, so callers don't need to guard.
   */
  async logChat(userId: string, role: 'user' | 'model', content: string): Promise<void> {
    if (!userId || !role || !content) return;

    try {
      const sql = getDb();
      await sql`
        INSERT INTO chat_history (user_id, role, content)
        VALUES (${userId}, ${role}, ${content})
      `;
    } catch (err: unknown) {
      // Log the failure but never throw — a DB outage must not block chat responses.
      logger.error({ err }, '[DB] Failed to log chat history — continuing without logging');
    }
  },
};
