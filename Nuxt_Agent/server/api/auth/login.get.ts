import crypto from 'crypto';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  
  const clientId = config.salesforceClientId
  const redirectUri = 'http://localhost:3000/api/auth/callback'
  const loginUrl = config.salesforceLoginUrl

  if (!clientId) {
    throw createError({ statusCode: 500, statusMessage: 'Salesforce Client ID not configured.' })
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  // Store the code_verifier in session
  const session = await useSession(event, { password: config.sessionPassword });
  await session.update({ codeVerifier });

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
