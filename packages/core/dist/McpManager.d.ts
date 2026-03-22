import { ToolRegistry } from './tools.js';
export declare class McpManager {
    private clients;
    connectToServer(name: string, command: string, args: string[], toolRegistry: ToolRegistry): Promise<string>;
    disconnectAll(): Promise<void>;
}
export declare const mcpManager: McpManager;
