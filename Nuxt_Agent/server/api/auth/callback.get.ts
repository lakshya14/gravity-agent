/**
 * GET /api/auth/callback
 * Handles the redirect from Salesforce after successful user authentication.
 * Exchanges the temporary authorization code for a persistent access token 
 * and stores it securely in the user's session.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Authorization code missing' })
  }

  const config = useRuntimeConfig()
  const session = await useSession(event, { password: config.sessionPassword })
  
  const loginUrl = session.data.loginUrl || config.salesforceLoginUrl
  const tokenUrl = `${loginUrl}/services/oauth2/token`
  
  const codeVerifier = session.data.codeVerifier
  if (!codeVerifier) {
    throw createError({ statusCode: 400, statusMessage: 'Missing PKCE code verifier' })
  }

  let host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || ''
  if (host.includes(',')) host = host.split(',')[0].trim()
  
  let protocol = getRequestHeader(event, 'x-forwarded-proto') || ''
  if (protocol.includes(',')) protocol = protocol.split(',')[0].trim()
  if (!protocol) protocol = host.includes('localhost') ? 'http' : 'https'
  
  const base = config.appBaseUrl ? config.appBaseUrl.replace(/\/$/, '') : `${protocol}://${host}`
  const redirectUri = `${base}/api/auth/callback`
  console.log('Using redirect URI:', redirectUri);

  const params = new URLSearchParams()
  params.append('grant_type', 'authorization_code')
  params.append('client_id', config.salesforceClientId)
  params.append('client_secret', config.salesforceClientSecret)
  params.append('redirect_uri', redirectUri)
  params.append('code', code)
  params.append('code_verifier', codeVerifier)

  try {
    const response = await $fetch<any>(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })

    // Save token in encrypted session via h3's built-in useSession
    const session = await useSession(event, { password: config.sessionPassword })
    await session.update({
      accessToken: response.access_token,
      instanceUrl: response.instance_url,
      userId: response.id
    })

    // Redirect user back to the homepage after successful login
    return sendRedirect(event, '/')
  } catch (err: any) {
    console.error('Salesforce OAuth Error:', err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to exchange token with Salesforce.' })
  }
})
