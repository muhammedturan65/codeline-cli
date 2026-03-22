export interface AskUserRequest {
    id: string;
    question: string;
    type: 'text' | 'choice';
    options?: string[];
    resolve: (value: string) => void;
}
declare class AskUserBus {
    private listeners;
    subscribe(listener: (req: AskUserRequest) => void): () => void;
    ask(question: string, type?: 'text' | 'choice', options?: string[]): Promise<string>;
}
export declare const askUserBus: AskUserBus;
export {};
