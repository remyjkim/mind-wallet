// ABOUTME: CLI command that searches the Bazaar registry for payment-gated origins
// ABOUTME: Outputs matching origins with their supported protocols

import { searchRegistry } from '@mindpass/discovery';

export interface SearchCommandOptions {
  protocol?: string;
  limit?: number;
  registryUrl?: string;
  fetch?: typeof globalThis.fetch;
  output?: (line: string) => void;
  json?: boolean;
}

/**
 * Searches the registry for origins matching `query` and prints the results.
 */
export async function searchCommand(
  query: string,
  options: SearchCommandOptions = {},
): Promise<void> {
  const out = options.output ?? console.log;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  const records = await searchRegistry(
    {
      query,
      protocol: options.protocol,
      limit: options.limit,
      registryUrl: options.registryUrl,
    },
    fetchImpl,
  );

  if (options.json) {
    out(JSON.stringify(records, null, 2));
    return;
  }

  if (records.length === 0) {
    out('No results found.');
    return;
  }

  for (const record of records) {
    const protocols = record.protocols.join(', ');
    const desc = record.description ? `  — ${record.description}` : '';
    out(`${record.origin}  [${protocols}]${desc}`);
  }
}
