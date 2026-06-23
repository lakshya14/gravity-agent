import crypto from 'crypto';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  
  const clientId = config.salesforceClientId
  
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host')
  const protocol = getRequestHeader(event, 'x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https')
  const redirectUri = `${protocol}://${host}/api/auth/callback`
  
  const query = getQuery(event)
  const env = query.env as string
  let loginUrl = config.salesforceLoginUrl as string
  if (env === 'sandbox') {
    loginUrl = 'https://test.salesforce.com'
  }

  if (!clientId) {
    throw createError({ statusCode: 500, statusMessage: 'Salesforce Client ID not configured.' })
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  // Store the code_verifier and dynamic loginUrl in session
  const session = await useSession(event, { password: config.sessionPassword });
  await session.update({ codeVerifier, loginUrl });

  const authUrl = new URL(`${loginUrl}/services/oauth2/authorize`)
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('client_id', clientId)
  authUrl.searchParams.append('redirect_uri', redirectUri)
  authUrl.searchParams.append('code_challenge', codeChallenge)
  authUrl.searchParams.append('code_challenge_method', 'S256')
  
  // Scopes requested from Salesforce
  authUrl.searchParams.append('scope', 'api refresh_token offline_access')

  return sendRedirect(event, authUrl.toString())
})
