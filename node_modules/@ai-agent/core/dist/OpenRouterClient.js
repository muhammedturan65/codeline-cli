import OpenAI from 'openai';
export class OpenRouterClient {
    openai;
    model;
    constructor(options) {
        if (!options.apiKey) {
            throw new Error('OPENROUTER_API_KEY is missing. Please check your .env file.');
        }
        this.model = options.model || 'stepfun/step-3.5-flash:free';
        this.openai = new OpenAI({
            apiKey: options.apiKey,
            baseURL: options.baseUrl || 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': options.referer || 'https://github.com/google/gemini-cli-clone',
                'X-Title': options.title || 'Advanced AI Agent CLI',
            },
        });
    }
    getModel() {
        return this.model;
    }
    setModel(model) {
        this.model = model;
    }
    async chat(messages, tools) {
        const response = await this.openai.chat.completions.create({
            model: this.model,
            messages,
            tools,
            tool_choice: tools ? 'auto' : undefined,
        });
        return response.choices[0].message;
    }
    async streamChat(messages, tools) {
        try {
            const stream = await this.openai.chat.completions.create({
                model: this.model,
                messages,
                tools,
                tool_choice: tools ? 'auto' : undefined,
                stream: true,
            });
            return stream;
        }
        catch (error) {
            if (error instanceof OpenAI.APIError) {
                console.error('OpenRouter API Error:', {
                    status: error.status,
                    message: error.message,
                    code: error.code,
                    type: error.type,
                    info: error
                });
            }
            else {
                console.error('Unexpected Chat Error:', error);
            }
            throw error;
        }
    }
    async *generateStream(messages, tools) {
        const stream = await this.streamChat(messages, tools);
        for await (const chunk of stream) {
            yield chunk;
        }
    }
}
