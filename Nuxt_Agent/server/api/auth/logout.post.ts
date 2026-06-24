/**
 * POST /api/auth/logout
 * Clears the user's secure session, logging them out of the application.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = await useSession(event, { password: config.sessionPassword })
  await session.clear()
  return { success: true }
})
