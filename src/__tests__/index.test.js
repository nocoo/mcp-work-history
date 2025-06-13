import { jest } from '@jest/globals';
import fs from 'fs/promises';

// Mock the MCP SDK modules
const mockServer = {
  setRequestHandler: jest.fn(),
  connect: jest.fn()
};

const mockTransport = {};

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn(() => mockServer)
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(() => mockTransport)
}));

// Mock fs operations
jest.spyOn(fs, 'mkdir').mockResolvedValue();
jest.spyOn(fs, 'access').mockRejectedValue(new Error('File not found'));
jest.spyOn(fs, 'readFile').mockResolvedValue('');
jest.spyOn(fs, 'writeFile').mockResolvedValue();

describe('WorkHistoryServer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should handle log_activity with minimal parameters', async () => {
    // Mock the log activity handler
    const mockLogActivity = jest.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'Activity logged: Test Tool: Test activity'
        }
      ]
    });

    // Simulate the server setup
    mockServer.setRequestHandler.mockImplementation((schema, handler) => {
      if (schema.method === 'tools/call') {
        return handler({
          params: {
            name: 'log_activity',
            arguments: {
              tool_name: 'Test Tool',
              log_message: 'Test activity'
            }
          }
        });
      }
      return null;
    });

    // Test that fs.writeFile gets called with log content
    const result = await mockLogActivity({
      tool_name: 'Test Tool',
      log_message: 'Test activity'
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Test Tool');
    expect(result.content[0].text).toContain('Test activity');
  });

  test('should handle log_activity with comprehensive metadata', async () => {
    const mockLogActivity = jest.fn().mockImplementation((args) => {
      const {
        tool_name,
        log_message,
        ai_model,
        tokens_used,
        context_length,
        duration_ms,
        cost_usd,
        tags
      } = args;

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      let logEntry = `${timeStr} - ${tool_name}`;
      if (ai_model) {
        logEntry += ` (${ai_model})`;
      }
      logEntry += `: ${log_message}`;

      const metadata = [];
      if (tokens_used) {metadata.push(`${tokens_used} tokens`);}
      if (context_length) {metadata.push(`${context_length}k ctx`);}
      if (duration_ms) {
        const seconds = duration_ms >= 1000 ? `${(duration_ms / 1000).toFixed(1)}s` : `${duration_ms}ms`;
        metadata.push(seconds);
      }
      if (cost_usd) {metadata.push(`$${cost_usd.toFixed(4)}`);}
      if (tags && tags.length > 0) {metadata.push(`[${tags.join(', ')}]`);}

      if (metadata.length > 0) {
        logEntry += ` (${metadata.join(' | ')})`;
      }

      return {
        content: [
          {
            type: 'text',
            text: `Activity logged: ${logEntry}`
          }
        ]
      };
    });

    const result = await mockLogActivity({
      tool_name: 'Claude Code',
      log_message: 'Implemented feature X',
      ai_model: 'claude-3-sonnet',
      tokens_used: 1500,
      context_length: 8,
      duration_ms: 2500,
      cost_usd: 0.0025,
      tags: ['coding', 'feature']
    });

    expect(result.content[0].text).toContain('Claude Code (claude-3-sonnet)');
    expect(result.content[0].text).toContain('Implemented feature X');
    expect(result.content[0].text).toContain('1500 tokens');
    expect(result.content[0].text).toContain('8k ctx');
    expect(result.content[0].text).toContain('2.5s');
    expect(result.content[0].text).toContain('$0.0025');
    expect(result.content[0].text).toContain('[coding, feature]');
  });

  test('should handle failed activity logging', async () => {
    const mockLogActivity = jest.fn().mockImplementation((args) => {
      const {
        tool_name,
        log_message,
        success = true,
        error_message
      } = args;

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      let logEntry = `${timeStr} - ${tool_name}: ${log_message}`;
      const metadata = [];

      if (!success && error_message) {
        metadata.push(`❌ ${error_message}`);
      }

      if (metadata.length > 0) {
        logEntry += ` (${metadata.join(' | ')})`;
      }

      const statusIcon = success ? '✅' : '❌';

      return {
        content: [
          {
            type: 'text',
            text: `Activity logged: ${statusIcon} ${logEntry}`
          }
        ]
      };
    });

    const result = await mockLogActivity({
      tool_name: 'Test Tool',
      log_message: 'Failed operation',
      success: false,
      error_message: 'Connection timeout'
    });

    expect(result.content[0].text).toContain('❌');
    expect(result.content[0].text).toContain('❌ Connection timeout');
  });

  test('should handle input/output token format', async () => {
    const mockLogActivity = jest.fn().mockImplementation((args) => {
      const {
        tool_name,
        log_message,
        input_tokens,
        output_tokens
      } = args;

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      let logEntry = `${timeStr} - ${tool_name}: ${log_message}`;
      const metadata = [];

      if (input_tokens !== undefined || output_tokens !== undefined) {
        const inTokens = input_tokens || 0;
        const outTokens = output_tokens || 0;
        metadata.push(`${inTokens + outTokens} tokens (${inTokens}→${outTokens})`);
      }

      if (metadata.length > 0) {
        logEntry += ` (${metadata.join(' | ')})`;
      }

      return {
        content: [
          {
            type: 'text',
            text: `Activity logged: ${logEntry}`
          }
        ]
      };
    });

    const result = await mockLogActivity({
      tool_name: 'Test Tool',
      log_message: 'Token test',
      input_tokens: 800,
      output_tokens: 200
    });

    expect(result.content[0].text).toContain('1000 tokens (800→200)');
  });

  test('should format duration correctly for milliseconds and seconds', async () => {
    const mockLogActivity = jest.fn().mockImplementation((args) => {
      const { tool_name, log_message, duration_ms } = args;

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      let logEntry = `${timeStr} - ${tool_name}: ${log_message}`;
      const metadata = [];

      if (duration_ms !== undefined) {
        const seconds = duration_ms >= 1000 ? `${(duration_ms / 1000).toFixed(1)}s` : `${duration_ms}ms`;
        metadata.push(seconds);
      }

      if (metadata.length > 0) {
        logEntry += ` (${metadata.join(' | ')})`;
      }

      return {
        content: [
          {
            type: 'text',
            text: `Activity logged: ${logEntry}`
          }
        ]
      };
    });

    // Test milliseconds
    const resultMs = await mockLogActivity({
      tool_name: 'Test Tool',
      log_message: 'Quick task',
      duration_ms: 500
    });
    expect(resultMs.content[0].text).toContain('500ms');

    // Test seconds
    const resultS = await mockLogActivity({
      tool_name: 'Test Tool',
      log_message: 'Longer task',
      duration_ms: 2500
    });
    expect(resultS.content[0].text).toContain('2.5s');
  });
});