export declare class DebugServer {
    private app;
    private server;
    private io;
    private port;
    constructor();
    start(): void;
    getInjectionScript(): string;
}
export declare const debugServer: DebugServer;
