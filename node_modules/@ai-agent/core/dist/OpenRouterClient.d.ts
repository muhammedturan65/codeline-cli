import OpenAI from 'openai';
import { Stream } from 'openai/streaming';
export interface OpenRouterClientOptions {
    apiKey: string;
    baseUrl?: string;
    referer?: string;
    title?: string;
    model?: string;
}
export declare class OpenRouterClient {
    private openai;
    private model;
    constructor(options: OpenRouterClientOptions);
    getModel(): string;
    setModel(model: string): void;
    chat(messages: OpenAI.Chat.ChatCompletionMessageParam[], tools?: OpenAI.Chat.ChatCompletionTool[]): Promise<OpenAI.Chat.Completions.ChatCompletionMessage>;
    streamChat(messages: OpenAI.Chat.ChatCompletionMessageParam[], tools?: OpenAI.Chat.ChatCompletionTool[]): Promise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk> & {
        _request_id?: string | null;
    }>;
    generateStream(messages: OpenAI.Chat.ChatCompletionMessageParam[], tools?: OpenAI.Chat.ChatCompletionTool[]): AsyncGenerator<OpenAI.Chat.Completions.ChatCompletionChunk, void, unknown>;
}
