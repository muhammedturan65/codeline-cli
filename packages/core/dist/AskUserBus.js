class AskUserBus {
    listeners = [];
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    ask(question, type = 'text', options) {
        return new Promise((resolve) => {
            const id = Math.random().toString(36).substring(7);
            const request = {
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
