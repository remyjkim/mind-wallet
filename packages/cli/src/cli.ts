#!/usr/bin/env node
// ABOUTME: CLI entry point for the mindwallet command
// ABOUTME: Parses subcommands and dispatches to wallet, fetch, pay, or mcp-server

import { loadConfig, configPath } from './config.js';
import { walletCommand } from './commands/wallet.js';
import { fetchCommand } from './commands/fetch.js';
import { payCommand } from './commands/pay.js';
import { startMcpServer } from './mcp-server.js';

const [, , command, ...args] = process.argv;

async function main() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'wallet') {
    const config = loadConfig();
    await walletCommand(config);
    return;
  }

  if (command === 'fetch') {
    const url = args[0];
    if (!url) {
      console.error('Usage: mindwallet fetch <url> [--verbose] [--method GET]');
      process.exitCode = 1;
      return;
    }
    const config = loadConfig();
    const verbose = args.includes('--verbose') || args.includes('-v');
    const methodIdx = args.indexOf('--method');
    const method = methodIdx >= 0 ? args[methodIdx + 1] : undefined;
    await fetchCommand(url, config, { verbose, method });
    return;
  }

  if (command === 'pay') {
    const url = args[0];
    if (!url) {
      console.error('Usage: mindwallet pay <url> [--verbose]');
      process.exitCode = 1;
      return;
    }
    const config = loadConfig();
    const verbose = args.includes('--verbose') || args.includes('-v');
    await payCommand(url, config, { verbose });
    return;
  }

  if (command === 'mcp') {
    const config = loadConfig();
    await startMcpServer(config);
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exitCode = 1;
}

function printHelp() {
  console.log(`mindwallet — HTTP 402 payment wallet CLI

Usage:
  mindwallet wallet              Show wallet accounts from configured vault
  mindwallet fetch <url>         Fetch a URL with automatic payment handling
  mindwallet pay <url>           Pay and fetch a URL, showing payment details
  mindwallet mcp                 Start the MCP server over stdio

Options:
  --verbose, -v                  Show payment and response details
  --method <METHOD>              HTTP method for fetch command (default: GET)

Config: ${configPath()}
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
