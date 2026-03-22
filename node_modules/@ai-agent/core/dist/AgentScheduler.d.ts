import OpenAI from 'openai';
import { OpenRouterClient } from './OpenRouterClient.js';
import { ToolRegistry } from './tools.js';
export declare class AgentScheduler {
    private client;
    private toolRegistry;
    private messages;
    private systemPrompt;
    constructor(client: OpenRouterClient, toolRegistry: ToolRegistry);
    loadHistory(): Promise<void>;
    setSystemPrompt(prompt: string): void;
    process(userInput: string, onUpdate: (update: any) => void): Promise<void>;
    getMessages(): OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}
