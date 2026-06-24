/**
 * GET /api/auth/session
 * Checks if the current user has a valid session (i.e., an active Salesforce access token).
 * Returns the authentication status and the Salesforce instance URL.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = await useSession(event, { password: config.sessionPassword })
  
  return {
    isAuthenticated: !!session.data.accessToken,
    instanceUrl: session.data.instanceUrl || null
  }
})
