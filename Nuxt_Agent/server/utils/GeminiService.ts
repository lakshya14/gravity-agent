import { GoogleGenAI } from '@google/genai';
import commonSchema from './common_schema.json';
import { SalesforceService } from './SalesforceService';

export class GeminiService {
  private primaryKey: string;
  private fallbackKey?: string;
  private sfService: SalesforceService;

  constructor(primaryKey: string, sfService: SalesforceService, fallbackKey?: string) {
    this.primaryKey = primaryKey;
    this.fallbackKey = fallbackKey;
    this.sfService = sfService;
  }

  private getSystemInstruction(): string {
    return `You are an intelligent Salesforce Assistant. Your goal is to help the user query their Salesforce data.
You have access to a common schema cache:
${JSON.stringify(commonSchema, null, 2)}

If the user mentions an object but you don't know its exact API name (especially custom objects), use the find_object_api_name tool to search for it using its label.
If the user asks about an object not in the cache, or needs fields not listed, use the get_object_metadata tool first (you need the API name for this).
CRITICAL: You MUST use the run_soql_query tool to execute the query. DO NOT just show the SOQL to the user. You must fetch the actual data using the tool and then present the results.
If the user asks to modify a record, use the update_salesforce_record tool to make the change. Ensure you have the record's exact ID first (you may need to query for it if the user only provides the name).
Always format your final response to the user clearly, using Markdown tables or lists as appropriate.
Do not invent data; only show what the query returns.`;
  }

  private getTools() {
    return [{
      functionDeclarations: [
        {
          name: "run_soql_query",
          description: "Run a SOQL query against the user's Salesforce instance and return the records.",
          parameters: {
            type: "OBJECT",
            properties: {
              query: { type: "STRING", description: "The SOQL query string." }
            },
            required: ["query"]
          }
        },
        {
          name: "get_object_metadata",
          description: "Get the fields and metadata for a specific Salesforce object.",
          parameters: {
            type: "OBJECT",
            properties: {
              objectName: { type: "STRING", description: "The API name of the Salesforce object." }
            },
            required: ["objectName"]
          }
        },
        {
          name: "update_salesforce_record",
          description: "Modify an existing Salesforce record. Provide object name, ID, and fields.",
          parameters: {
            type: "OBJECT",
            properties: {
              objectName: { type: "STRING", description: "API name of the Salesforce object." },
              id: { type: "STRING", description: "The 15 or 18 character Salesforce ID." },
              fields: { type: "OBJECT", description: "JSON object mapping API field names to new values." }
            },
            required: ["objectName", "id", "fields"]
          }
        },
        {
          name: "find_object_api_name",
          description: "Search for a Salesforce object's API name based on its UI label.",
          parameters: {
            type: "OBJECT",
            properties: {
              label: { type: "STRING", description: "The label of the object to search for." }
            },
            required: ["label"]
          }
        }
      ]
    }];
  }

  /**
   * Executes a chat round with the Gemini model, invoking tools as needed.
   * @param historyMessages The conversational history.
   * @param userMessage The new user message.
   * @returns The text response from the model.
   */
  async executeChat(historyMessages: any[], userMessage: string): Promise<string> {
    const getStatus = (e: any) => e?.status || e?.code || e?.error?.code || e?.error?.status;
    const getMessage = (e: any) => (e?.message || e?.error?.message || '').toLowerCase();

    const isQuotaExceeded = (e: any) => {
      const status = getStatus(e);
      return status === 429 || status === '429' || status === 'RESOURCE_EXHAUSTED';
    };

    const isRetryable = (e: any) => {
      if (!e) return false;
      if (isQuotaExceeded(e)) return true;
      
      const status = getStatus(e);
      if (typeof status === 'number' && status >= 500) return true;
      if (typeof status === 'string' && (status.startsWith('5') || status === 'UNAVAILABLE')) return true;
      
      const msg = getMessage(e);
      return ['timeout', 'network', 'unreachable', 'fetch failed', 'econnreset', 'enotfound', 'econnrefused', 'high demand'].some(keyword => msg.includes(keyword));
    };

    try {
      return await this.runChat(this.primaryKey, historyMessages, userMessage);
    } catch (error: any) {
      if (isRetryable(error) && this.fallbackKey) {
        console.log(`Primary API key failed. Falling back to secondary key...`);
        try {
          return await this.runChat(this.fallbackKey, historyMessages, userMessage);
        } catch (fallbackError: any) {
          if (isQuotaExceeded(fallbackError)) {
            return "⚠️ **High Traffic:** We are currently experiencing an unusually high volume of requests. Please try again in a few moments.";
          } else if (isRetryable(fallbackError)) {
            return "⚠️ **Service Unavailable:** The assistant is currently unreachable. Please try again later.";
          }
          throw fallbackError;
        }
      }
      if (isQuotaExceeded(error)) {
        return "⚠️ **High Traffic:** We are currently experiencing an unusually high volume of requests. Please try again in a few moments.";
      } else if (isRetryable(error)) {
        return "⚠️ **Service Unavailable:** The assistant is currently unreachable. Please try again later.";
      }
      throw error;
    }
  }

  /**
   * Validates a SOQL query to ensure it is read-only and structurally sound.
   * @param query The SOQL query string.
   * @returns An error string if invalid, or null if valid.
   */
  private validateSoqlQuery(query: string): string | null {
    if (!query || typeof query !== 'string') {
      return "Validation Error: Query must be a non-empty string.";
    }
    
    const trimmedQuery = query.trim();
    if (!trimmedQuery.toLowerCase().startsWith('select')) {
      return "Validation Error: Only SELECT queries are allowed. Do not attempt DML operations (INSERT, UPDATE, DELETE) via SOQL.";
    }
    
    return null;
  }

  private async runChat(apiKey: string, historyMessages: any[], userMessage: string): Promise<string> {
    if (!apiKey) throw new Error("API Key is missing");
    
    const aiInstance = new GoogleGenAI({ apiKey });
    const chat = aiInstance.chats.create({
      model: 'gemini-2.5-flash',
      history: historyMessages,
      config: {
        systemInstruction: this.getSystemInstruction(),
        temperature: 0.2,
        tools: this.getTools()
      }
    });

    let response = await chat.sendMessage({ message: userMessage });
    let iterations = 0;

    while (response.functionCalls && response.functionCalls.length > 0 && iterations < 3) {
      iterations++;
      const functionCall = response.functionCalls[0];
      const { name, args } = functionCall;
      
      let result;
      if (name === 'run_soql_query') {
        const queryStr = args.query as string;
        const validationError = this.validateSoqlQuery(queryStr);
        if (validationError) {
          result = { error: validationError };
        } else {
          result = await this.sfService.runSoqlQuery(queryStr);
        }
      } else if (name === 'get_object_metadata') {
        result = await this.sfService.getObjectMetadata(args.objectName as string);
      } else if (name === 'update_salesforce_record') {
        result = await this.sfService.updateRecord(args.objectName as string, args.id as string, args.fields);
      } else if (name === 'find_object_api_name') {
        result = await this.sfService.findObjectApiName(args.label as string);
      }

      const formattedResult = (Array.isArray(result) || typeof result !== 'object') 
        ? { data: result } 
        : result;

      response = await chat.sendMessage({
        message: [{
          functionResponse: {
            name,
            response: formattedResult
          }
        }]
      });
    }

    return response.text;
  }
}
