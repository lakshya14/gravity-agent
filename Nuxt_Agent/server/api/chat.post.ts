export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const session = await useSession(event, { password: config.sessionPassword });

  if (!session.data.accessToken || !session.data.instanceUrl) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized. Please login to Salesforce.' });
  }

  const { accessToken, instanceUrl } = session.data;
  const body = await readBody(event);
  const messages = body.messages || [];
  if (!messages.length) {
    throw createError({ statusCode: 400, statusMessage: 'Message history is required.' });
  }
  
  const userMessage = messages[messages.length - 1].content;

  // Exclude the last message for history
  const historyMessages = messages.slice(0, -1).map((m: any) => ({
    role: m.role === 'bot' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  try {
    // Instantiate our new services
    const sfService = new SalesforceService(accessToken, instanceUrl);
    const geminiService = new GeminiService(
      config.geminiApiKey as string, 
      sfService, 
      config.geminiApiKey2 as string
    );

    // Execute the chat using the Service layer
    const text = await geminiService.executeChat(historyMessages, userMessage);
    return { reply: text };
  } catch (error: any) {
    console.error('API Error:', error);
    
    // Pass up user-friendly error messages from GeminiService
    if (typeof error === 'string') {
        return { reply: error };
    }

    throw createError({ statusCode: 500, statusMessage: 'Failed to communicate with AI model.' });
  }
});
