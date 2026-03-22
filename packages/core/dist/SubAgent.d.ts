import { OpenRouterClient } from './OpenRouterClient.js';
export declare class SubAgent {
    private scheduler;
    constructor(client: OpenRouterClient, role: string, systemPrompt: string);
    execute(task: string): Promise<string>;
}
