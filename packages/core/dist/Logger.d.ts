export declare class Logger {
    private logPath;
    constructor();
    log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any): Promise<void>;
    info(message: string, data?: any): Promise<void>;
    warn(message: string, data?: any): Promise<void>;
    error(message: string, data?: any): Promise<void>;
}
export declare const logger: Logger;
