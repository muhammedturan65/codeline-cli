import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { OpenRouterClient } from './OpenRouterClient.js';
import { ToolRegistry } from './tools.js';
import { confirmationBus } from './ConfirmationBus.js';
import { sessionManager } from './SessionManager.js';
import { contextManager } from './ContextManager.js';
import { policyEngine } from './PolicyEngine.js';
import { logger } from './Logger.js';

export class AgentScheduler {
  private client: OpenRouterClient;
  private toolRegistry: ToolRegistry;
  private messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  private systemPrompt: string = '';

  constructor(client: OpenRouterClient, toolRegistry: ToolRegistry) {
    this.client = client;
    this.toolRegistry = toolRegistry;
  }

  async loadHistory() {
    await logger.info('Loading history and policies...');
    await policyEngine.load(); // Load security policies
    const history = await sessionManager.load();
    if (history.length > 0) {
      this.messages = history;
    }

    // Dynamic Context (JIT): Scan project info
    try {
      let currentDir = process.cwd();
      let packageJsonPath = path.resolve(currentDir, 'package.json');
      
      // Search upwards for package.json (max 5 levels)
      for (let i = 0; i < 5; i++) {
        if (fs.existsSync(packageJsonPath)) break;
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) break; // Root reached
        currentDir = parentDir;
        packageJsonPath = path.resolve(currentDir, 'package.json');
      }

      const packageData = await fs.promises.readFile(packageJsonPath, 'utf8');
      const files = await fs.promises.readdir(currentDir);
      
      const projectContext = `\n\nCURRENT PROJECT CONTEXT:\n` +
        `- Files in root: ${files.join(', ')}\n` +
        `- Package Info: ${packageData.substring(0, 1000)}\n`;
      
      this.setSystemPrompt(this.systemPrompt + projectContext);
      await logger.info('Project context loaded and injected into system prompt.', { path: packageJsonPath });
    } catch {
      await logger.warn('Could not load project context (package.json might be missing).');
    }
  }

  setSystemPrompt(prompt: string) {
    this.systemPrompt = prompt;
    if (this.messages.length === 0 || this.messages[0].role !== 'system') {
      this.messages.unshift({ role: 'system', content: prompt });
    } else {
      this.messages[0].content = prompt;
    }
  }

  async process(userInput: string, onUpdate: (update: any) => void) {
    const sanitizedInput = userInput.replace(/\r/g, '').trim();
    await logger.info('Processing user input', { userInput: sanitizedInput });
    this.messages.push({ role: 'user', content: sanitizedInput });

    let running = true;
    while (running) {
      // Manage context length before sending to model
      this.messages = contextManager.compress(this.messages);

      const tools = this.toolRegistry.getOpenAITools();
      
      await logger.info('Sending request to model', { 
        model: this.client.getModel(),
        messagesCount: this.messages.length,
        lastRole: this.messages[this.messages.length - 1].role
      });

      // We use streaming for the main response
      let stream: any;
      let retryCount = 0;
      const maxRetries = 1;

      while (retryCount <= maxRetries) {
        try {
          stream = await this.client.streamChat(this.messages, tools);
          break; // Success
        } catch (error: any) {
          if (error.message.includes('400') && retryCount < maxRetries) {
            await logger.warn('400 error detected, retrying with simplified history...', { retryCount });
          // Strategy: Remove middle messages, keeping system and last few messages
          if (this.messages.length > 2) {
            const system = this.messages[0];
            const count = Math.max(1, Math.floor(this.messages.length / 2));
            const lastFew = this.messages.slice(-count);
            this.messages = [system, ...lastFew];
            retryCount++;
            continue;
          }
          }
          await logger.error('Stream chat request failed', { error: error.message, stack: error.stack });
          throw error;
        }
      }

      if (!stream) {
        throw new Error('Modelden yanıt alınamadı (stream oluşturulamadı).');
      }
      
      let fullContent = '';
      let toolCalls: any[] = [];
      let currentRole: string = 'assistant';

      for await (const chunk of stream) {
        const delta = chunk.choices[0].delta;
        
        if (delta.content) {
          fullContent += delta.content;
          onUpdate({ type: 'content_chunk', content: delta.content, fullContent });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCalls[tc.index]) {
              toolCalls[tc.index] = { 
                id: tc.id, 
                type: 'function', 
                function: { name: '', arguments: '' } 
              };
            }
            if (tc.id) toolCalls[tc.index].id = tc.id;
            if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
          }
        }
      }

      // Add the full response to history
      const assistantMessage: any = { 
        role: 'assistant',
        content: fullContent || null,
      };
      
      if (toolCalls.length > 0) {
        // Filter out any potentially incomplete tool calls and ensure correct structure
        assistantMessage.tool_calls = toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments
          }
        }));
      }
      
      this.messages.push(assistantMessage);

      if (toolCalls.length > 0) {
        onUpdate({ type: 'thinking', content: 'Araclar calistiriliyor...' });
        for (const toolCall of toolCalls) {
          const name = toolCall.function.name;
          let args: any;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            args = {}; // Fallback for malformed args
          }
          
          // Security: Policy Check
          const decision = policyEngine.check(name, args);
          
          if (decision === 'DENY') {
            const errorMsg = `Guvenlik Politikasi: "${name}" aracı engellendi.`;
            onUpdate({ type: 'tool_result', name, result: `HATA: ${errorMsg}` });
            this.messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Policy violation: ${errorMsg}`,
            } as OpenAI.Chat.ChatCompletionToolMessageParam);
            continue;
          }

          if (decision === 'ASK_USER') {
            onUpdate({ type: 'confirmation_needed', name, args });
            const result = await confirmationBus.requestConfirmation(name, args);
            if (result === 'deny') {
              onUpdate({ type: 'tool_result', name, result: 'Kullanici tarafindan iptal edildi.' });
              this.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: 'User denied tool execution.',
              } as OpenAI.Chat.ChatCompletionToolMessageParam);
              continue;
            }
            if (result === 'allowAll') {
              policyEngine.setTemporaryAllowAll(true);
            }
          }

          onUpdate({ type: 'tool_call', name, args });
          
          let result: string;
          try {
            result = await this.toolRegistry.execute(name, args);
          } catch (error: any) {
            result = `Hata "${name}": ${error.message}.`;
            onUpdate({ type: 'tool_result', name, result: `HATA: ${error.message}` });
          }

          onUpdate({ type: 'tool_result', name, result });

          this.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
          } as OpenAI.Chat.ChatCompletionToolMessageParam);
        }
      } else {
        onUpdate({ type: 'response', content: fullContent });
        running = false;
      }
    }
    // Save history after each turn
    await sessionManager.save(this.messages);
  }

  getMessages() {
    return this.messages;
  }
}
