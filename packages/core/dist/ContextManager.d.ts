import OpenAI from 'openai';
export declare class ContextManager {
    private maxCharacters;
    constructor(maxCharacters?: number);
    calculateTotalLength(messages: OpenAI.Chat.ChatCompletionMessageParam[]): number;
    compress(messages: OpenAI.Chat.ChatCompletionMessageParam[]): OpenAI.Chat.ChatCompletionMessageParam[];
    private sanitize;
}
export declare const contextManager: ContextManager;
