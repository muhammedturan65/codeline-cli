export class ContextManager {
    maxCharacters;
    constructor(maxCharacters = 60000) {
        this.maxCharacters = maxCharacters;
    }
    calculateTotalLength(messages) {
        return messages.reduce((total, msg) => {
            if (typeof msg.content === 'string') {
                return total + msg.content.length;
            }
            return total + (msg.content ? JSON.stringify(msg.content).length : 0);
        }, 0);
    }
    compress(messages) {
        const sanitized = this.sanitize(messages);
        const totalLength = this.calculateTotalLength(sanitized);
        if (totalLength < this.maxCharacters) {
            return sanitized;
        }
        // Strategy 1: Truncate very long tool results
        let currentMessages = sanitized.map(msg => {
            if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 1000) {
                return {
                    ...msg,
                    content: msg.content.substring(0, 1000) + '\n... [TRUNCATED] ...'
                };
            }
            return msg;
        });
        let currentLength = this.calculateTotalLength(currentMessages);
        if (currentLength < this.maxCharacters)
            return currentMessages;
        // Strategy 2: Remove old messages but KEEP tool call chains intact
        const systemPrompt = currentMessages[0];
        let rest = currentMessages.slice(1);
        while (this.calculateTotalLength([systemPrompt, ...rest]) > this.maxCharacters && rest.length > 2) {
            const first = rest[0];
            if (first.role === 'user') {
                rest.shift();
                // If a user message is followed by assistant tool calls, they might become dangling
                // But sanitize will handle it. To be safer, we could remove the whole turn.
            }
            else if (first.role === 'assistant' && first.tool_calls) {
                rest.shift(); // Remove assistant
                while (rest.length > 0 && rest[0].role === 'tool') {
                    rest.shift(); // Remove all following tool results
                }
            }
            else {
                rest.shift();
            }
        }
        // Final check: if the first message after system is a tool, remove it
        return this.sanitize([systemPrompt, ...rest]);
    }
    sanitize(messages) {
        if (messages.length === 0)
            return [];
        const result = [];
        const systemPrompt = messages.find(m => m.role === 'system');
        if (systemPrompt)
            result.push(systemPrompt);
        let rest = messages.filter(m => m.role !== 'system');
        // Ensure the first message after system is always 'user'
        while (rest.length > 0 && rest[0].role !== 'user') {
            rest.shift();
        }
        for (let i = 0; i < rest.length; i++) {
            const msg = { ...rest[i] };
            // Validate sequence: a tool message MUST follow an assistant message with tool_calls OR another tool message
            if (msg.role === 'tool') {
                const prev = result[result.length - 1];
                if (!prev)
                    continue;
                const isFollowingAssistantWithTools = prev.role === 'assistant' && prev.tool_calls;
                const isFollowingAnotherTool = prev.role === 'tool';
                if (!isFollowingAssistantWithTools && !isFollowingAnotherTool) {
                    continue; // Skip dangling tool message
                }
            }
            result.push(msg);
        }
        return result;
    }
}
export const contextManager = new ContextManager();
