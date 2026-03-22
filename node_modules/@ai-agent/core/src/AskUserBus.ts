export interface AskUserRequest {
  id: string;
  question: string;
  type: 'text' | 'choice';
  options?: string[];
  resolve: (value: string) => void;
}

class AskUserBus {
  private listeners: ((req: AskUserRequest) => void)[] = [];

  subscribe(listener: (req: AskUserRequest) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  ask(question: string, type: 'text' | 'choice' = 'text', options?: string[]): Promise<string> {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).substring(7);
      const request: AskUserRequest = {
        id,
        question,
        type,
        options,
        resolve: (value) => {
          resolve(value);
        }
      };
      this.listeners.forEach(l => l(request));
    });
  }
}

export const askUserBus = new AskUserBus();
