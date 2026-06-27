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

    handleSalesforceError(recentRecords);
    handleSalesforceError(closedRecords);

    return {
      recent: recentRecords,
      closed: closedRecords,
    };
  } catch (error: any) {
    console.error('Error fetching opportunities:', error);
    if (error.response?.status === 401 || error.statusCode === 401) {
      throw createError({ statusCode: 401, statusMessage: 'Session expired. Please login again.' });
    }
    throw createError({ 
      statusCode: error.statusCode || 500, 
      statusMessage: error.statusMessage || error.message || 'Failed to fetch opportunities from Salesforce.' 
    });
  }
});
