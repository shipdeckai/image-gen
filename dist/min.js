#!/usr/bin/env node

// dist/min.js - MINIMAL MCP SERVER FOR TESTING
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");

// Force ALL logs to stderr, never stdout
console.log = (...a) => console.error("[LOG->stderr]", ...a);

const server = new Server({
  name: "min-test",
  version: "0.0.1"
}, {
  capabilities: {
    tools: {}
  }
});

// Trivial tool just to prove handshake works
server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: "health.ping",
    description: "Check if server is running",
    inputSchema: { type: "object", properties: {} }
  }]
}));

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'health.ping') {
    return { content: [{ type: 'text', text: 'ok' }] };
  }
  throw new Error('Unknown tool');
});

// CRITICAL: Connect immediately, no other work
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error("[min-test] ready on stderr");
});

// Instant exit when client closes
["end", "close", "error"].forEach(e =>
  process.stdin.on(e, () => {
    console.error(`[min-test] stdin ${e} - exiting`);
    process.exit(0);
  })
);
process.stdout.on("error", () => {
  console.error("[min-test] stdout error - exiting");
  process.exit(0);
});

// Keep alive but don't block exit
setInterval(() => {}, 1 << 30).unref();