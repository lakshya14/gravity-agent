import { GoogleGenAI } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import commonSchema from './common_schema.json';

export class GeminiService {
  private primaryKey: string;
  private fallbackKey?: string;
  private accessToken: string;
  private instanceUrl: string;

  constructor(primaryKey: string, accessToken: string, instanceUrl: string, fallbackKey?: string) {
    this.primaryKey = primaryKey;
    this.accessToken = accessToken;
    this.instanceUrl = instanceUrl;
    this.fallbackKey = fallbackKey;
  }

  private getSystemInstruction(): string {
    return `You are an intelligent Salesforce Assistant. Your goal is to help the user query their Salesforce data.
You have access to a common schema cache:
${JSON.stringify(commonSchema, null, 2)}

If the user mentions an object but you don't know its exact API name, or if you need to know its fields, use the execute_salesforce_graphql tool with a schema introspection query.
CRITICAL: You MUST use the execute_salesforce_graphql tool to fetch standard records. 
If the user asks for aggregate data (like COUNT, MAX, GROUP BY), you MUST use the execute_salesforce_soql tool.
Always format your final response clearly, using Markdown tables or lists as appropriate.
Do not invent data; only show what the query returns.`;
  }

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

  private async runChat(apiKey: string, historyMessages: any[], userMessage: string): Promise<string> {
    if (!apiKey) throw new Error("API Key is missing");
    
    // 1. Establish the MCP Connection
    // We pass the auth tokens as query parameters to the Python server's SSE endpoint
    const mcpUrl = new URL('http://127.0.0.1:8000/sse');
    mcpUrl.searchParams.append('access_token', this.accessToken);
    mcpUrl.searchParams.append('instance_url', this.instanceUrl);

    const transport = new SSEClientTransport(mcpUrl);
    const mcpClient = new Client({ name: "nuxt-agent", version: "1.0.0" }, { capabilities: {} });
    
    await mcpClient.connect(transport);
    
    // 2. Fetch Tools Dynamically from Python Server
    const toolList = await mcpClient.listTools();
    const geminiTools = [{
      functionDeclarations: toolList.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }))
    }];

    // 3. Initialize Gemini
    const aiInstance = new GoogleGenAI({ apiKey });
    const chat = aiInstance.chats.create({
      model: 'gemini-2.5-flash',
      history: historyMessages,
      config: {
        systemInstruction: this.getSystemInstruction(),
        temperature: 0.2,
        tools: geminiTools
      }
    });

    let response = await chat.sendMessage({ message: userMessage });
    let iterations = 0;

    // 4. Dynamic Execution Loop
    while (response.functionCalls && response.functionCalls.length > 0 && iterations < 3) {
      iterations++;
      const functionCall = response.functionCalls[0];
      
      // Instead of an if/else block, we blindly forward the request to the MCP server!
      const result = await mcpClient.callTool({
        name: functionCall.name,
        arguments: functionCall.args as any
      });

      // Gemini expects the response inside an object
      const formattedResult = { data: result.content };

      response = await chat.sendMessage({
        message: [{
          functionResponse: {
            name: functionCall.name,
            response: formattedResult
          }
        }]
      });
    }

    // Always clean up the connection when done
    await transport.close();
    return response.text;
  }
}
