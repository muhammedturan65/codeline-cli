import { AgentScheduler } from './AgentScheduler.js';
import { ToolRegistry, readFileTool, listDirectoryTool, grepSearchTool } from './tools.js';
export class SubAgent {
    scheduler;
    constructor(client, role, systemPrompt) {
        const subRegistry = new ToolRegistry();
        // Sub-agents usually only need read-only tools for safety
        subRegistry.register(readFileTool);
        subRegistry.register(listDirectoryTool);
        subRegistry.register(grepSearchTool);
        this.scheduler = new AgentScheduler(client, subRegistry);
        this.scheduler.setSystemPrompt(`ROLE: ${role}\n\n${systemPrompt}\n\nSen bir alt-agentsin. Görevin sadece sana verilen spesifik işi yapmaktır.`);
    }
    async execute(task) {
        let finalResponse = '';
        await this.scheduler.process(task, (update) => {
            if (update.type === 'response') {
                finalResponse = update.content;
            }
        });
        return finalResponse;
    }
}
