export interface Tool {
    name: string;
    description: string;
    parameters: any;
    execute: (args: any) => Promise<string>;
}
export declare class ToolRegistry {
    private tools;
    register(tool: Tool): void;
    getTools(): Tool[];
    execute(name: string, args: any): Promise<string>;
    getOpenAITools(): {
        type: "function";
        function: {
            name: string;
            description: string;
            parameters: any;
        };
    }[];
}
import { OpenRouterClient } from './OpenRouterClient.js';
export declare const connectMcpTool: (toolRegistry: ToolRegistry) => Tool;
export declare const delegateTaskTool: (client: OpenRouterClient) => Tool;
export declare const activateSkillTool: (toolRegistry: ToolRegistry) => Tool;
export declare const listDirectoryTool: Tool;
export declare const grepSearchTool: Tool;
export declare const readManyFilesTool: Tool;
export declare const readFileTool: Tool;
export declare const askUserTool: Tool;
export declare const writeFileTool: Tool;
export declare const runShellTool: Tool;
export declare const replaceTool: Tool;
