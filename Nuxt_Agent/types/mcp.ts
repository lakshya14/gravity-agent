// types/mcp.ts

export type McpToolCallArgs = Record<string, unknown>;

export interface McpToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}
export interface chatMessage {
  role: string;
  parts: Array<{
    text: string;
  }>;
}
