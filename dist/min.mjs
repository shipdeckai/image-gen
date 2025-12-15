#!/usr/bin/env node

// MINIMAL MCP SERVER FOR TESTING - Using exact same pattern as main server
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// Force ALL logs to stderr, never stdout
console.log = (...a) => console.error("[LOG->stderr]", ...a);

// Guard stdout before anything else
const origWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, enc, cb) => {
  const s = typeof chunk === "string" ? chunk : (chunk?.toString?.() ?? "");
  if (s && !s.startsWith('{"jsonrpc":') && !s.startsWith('Content-Length:')) {
    console.error("[ILLEGAL-STDOUT]", s.slice(0, 160));
  }
  return origWrite(chunk, enc, cb);
};

const server = new Server({
  name: "min-test",
  version: "0.0.1"
}, {
  capabilities: {
    tools: {}
  }
});

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "health.ping",
    description: "Check if server is running",
    inputSchema: { type: "object", properties: {} }
  }]
}));

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'health.ping') {
    return {
      content: [{
        type: 'text',
        text: 'ok from minimal server'
      }]
    };
  }
  throw new Error('Unknown tool: ' + request.params.name);
});

// CRITICAL: Connect immediately, no other work before this
console.error("[min-test] Starting connection...");
const transport = new StdioServerTransport();
await server.connect(transport);

// Log AFTER connection
console.error("[min-test] MCP server started and connected");

// NOW add exit handlers AFTER connection
process.stdin.once("end", () => {
  console.error("[min-test] stdin end - exiting");
  process.exit(0);
});
process.stdin.once("close", () => {
  console.error("[min-test] stdin close - exiting");
  process.exit(0);
});
process.stdout.once("error", () => {
  console.error("[min-test] stdout error - exiting");
  process.exit(0);
});

// Keep alive but don't block
setInterval(() => {}, 1 << 30).unref();