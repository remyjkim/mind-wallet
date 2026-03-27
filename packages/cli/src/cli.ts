#!/usr/bin/env node
// ABOUTME: CLI entry point for the mindpass command
// ABOUTME: Parses subcommands and dispatches to wallet, fetch, pay, discover, search, key, or mcp

import { resolveConfig, configPath } from './config.js';
import { walletCommand } from './commands/wallet.js';
import { fetchCommand } from './commands/fetch.js';
import { payCommand } from './commands/pay.js';
import { discoverCommand } from './commands/discover.js';
import { searchCommand } from './commands/search.js';
import { keyCreateCommand, keyRevokeCommand, keyListCommand } from './commands/key.js';
import { startMcpServer } from './mcp-server.js';
import { routerFromConfig } from './router-from-config.js';
import { CLI_VERSION } from './version.js';

const [, , command, ...args] = process.argv;

async function main() {
  if (command === '--version' || command === '-V') {
    console.log(CLI_VERSION);
    return;
  }

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'wallet') {
    const config = resolveConfig();
    await walletCommand(config);
    return;
  }

  if (command === 'fetch') {
    const url = args[0];
    if (!url) {
      console.error('Usage: mindpass fetch <url> [--verbose] [--method GET]');
      process.exitCode = 1;
      return;
    }
    const config = resolveConfig();
    const verbose = args.includes('--verbose') || args.includes('-v');
    const methodIdx = args.indexOf('--method');
    const method = methodIdx >= 0 ? args[methodIdx + 1] : undefined;
    await fetchCommand(url, config, { verbose, method });
    return;
  }

  if (command === 'pay') {
    const url = args[0];
    if (!url) {
      console.error('Usage: mindpass pay <url> [--verbose]');
      process.exitCode = 1;
      return;
    }
    const config = resolveConfig();
    const verbose = args.includes('--verbose') || args.includes('-v');
    await payCommand(url, config, { verbose });
    return;
  }

  if (command === 'discover') {
    const origin = args[0];
    if (!origin) {
      console.error('Usage: mindpass discover <origin>');
      process.exitCode = 1;
      return;
    }
    const config = resolveConfig();
    const json = args.includes('--json');
    await discoverCommand(origin, { methods: routerFromConfig(config).methods, json });
    return;
  }

  if (command === 'search') {
    const query = args[0];
    if (!query) {
      console.error('Usage: mindpass search <query> [--protocol <proto>]');
      process.exitCode = 1;
      return;
    }
    const protoIdx = args.indexOf('--protocol');
    const protocol = protoIdx >= 0 ? args[protoIdx + 1] : undefined;
    const json = args.includes('--json');
    await searchCommand(query, { protocol, json });
    return;
  }

  if (command === 'key') {
    const sub = args[0];
    const config = resolveConfig();

    if (sub === 'create') {
      const name = args[1];
      if (!name) {
        console.error('Usage: mindpass key create <name> [--expires <iso-date>]');
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
        console.error('Usage: mindpass key revoke <key-id>');
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
    const config = resolveConfig();
    await startMcpServer(config);
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exitCode = 1;
}

function printHelp() {
  console.log(`mindpass — HTTP 402 payment wallet CLI

Usage:
  mindpass wallet                Show wallet accounts from configured vault
  mindpass fetch <url>           Fetch a URL with automatic payment handling
  mindpass pay <url>             Pay and fetch a URL, showing payment details
  mindpass discover <origin>     Probe an origin for payment requirements
  mindpass search <query>        Search registry for payment-gated origins
  mindpass key list              List API keys in the vault
  mindpass key create <name>     Create a new API key (token shown once)
  mindpass key revoke <id>       Revoke an API key by ID
  mindpass mcp                   Start the MCP server over stdio

Options:
  --verbose, -v                    Show payment and response details (fetch/pay)
  --method <METHOD>                HTTP method for fetch command (default: GET)
  --protocol <proto>               Filter search by protocol (search command)
  --json                           Print structured JSON for discover/search
  --expires <iso-date>             Key expiry date (key create command)
  --version, -V                    Print the installed CLI version

Config: ${configPath()}
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
