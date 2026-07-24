import { GoogleGenAI } from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import commonSchema from './common_schema.json';
import { chatMessage } from '../../types/mcp';
import {McpToolCallArgs } from '../../types/mcp';
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
    return `You are an intelligent Salesforce Assistant. Your goal is to help the user query their Salesforce data.
You have access to a common schema cache:
${JSON.stringify(commonSchema, null, 2)}

If the user mentions an object but you don't know its exact API name, or if you need to know its fields, use the execute_salesforce_graphql tool with a schema introspection query.
CRITICAL: You MUST use the execute_salesforce_graphql tool to fetch standard records. 
If the user asks for aggregate data (like COUNT, MAX, GROUP BY), you MUST use the execute_salesforce_soql tool.
Always format your final response clearly, using Markdown tables or lists as appropriate.
Do not invent data; only show what the query returns.

When using the query_neo4j_graph tool:
- The tool returns enriched results hydrated from Salesforce, NOT raw Cypher output.
- Graph nodes and their structural properties:
    Account     : id, name, industry, country, type
    Opportunity : id, name, stageName, closeDate, type
    User        : id, name, title  (the record owner / sales rep — NOT hydrated from SF)
- Graph edges:
    (Account)-[:HAS_OPPORTUNITY]->(Opportunity)
    (User)-[:OWNS]->(Account)
    (User)-[:OWNS]->(Opportunity)
- DO NOT query for Amount, AnnualRevenue, Email, Phone in Cypher — those are hydrated from Salesforce automatically.
- User nodes are self-contained in the graph (name + title already stored). Return them directly from Cypher — no Salesforce hydration needed.
- The response includes metadata: \`redacted_count\` (records hidden due to user permissions) and \`truncated_count\` (results capped for performance).
- If \`redacted_count > 0\`, inform the user that some results were hidden due to their access permissions. Do not speculate about the hidden data.
- If \`truncated_count > 0\`, inform the user that results were capped and suggest they refine their query.

FUZZY NAME MATCHING — follow this protocol whenever the user refers to a company, record, or rep by name:

STEP 1 — Always search with a case-insensitive partial match, never an exact equality check.
  For Accounts:      MATCH (a:Account) WHERE toLower(a.name) CONTAINS toLower($term) RETURN a.id, a.name
  For Users / reps:  MATCH (u:User) WHERE toLower(u.name) CONTAINS toLower($term) RETURN u.id, u.name, u.title
  Use this as a candidate lookup before writing any traversal query.

STEP 2 — Decide based on what comes back:
  - EXACTLY ONE result → HIGH CONFIDENCE. Proceed with the full query using that record's id.
    Disclose to the user: "I'm showing results for **[exact name]** — let me know if you meant someone else."
  - TWO TO FOUR results → AMBIGUOUS. Do NOT guess. Ask the user:
    "I found a few matches for '[user term]': [list names]. Which one did you mean?"
    Wait for confirmation before running the traversal.
  - FIVE OR MORE results → TOO BROAD. Tell the user their search term is too generic and ask them to be more specific.
  - ZERO results → NO MATCH. Tell the user no record was found matching that name and suggest checking the spelling.

STEP 3 — Once you have a confirmed id, write the actual Cypher traversal using id-based filtering for precision.`;
  }

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

  private isRetryable(error: any): boolean {
    if (!error) return false;

    const status = error?.status || error?.code || error?.error?.code || error?.error?.status;
    if (status === 429 || status === '429' || status === 'RESOURCE_EXHAUSTED') return true;
    if (typeof status === 'number' && status >= 500) return true;
    if (typeof status === 'string' && (status.startsWith('5') || status === 'UNAVAILABLE')) return true;

    const message = (error?.message || error?.error?.message || '').toLowerCase();
    return ['timeout', 'network', 'unreachable', 'fetch failed', 'econnreset', 'enotfound', 'econnrefused', 'high demand']
      .some(keyword => message.includes(keyword));
  }

  private async runChat(apiKey: string, historyMessages: chatMessage[], userMessage: string): Promise<string> {
    if (!apiKey) throw new Error("API Key is missing");
    
    // 1. Establish the MCP Connection
    // We pass the auth tokens as query parameters to the Python server's SSE endpoint
    const mcpUrl = new URL(this.mcpServerUrl);
    mcpUrl.searchParams.append('access_token', this.accessToken);
    mcpUrl.searchParams.append('instance_url', this.instanceUrl);
    mcpUrl.searchParams.append('correlation_id', this.reqId);

    const transport = new SSEClientTransport(mcpUrl);
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

      // 4. Dynamic Execution Loop — limit is 5 to support:
      //    fuzzy-match lookup (1) + traversal (2) + follow-up tool calls for complex multi-hop queries (3-5)
      while (response.functionCalls && response.functionCalls.length > 0 && iterations < 5) {
        iterations++;
        const functionCall = response.functionCalls[0];
        
        // Instead of an if/else block, we blindly forward the request to the MCP server!
        const result = await mcpClient.callTool({
          name: functionCall.name,
          arguments: functionCall.args as McpToolCallArgs 
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

      return response.text;
    } finally {
      await transport.close();
    }
  }
}
