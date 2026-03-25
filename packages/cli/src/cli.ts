#!/usr/bin/env node
// ABOUTME: CLI entry point for the mindwallet command
// ABOUTME: Parses subcommands and dispatches to wallet, fetch, pay, discover, search, key, or mcp

import { loadConfig, configPath } from './config.js';
import { walletCommand } from './commands/wallet.js';
import { fetchCommand } from './commands/fetch.js';
import { payCommand } from './commands/pay.js';
import { discoverCommand } from './commands/discover.js';
import { searchCommand } from './commands/search.js';
import { keyCreateCommand, keyRevokeCommand, keyListCommand } from './commands/key.js';
import { createSiwxMethod } from '@mindwallet/protocols';
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

  if (command === 'discover') {
    const origin = args[0];
    if (!origin) {
      console.error('Usage: mindwallet discover <origin>');
      process.exitCode = 1;
      return;
    }
    await discoverCommand(origin, { methods: [createSiwxMethod()] });
    return;
  }

  if (command === 'search') {
    const query = args[0];
    if (!query) {
      console.error('Usage: mindwallet search <query> [--protocol <proto>]');
      process.exitCode = 1;
      return;
    }
    const protoIdx = args.indexOf('--protocol');
    const protocol = protoIdx >= 0 ? args[protoIdx + 1] : undefined;
    await searchCommand(query, { protocol });
    return;
  }

  if (command === 'key') {
    const sub = args[0];
    const config = loadConfig();

    if (sub === 'create') {
      const name = args[1];
      if (!name) {
        console.error('Usage: mindwallet key create <name> [--expires <iso-date>]');
        process.exitCode = 1;
        return;
      }
      const expiresIdx = args.indexOf('--expires');
      const expiresAt = expiresIdx >= 0 ? args[expiresIdx + 1] : undefined;
      await keyCreateCommand(name, config, { expiresAt });
      return;
    }

    if (sub === 'revoke') {
      const id = args[1];
      if (!id) {
        console.error('Usage: mindwallet key revoke <key-id>');
        process.exitCode = 1;
        return;
      }
      await keyRevokeCommand(id, config);
      return;
    }

    if (!sub || sub === 'list') {
      await keyListCommand(config);
      return;
    }

    console.error(`Unknown key subcommand: ${sub}`);
    process.exitCode = 1;
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
  mindwallet wallet                Show wallet accounts from configured vault
  mindwallet fetch <url>           Fetch a URL with automatic payment handling
  mindwallet pay <url>             Pay and fetch a URL, showing payment details
  mindwallet discover <origin>     Probe an origin for payment requirements
  mindwallet search <query>        Search registry for payment-gated origins
  mindwallet key list              List API keys in the vault
  mindwallet key create <name>     Create a new API key (token shown once)
  mindwallet key revoke <id>       Revoke an API key by ID
  mindwallet mcp                   Start the MCP server over stdio

Options:
  --verbose, -v                    Show payment and response details (fetch/pay)
  --method <METHOD>                HTTP method for fetch command (default: GET)
  --protocol <proto>               Filter search by protocol (search command)
  --expires <iso-date>             Key expiry date (key create command)

Config: ${configPath()}
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
