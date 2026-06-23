export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Authorization code missing' })
  }

  const config = useRuntimeConfig()
  const tokenUrl = `${config.salesforceLoginUrl}/services/oauth2/token`
  
  const session = await useSession(event, { password: config.sessionPassword })
  const codeVerifier = session.data.codeVerifier
  if (!codeVerifier) {
    throw createError({ statusCode: 400, statusMessage: 'Missing PKCE code verifier' })
  }

  const params = new URLSearchParams()
  params.append('grant_type', 'authorization_code')
  params.append('client_id', config.salesforceClientId)
  params.append('client_secret', config.salesforceClientSecret)
  params.append('redirect_uri', 'http://localhost:3000/api/auth/callback')
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
