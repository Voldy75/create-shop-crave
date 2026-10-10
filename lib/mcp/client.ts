import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { serversFor, type McpServer } from "@/lib/mcp/registry";

/**
 * Provider-agnostic MCP client factory.
 *
 * Replaces the Swiggy-specific connectSwiggy/connectAll in lib/swiggy-mcp.ts,
 * which hardcoded a three-entry SERVICE_URLS map. Endpoints now come from
 * mcp_provider_servers.
 *
 * Transport: Streamable HTTP with a bearer token on each call.
 */

/** A live client plus the registry row it was opened from. */
export interface OpenServer {
  providerId: string;
  serviceKey: string;
  /** Namespace prefix for tool names: "<provider>_<service>" */
  namespace: string;
  server: McpServer;
  client: Client;
}

export async function connectServer(server: McpServer, accessToken: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(server.url), {
    requestInit: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
  const client = new Client({ name: "crave-and-create", version: "0.1.0" }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

/**
 * Open every enabled endpoint for one provider. Individual failures are logged
 * and skipped rather than aborting the batch — one dead endpoint should not
 * take down the others.
 */
export async function connectProvider(
  providerId: string,
  accessToken: string
): Promise<OpenServer[]> {
  const servers = await serversFor(providerId);
  const out: OpenServer[] = [];

  await Promise.all(
    servers.map(async (server) => {
      try {
        const client = await connectServer(server, accessToken);
        out.push({
          providerId,
          serviceKey: server.serviceKey,
          namespace: `${providerId}_${server.serviceKey}`,
          server,
          client,
        });
      } catch (err) {
        console.error(
          `connectServer(${providerId}/${server.serviceKey}) failed:`,
          err instanceof Error ? err.message.slice(0, 200) : err
        );
      }
    })
  );

  return out;
}

/** Best-effort close. Never throws. */
export async function closeAll(open: OpenServer[]): Promise<void> {
  await Promise.all(
    open.map(async (o) => {
      try {
        await o.client.close();
      } catch {
        // ignore close errors
      }
    })
  );
}

/** Is this tool exposed by the server's allowlist? NULL allowlist = allow all. */
export function toolAllowed(server: McpServer, toolName: string): boolean {
  if (!server.toolAllowlist || server.toolAllowlist.length === 0) return true;
  return server.toolAllowlist.includes(toolName);
}
