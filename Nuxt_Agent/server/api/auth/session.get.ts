export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = await useSession(event, { password: config.sessionPassword })
  
  return {
    isAuthenticated: !!session.data.accessToken,
    instanceUrl: session.data.instanceUrl || null
  }
})
