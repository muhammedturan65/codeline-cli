import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export interface Tool {
  name: string;
  description: string;
  parameters: any; // Zod schema or JSON Schema
  execute: (args: any) => Promise<string>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  async execute(name: string, args: any): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    try {
      return await tool.execute(args);
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }

  getOpenAITools() {
    return this.getTools().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}

import { skillRegistry } from './Skill.js';

import { SubAgent } from './SubAgent.js';
import { OpenRouterClient } from './OpenRouterClient.js';

import { mcpManager } from './McpManager.js';

export const connectMcpTool = (toolRegistry: ToolRegistry): Tool => ({
  name: 'connectMcp',
  description: 'Connects to a new MCP (Model Context Protocol) server via stdio. Use this to expand your tools with external services like SQLite or GitHub.',
  parameters: {
    type: 'object',
    properties: {
      serverName: { type: 'string', description: 'A unique name for the server.' },
      command: { type: 'string', description: 'The command to run the server (e.g., "npx").' },
      args: { type: 'array', items: { type: 'string' }, description: 'Arguments for the command.' },
    },
    required: ['serverName', 'command', 'args'],
  },
  execute: async ({ serverName, command, args }) => {
    return await mcpManager.connectToServer(serverName, command, args, toolRegistry);
  },
});

export const delegateTaskTool = (client: OpenRouterClient): Tool => ({
  name: 'delegateTask',
  description: 'Delegates a complex task to a specialized sub-agent. Useful for research or deep analysis without cluttering the main history.',
  parameters: {
    type: 'object',
    properties: {
      role: { type: 'string', description: 'The role of the sub-agent (e.g., "Researcher", "CodeReviewer").' },
      task: { type: 'string', description: 'The specific task for the sub-agent.' },
    },
    required: ['role', 'task'],
  },
  execute: async ({ role, task }) => {
    const subAgent = new SubAgent(client, role, `Sen bir ${role} uzmanısın.`);
    return await subAgent.execute(task);
  },
});

export const activateSkillTool = (toolRegistry: ToolRegistry): Tool => ({
  name: 'activateSkill',
  description: 'Activates a new set of tools (a skill) for the agent. Use this when you need specialized capabilities.',
  parameters: {
    type: 'object',
    properties: {
      skillName: { type: 'string', description: 'The name of the skill to activate.' },
    },
    required: ['skillName'],
  },
  execute: async ({ skillName }) => {
    const skill = skillRegistry.getSkill(skillName);
    if (!skill) {
      const available = skillRegistry.getAllSkills().map(s => s.name).join(', ');
      return `Skill "${skillName}" not found. Available skills: ${available}`;
    }
    
    skill.tools.forEach(tool => toolRegistry.register(tool));
    return `Skill "${skillName}" activated. New tools available: ${skill.tools.map(t => t.name).join(', ')}`;
  },
});

export const listDirectoryTool: Tool = {
  name: 'listDirectory',
  description: 'Lists files and directories in a given path.',
  parameters: {
    type: 'object',
    properties: {
      dirPath: { type: 'string', description: 'The directory path to list.' },
    },
    required: ['dirPath'],
  },
  execute: async ({ dirPath }) => {
    const absolutePath = path.resolve(process.cwd(), dirPath);
    if (!absolutePath.startsWith(process.cwd())) {
      throw new Error('Access denied: Outside of project directory.');
    }
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    return entries.map(e => `${e.isDirectory() ? '[DIR] ' : ''}${e.name}`).join('\n');
  },
};

export const grepSearchTool: Tool = {
  name: 'grepSearch',
  description: 'Searches for a pattern in files recursively.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'The regex pattern to search for.' },
      dirPath: { type: 'string', description: 'The directory to search in (default: project root).' },
    },
    required: ['pattern'],
  },
  execute: async ({ pattern, dirPath = '.' }) => {
    const absolutePath = path.resolve(process.cwd(), dirPath);
    if (!absolutePath.startsWith(process.cwd())) {
      throw new Error('Access denied: Outside of project directory.');
    }

    const results: string[] = [];
    const regex = new RegExp(pattern, 'i');

    async function walk(currentDir: string) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
            await walk(fullPath);
          }
        } else {
          const content = await fs.readFile(fullPath, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line, i) => {
            if (regex.test(line)) {
              results.push(`${path.relative(process.cwd(), fullPath)}:${i + 1}: ${line.trim()}`);
            }
          });
        }
      }
    }

    await walk(absolutePath);
    return results.length > 0 ? results.join('\n') : 'No matches found.';
  },
};

export const readManyFilesTool: Tool = {
  name: 'readManyFiles',
  description: 'Reads multiple files at once and returns their contents. Efficient for analyzing multiple related files.',
  parameters: {
    type: 'object',
    properties: {
      filePaths: { type: 'array', items: { type: 'string' }, description: 'The paths to the files to read.' },
    },
    required: ['filePaths'],
  },
  execute: async ({ filePaths }) => {
    const results: string[] = [];
    for (const filePath of filePaths) {
      const absolutePath = path.resolve(process.cwd(), filePath);
      if (!absolutePath.startsWith(process.cwd())) {
        results.push(`--- FILE: ${filePath} ---\nAccess denied: Outside of project directory.\n`);
        continue;
      }
      try {
        const content = await fs.readFile(absolutePath, 'utf8');
        results.push(`--- FILE: ${filePath} ---\n${content}\n`);
      } catch (error: any) {
        results.push(`--- FILE: ${filePath} ---\nError reading file: ${error.message}\n`);
      }
    }
    return results.join('\n');
  },
};

export const readFileTool: Tool = {
  name: 'readFile',
  description: 'Reads the content of a file. You can optionally specify a line range.',
  parameters: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'The path to the file to read.' },
      startLine: { type: 'number', description: 'Optional: The 1-based line number to start reading from.' },
      endLine: { type: 'number', description: 'Optional: The 1-based line number to end reading at.' },
    },
    required: ['filePath'],
  },
  execute: async ({ filePath, startLine, endLine }) => {
    const absolutePath = path.resolve(process.cwd(), filePath);
    if (!absolutePath.startsWith(process.cwd())) {
        throw new Error('Access denied: File outside of project directory.');
    }
    
    let content = await fs.readFile(absolutePath, 'utf8');
    
    if (startLine || endLine) {
        const lines = content.split('\n');
        const start = startLine ? Math.max(0, startLine - 1) : 0;
        const end = endLine ? Math.min(lines.length, endLine) : lines.length;
        content = lines.slice(start, end).join('\n');
    }
    
    return content;
  },
};

import { debugServer } from './DebugServer.js';
import { askUserBus } from './AskUserBus.js';

export const askUserTool: Tool = {
  name: 'askUser',
  description: 'Asks the user a question and waits for a response. Use this when you need more information or confirmation that is not covered by other tools.',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The question to ask the user.' },
      type: { type: 'string', enum: ['text', 'choice'], description: 'The type of response expected (text or a choice from a list).' },
      options: { type: 'array', items: { type: 'string' }, description: 'Optional: A list of options for the user to choose from if type is "choice".' },
    },
    required: ['question'],
  },
  execute: async ({ question, type = 'text', options }) => {
    return await askUserBus.ask(question, type as any, options);
  },
};

export const writeFileTool: Tool = {
  name: 'writeFile',
  description: 'Writes or updates a file on the disk.',
  parameters: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'The path to the file to write.' },
      content: { type: 'string', description: 'The content to write.' },
    },
    required: ['filePath', 'content'],
  },
  execute: async ({ filePath, content }) => {
    const absolutePath = path.resolve(process.cwd(), filePath);
    if (!absolutePath.startsWith(process.cwd())) {
        throw new Error('Access denied: Cannot write outside of project directory.');
    }
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    
    let finalContent = content;
    if (filePath.endsWith('.html')) {
      const injection = debugServer.getInjectionScript();
      if (content.includes('</body>')) {
        finalContent = content.replace('</body>', `${injection}</body>`);
      } else {
        finalContent = content + injection;
      }
    }

    await fs.writeFile(absolutePath, finalContent, 'utf8');
    return `File ${filePath} written successfully.`;
  },
};

export const runShellTool: Tool = {
  name: 'runShell',
  description: 'Executes a command in the terminal.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The command to execute.' },
    },
    required: ['command'],
  },
  execute: async ({ command }) => {
    // Security check: blacklist dangerous commands or provide a restricted environment
    const blacklisted = ['rm -rf', 'format', 'mkfs'];
    if (blacklisted.some(b => command.includes(b))) {
      throw new Error('Dangerous command detected and blocked.');
    }
    const { stdout, stderr } = await execAsync(command);
    return stdout || stderr || 'Command executed with no output.';
  },
};

export const replaceTool: Tool = {
  name: 'replace',
  description: 'Replaces a specific string in a file with a new string. This is safer and faster than rewriting the whole file.',
  parameters: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'The path to the file to modify.' },
      oldString: { type: 'string', description: 'The EXACT literal text to replace. Must be unique in the file or provided with enough context.' },
      newString: { type: 'string', description: 'The new text to replace oldString with.' },
    },
    required: ['filePath', 'oldString', 'newString'],
  },
  execute: async ({ filePath, oldString, newString }) => {
    const absolutePath = path.resolve(process.cwd(), filePath);
    if (!absolutePath.startsWith(process.cwd())) {
        throw new Error('Access denied: Cannot modify files outside of project directory.');
    }

    const content = await fs.readFile(absolutePath, 'utf8');
    const occurrences = content.split(oldString).length - 1;

    if (occurrences === 0) {
      throw new Error(`Could not find the exact text in ${filePath}. Please ensure you provided the EXACT text including whitespace and indentation.`);
    }

    if (occurrences > 1) {
      throw new Error(`Found ${occurrences} occurrences of the text in ${filePath}. Please provide more context (more lines before or after) to make it unique.`);
    }

    const newContent = content.replace(oldString, newString);
    await fs.writeFile(absolutePath, newContent, 'utf8');
    return `Successfully replaced text in ${filePath}.`;
  },
};
