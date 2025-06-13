# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that enables AI tools to log their activities to daily worklog files. The server provides a single `log_activity` tool that creates timestamped entries with comprehensive metrics tracking.

## Development Commands

```bash
# Start the MCP server
npm start

# Development mode with auto-restart
npm run dev

# Install dependencies
npm install

# Linting
npm run lint           # Check code style
npm run lint:fix       # Fix linting issues automatically

# Testing
npm run test           # Run unit tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report

# Before committing/pushing to GitHub
npm run lint && npm run test
```

## Architecture

**Core Components:**
- `src/index.js` - Main MCP server implementation using @modelcontextprotocol/sdk
- `logs/` - Directory containing daily worklog markdown files (auto-generated, format: `worklog-YYYY-MM-DD.md`)

**Key Classes:**
- `WorkHistoryServer` - Main server class that handles MCP protocol communication and tool execution

**Tool Implementation:**
- Single tool: `log_activity` with comprehensive parameter schema
- Supports both required fields (tool_name, log_message) and optional metrics (tokens, duration, cost, tags, etc.)
- Creates structured markdown entries with emoji status indicators (✅/❌)

## Log File Format

Daily logs follow this structure:
```markdown
# 📝 Work Log - YYYY-MM-DD

- ✅ HH:MM - Tool Name (ai-model): Activity description (metadata | [tags])
- ❌ HH:MM - Tool Name: Failed activity (❌ Error message | [tags])
```

## MCP Integration

The server registers as an MCP tool provider with:
- Tool name: `log_activity`
- Comprehensive input schema with required and optional parameters
- Proper error handling and response formatting
- Automatic directory creation for logs

## Key Implementation Details

- Uses ES modules (`"type": "module"` in package.json)
- File operations use `fs/promises` for async handling
- Timestamps formatted as HH:MM in local time
- Metadata formatting includes tokens, context length, duration, cost, and tags
- Status tracking with success/failure indicators