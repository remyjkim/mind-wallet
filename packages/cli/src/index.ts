// ABOUTME: Public API surface for mindwallet CLI package
// ABOUTME: Re-exports router factory and configuration helpers

export { loadConfig, saveConfig, configPath } from './config.js';
export type { MindwalletConfig, PolicyRuleConfig } from './config.js';
export { routerFromConfig } from './router-from-config.js';
export { startMcpServer } from './mcp-server.js';
