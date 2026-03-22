import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
export class McpManager {
    clients = new Map();
    async connectToServer(name, command, args, toolRegistry) {
        const transport = new StdioClientTransport({
            command,
            args,
        });
        const client = new Client({
            name: 'Codeline-Client',
            version: '1.0.0',
        }, {
            capabilities: {},
        });
        await client.connect(transport);
        this.clients.set(name, client);
        // Discover tools from the MCP server
        const { tools } = await client.listTools();
        tools.forEach((mcpTool) => {
            const tool = {
                name: `${name}_${mcpTool.name}`,
                description: mcpTool.description || '',
                parameters: mcpTool.inputSchema,
                execute: async (args) => {
                    const result = await client.callTool({
                        name: mcpTool.name,
                        arguments: args,
                    });
                    return JSON.stringify(result.content);
                },
            };
            toolRegistry.register(tool);
        });
        return `Connected to MCP server "${name}". Discovered ${tools.length} tools.`;
    }
    async disconnectAll() {
        for (const client of this.clients.values()) {
            await client.close();
        }
        this.clients.clear();
    }
}
export const mcpManager = new McpManager();
