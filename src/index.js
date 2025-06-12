#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkHistoryServer {
  constructor() {
    this.server = new Server(
      {
        name: "mcp-work-history",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "log_activity",
            description: "Log AI tool activity to a daily worklog file with comprehensive metrics",
            inputSchema: {
              type: "object",
              properties: {
                tool_name: {
                  type: "string",
                  description: "Name of the AI tool that performed the activity (e.g., 'Warp', 'Claude Code', 'GitHub Copilot')"
                },
                log_message: {
                  type: "string",
                  description: "Detailed log message describing what was accomplished"
                },
                ai_model: {
                  type: "string",
                  description: "AI model used (e.g., 'gemini-2.5-pro', 'claude-3-sonnet', 'gpt-4')"
                },
                tokens_used: {
                  type: "number",
                  description: "Total tokens consumed in the request (optional)"
                },
                input_tokens: {
                  type: "number",
                  description: "Input tokens used (optional)"
                },
                output_tokens: {
                  type: "number",
                  description: "Output tokens generated (optional)"
                },
                context_length: {
                  type: "number",
                  description: "Context window length used (optional)"
                },
                duration_ms: {
                  type: "number",
                  description: "Duration of the operation in milliseconds (optional)"
                },
                cost_usd: {
                  type: "number",
                  description: "Estimated cost in USD (optional)"
                },
                success: {
                  type: "boolean",
                  description: "Whether the operation was successful (optional, defaults to true)"
                },
                error_message: {
                  type: "string",  
                  description: "Error message if operation failed (optional)"
                },
                tags: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "Tags to categorize the activity (e.g., ['coding', 'debugging', 'refactoring']) (optional)"
                }
              },
              required: ["tool_name", "log_message"]
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === "log_activity") {
        return await this.handleLogActivity(request.params.arguments);
      }
      
      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  async handleLogActivity(args) {
    try {
      const { 
        tool_name, 
        log_message,
        ai_model,
        tokens_used,
        input_tokens,
        output_tokens,
        context_length,
        duration_ms,
        cost_usd,
        success = true,
        error_message,
        tags
      } = args;
      
      if (!tool_name || !log_message) {
        throw new Error("tool_name and log_message are required");
      }

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const logsDir = path.join(__dirname, '..', 'logs');
      const logFileName = `worklog-${dateStr}.md`;
      const logFilePath = path.join(logsDir, logFileName);

      // Ensure logs directory exists
      await fs.mkdir(logsDir, { recursive: true });

      let logContent = '';
      let fileExists = false;

      try {
        await fs.access(logFilePath);
        fileExists = true;
        logContent = await fs.readFile(logFilePath, 'utf-8');
      } catch (error) {
        // File doesn't exist, create new content
        logContent = `# 📝 Work Log - ${dateStr}\n\n`;
      }

      // Build the log entry with optional metadata
      let logEntry = `${timeStr} - ${tool_name}`;
      
      if (ai_model) {
        logEntry += ` (${ai_model})`;
      }
      
      logEntry += `: ${log_message}`;
      
      // Add optional metadata
      const metadata = [];
      
      if (tokens_used !== undefined) {
        metadata.push(`${tokens_used} tokens`);
      } else if (input_tokens !== undefined || output_tokens !== undefined) {
        const inTokens = input_tokens || 0;
        const outTokens = output_tokens || 0;
        metadata.push(`${inTokens + outTokens} tokens (${inTokens}→${outTokens})`);
      }
      
      if (context_length !== undefined) {
        metadata.push(`${context_length}k ctx`);
      }
      
      if (duration_ms !== undefined) {
        const seconds = duration_ms >= 1000 ? `${(duration_ms / 1000).toFixed(1)}s` : `${duration_ms}ms`;
        metadata.push(seconds);
      }
      
      if (cost_usd !== undefined) {
        metadata.push(`$${cost_usd.toFixed(4)}`);
      }
      
      if (!success && error_message) {
        metadata.push(`❌ ${error_message}`);
      }
      
      if (tags && tags.length > 0) {
        metadata.push(`[${tags.join(', ')}]`);
      }
      
      if (metadata.length > 0) {
        logEntry += ` (${metadata.join(' | ')})`;
      }
      
      const statusIcon = success ? '✅' : '❌';
      const newEntry = `- ${statusIcon} ${logEntry}\n`;
      
      // If it's a new file, add it directly. Otherwise, append to existing content
      if (!fileExists) {
        logContent += newEntry;
      } else {
        // Insert at the end of the file
        logContent += newEntry;
      }

      await fs.writeFile(logFilePath, logContent, 'utf-8');

      return {
        content: [
          {
            type: "text",
            text: `✅ Activity logged: ${logEntry}${fileExists ? '' : ' (new file created)'}`
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error logging activity: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MCP Work History Server running on stdio");
  }
}

const server = new WorkHistoryServer();
server.run().catch(console.error);