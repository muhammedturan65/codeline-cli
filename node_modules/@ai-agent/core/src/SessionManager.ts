import fs from 'fs/promises';
import path from 'path';

export class SessionManager {
  private historyPath: string;

  constructor() {
    this.historyPath = path.resolve(process.cwd(), 'chat_history.json');
  }

  async save(messages: any[]) {
    await fs.writeFile(this.historyPath, JSON.stringify(messages, null, 2), 'utf8');
  }

  async load(): Promise<any[]> {
    try {
      const data = await fs.readFile(this.historyPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async clear() {
    try {
      await fs.unlink(this.historyPath);
    } catch {}
  }
}

export const sessionManager = new SessionManager();
