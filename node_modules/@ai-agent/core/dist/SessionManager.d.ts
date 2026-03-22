export declare class SessionManager {
    private historyPath;
    constructor();
    save(messages: any[]): Promise<void>;
    load(): Promise<any[]>;
    clear(): Promise<void>;
}
export declare const sessionManager: SessionManager;
