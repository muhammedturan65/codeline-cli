import fs from 'fs/promises';
import path from 'path';

export class Logger {
  private logPath: string;

  constructor() {
    this.logPath = path.resolve(process.cwd(), 'codeline.log');
  }

  async log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    
    try {
      await fs.appendFile(this.logPath, entry, 'utf8');
    } catch {
      // Ignore log errors
    }
  }

  async info(message: string, data?: any) {
    await this.log('INFO', message, data);
  }

  async warn(message: string, data?: any) {
    await this.log('WARN', message, data);
  }

  async error(message: string, data?: any) {
    await this.log('ERROR', message, data);
  }
}

export const logger = new Logger();
