export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const session = await useSession(event, { password: config.sessionPassword });

  if (!session.data.accessToken || !session.data.instanceUrl) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized. Please login to Salesforce.' });
  }

  const { accessToken, instanceUrl } = session.data;

  const recentOppsQuery = 'SELECT Id, Name, StageName, Amount, CloseDate, IsClosed, IsWon FROM Opportunity ORDER BY CreatedDate DESC LIMIT 10';
  const closedOppsQuery = 'SELECT Id, Name, StageName, Amount, CloseDate, IsWon FROM Opportunity WHERE IsClosed = true ORDER BY CloseDate DESC LIMIT 10';

  const sfService = new SalesforceService(accessToken, instanceUrl);

  try {
    const [recentRecords, closedRecords] = await Promise.all([
      sfService.runSoqlQuery(recentOppsQuery),
      sfService.runSoqlQuery(closedOppsQuery)
    ]);

    // Handle case where query failed and returned error object from the service
    if (recentRecords.error) throw new Error(recentRecords.error);
    if (closedRecords.error) throw new Error(closedRecords.error);

    return {
      recent: recentRecords,
      closed: closedRecords,
    };
  } catch (error: any) {
    console.error('Error fetching opportunities:', error);
    if (error.response?.status === 401) {
      throw createError({ statusCode: 401, statusMessage: 'Session expired. Please login again.' });
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch opportunities from Salesforce.' });
  }
});
