export class ConfirmationBus {
    listeners = [];
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    async requestConfirmation(toolName, args) {
        const id = Math.random().toString(36).substring(7);
        return new Promise((resolve) => {
            const request = {
                id,
                toolName,
                args,
                resolve,
            };
            if (this.listeners.length === 0) {
                // No UI listener, default to deny for safety
                console.warn(`No confirmation listener for tool: ${toolName}. Denying by default.`);
                resolve('deny');
                return;
            }
            this.listeners.forEach(listener => listener(request));
        });
    }
}
export const confirmationBus = new ConfirmationBus();
