import { GoogleGenAI } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import commonSchema from './common_schema.json';
import { logToolTrace, logger } from './logger';
import type { chatMessage, McpToolCallArgs } from '../../types/mcp';

/**
 * Service responsible for orchestrating the Gemini LLM agent.
 * Handles primary/fallback API key rotation, system prompt generation,
 * MCP (Model Context Protocol) connection to the Python backend, 
 * and the dynamic tool execution loop.
 */
export class GeminiService {
  private primaryKey: string;
  private fallbackKey?: string;
  private accessToken: string;
  private instanceUrl: string;
  private mcpServerUrl: string;
  private reqId: string;

  constructor(primaryKey: string, accessToken: string, instanceUrl: string, mcpServerUrl: string, reqId: string, fallbackKey?: string) {
    this.primaryKey = primaryKey;
    this.accessToken = accessToken;
    this.instanceUrl = instanceUrl;
    this.mcpServerUrl = mcpServerUrl;
    this.reqId = reqId;
    this.fallbackKey = fallbackKey;
  }

  private getSystemInstruction(): string {
    const currentDate = new Date().toISOString().split('T')[0];
    
    return `You are an intelligent Salesforce Assistant. Your goal is to help the user query their Salesforce data.
Today's date is ${currentDate}. Use this for any relative date calculations (e.g., "this month", "last quarter").

You have access to a schema cache and routing rules:
${JSON.stringify(commonSchema, null, 2)}

If the user asks for an object, field, or relationship that is NOT in the cache, you MUST use your schema discovery tools (like find_object_api_name or execute_salesforce_graphql) to introspect the Salesforce schema before writing your query. Never guess custom API names (e.g., __c).

Always format your final response clearly, using Markdown tables or lists as appropriate.
Do not invent data; only show what the query returns.

--- GRAPH (NEO4J) RULES ---
When writing Cypher queries, always refer strictly to the schema and hydration rules defined in the \`query_neo4j_graph\` tool description.

--- FUZZY NAME MATCHING ---
Whenever the user refers to a company, record, or rep by name, NEVER use an exact equality check (=). 
Always use a case-insensitive partial match:
- In SOQL: Use \`LIKE '%term%'\`
- In Cypher: Use \`toLower(node.name) CONTAINS toLower('term')\`

If multiple records match the term:
- 1 result: Proceed confidently.
- 2-4 results: STOP. Ask the user: "I found a few matches for '[term]': [list names]. Which one did you mean?"
- 5+ results: STOP. Tell the user their search term is too generic.`;
  }

  /**
   * Main entry point for chatting with the agent.
   * Attempts to fulfill the request using the primary API key,
   * automatically falling back to the secondary key on rate limits or API outages.
   * 
   * @param historyMessages Previous chat history for context.
   * @param userMessage The new user prompt.
   * @returns The final text response from the LLM.
   */
  async executeChat(historyMessages: chatMessage[], userMessage: string): Promise<string> {
    const keys = [this.primaryKey, this.fallbackKey].filter(Boolean) as string[];

    for (const [index, key] of keys.entries()) {
      try {
        return await this.runChat(key, historyMessages, userMessage);
      } catch (error: any) {
        const isLast = index === keys.length - 1;

        if (!isLast && this.isRetryable(error)) {
          console.log(`Attempt with key ${index + 1} failed with error:`, error?.message || error);
          console.log('Falling back to secondary key...');
          continue;
        }

        if (this.isRetryable(error)) {
          return "⚠️ **Service Unavailable:** The assistant is currently unreachable. Please try again later.";
        }

        throw error;
      }
    }

    throw new Error('No API keys configured');
  }

  /**
   * Determines if a Gemini API error is transient and safe to retry 
   * using the fallback API key (e.g., rate limits, 5xx errors, network timeouts).
   */
  private isRetryable(error: any): boolean {
    if (!error) return false;

    // Check HTTP status codes and standard error codes
    const status = error?.status || error?.code || error?.error?.code || error?.error?.status;
    if (status === 429 || status === '429' || status === 'RESOURCE_EXHAUSTED') return true;
    if (typeof status === 'number' && status >= 500) return true;
    if (typeof status === 'string' && (status.startsWith('5') || status === 'UNAVAILABLE')) return true;

    // Check Node.js system error codes
    const code = error?.code || error?.cause?.code;
    if (['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED'].includes(code)) return true;
    
    // Check error name
    if (['FetchError', 'TimeoutError', 'AbortError'].includes(error?.name)) return true;

    // Fallback: check message
    const message = (error?.message || error?.error?.message || '').toLowerCase();
    return ['timeout', 'network', 'unreachable', 'fetch failed', 'high demand']
      .some(keyword => message.includes(keyword));
  }

  /**
   * Core agent execution flow:
   * 1. Establishes an SSE connection to the Python FastMCP server, passing OAuth tokens via headers.
   * 2. Dynamically fetches available Salesforce/Neo4j tools.
   * 3. Initializes Gemini with the system prompt and available tools.
   * 4. Enters a dynamic execution loop, resolving parallel tool calls requested by the LLM
   *    until it provides a final text response or hits the recursion limit (5 iterations).
   */
  private async runChat(apiKey: string, historyMessages: chatMessage[], userMessage: string): Promise<string> {
    if (!apiKey) throw new Error("API Key is missing");
    
    // 1. Establish the MCP Connection
    // We pass the auth tokens as custom headers to the Python server's SSE endpoint
    const mcpUrl = new URL(this.mcpServerUrl);
    
    const headers = {
      'x-sf-access-token': this.accessToken,
      'x-sf-instance-url': this.instanceUrl,
      'x-correlation-id': this.reqId
    };

    const transport = new SSEClientTransport(mcpUrl, {
      eventSourceInit: { headers } as any,
      requestInit: { headers }
    });
    const mcpClient = new Client({ name: "nuxt-agent", version: "1.0.0" }, { capabilities: {} });
    
    await mcpClient.connect(transport);
    
    try {
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
      logger.debug({ functionCalls: response.functionCalls }, 'LLM response function calls');
      // 4. Dynamic Execution Loop — limit is 5 to support:
      //    fuzzy-match lookup (1) + traversal (2) + follow-up tool calls for complex multi-hop queries (3-5)
      while (response.functionCalls && response.functionCalls.length > 0 && iterations < 5) {
        iterations++;
        
        const functionResponses = await Promise.all(response.functionCalls.map(async (functionCall) => {
          // Forward the request to the MCP server
          const result = await mcpClient.callTool({
            name: functionCall.name!,
            arguments: functionCall.args as McpToolCallArgs 
          });

          const formattedResult = { data: result.content };

          // 5. Structured Tool Trace Logging (Async, non-blocking)
          logToolTrace({
            correlationId: this.reqId,
            iteration: iterations,
            functionCall: {
              name: functionCall.name,
              args: functionCall.args
            },
            functionResponse: formattedResult
          });

          return {
            functionResponse: {
              name: functionCall.name!,
              response: formattedResult
            }
          };
        }));

        // SDK type doesn't expose the functionResponse[] overload; cast is intentional
        response = await chat.sendMessage({ message: functionResponses as any });
      }

      if (iterations >= 5 && !response.text) {
        return "I needed to look up too many things at once and reached my limit. Could you please narrow down your request?";
      }

      return response.text || "";
    } finally {
      await transport.close();
    }
  }
}
