import { logger } from '../utils/logger';
import { db } from '../utils/db';

/**
 * POST /api/chat
 *
 * The primary BFF (Backend-for-Frontend) handler for the AI chat interface.
 *
 * Responsibilities:
 *  1. Validates the user's active Salesforce session (access token + instance URL).
 *  2. Extracts the latest user message and transforms prior messages into the
 *     format expected by the Gemini SDK (role: 'user' | 'model', parts: [{ text }]).
 *  3. Delegates to `GeminiService` which manages the MCP tool loop and LLM calls.
 *  4. Asynchronously logs the user prompt and AI reply to Neon Postgres for
 *     compliance and future on-demand context recall — this never blocks the response.
 *
 * Chat history is NOT pre-fetched from the DB on load. The frontend maintains
 * in-session state, and the AI can retrieve past conversations on demand via the
 * `search_past_conversations` MCP tool when the user explicitly asks for them.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const session = await useSession(event, { password: config.sessionPassword });

  let accessToken = session.data.accessToken;
  let instanceUrl = session.data.instanceUrl;
  const userId = session.data.userId as string | undefined;

  // CI/CD Integration Test Bypass (only active in non-production)
  if (process.env.NODE_ENV !== 'production') {
    const overrideToken = getHeader(event, 'x-sf-access-token');
    const overrideUrl = getHeader(event, 'x-sf-instance-url');
    if (overrideToken && overrideUrl) {
      accessToken = overrideToken;
      instanceUrl = overrideUrl;
    }
  }

  if (!accessToken || !instanceUrl) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized. Please login to Salesforce.' });
  }

  const body = await readBody(event);
  const messages = body.messages || [];
  if (!messages.length) {
    throw createError({ statusCode: 400, statusMessage: 'Message history is required.' });
  }

  // The last message in the array is always the new user prompt.
  const userMessage = messages[messages.length - 1].content;

  // All preceding messages form the conversation history for the LLM.
  // We map the frontend's 'bot' role to the Gemini SDK's 'model' role here.
  const historyMessages = messages.slice(0, -1).map((m: any) => ({
    role: m.role === 'bot' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  try {
    const geminiService = new GeminiService(
      config.geminiApiKey as string,
      accessToken,
      instanceUrl,
      config.mcpServerUrl as string,
      event.context.reqId as string,
      config.geminiApiKey2 as string
    );

    const text = await geminiService.executeChat(historyMessages, userMessage);

    // Log the exchange to Postgres for compliance and on-demand AI recall.
    // Both inserts are fire-and-forget (errors are caught inside db.logChat) and
    // run in parallel to avoid adding sequential DB latency to the response time.
    if (userId) {
      await Promise.all([
        db.logChat(userId, 'user', userMessage),
        db.logChat(userId, 'model', text),
      ]);
    } else {
      // userId being absent from the session is abnormal — log a warning so it's
      // visible in traces without blocking the user's chat response.
      logger.warn({ reqId: event.context.reqId }, '[Chat API] userId missing from session — interaction will not be logged for compliance');
    }

    return { reply: text };
  } catch (error: any) {
    logger.error({ err: error, reqId: event.context.reqId }, '[Chat API] Communication failed');

    // Pass up user-friendly error messages from GeminiService
    if (typeof error === 'string') {
      return { reply: error };
    }

    throw createError({ statusCode: 500, statusMessage: 'Failed to communicate with AI model.' });
  }
});
