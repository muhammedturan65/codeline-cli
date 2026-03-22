export type ConfirmationResult = 'allow' | 'deny' | 'allowAll';
export interface ConfirmationRequest {
    id: string;
    toolName: string;
    args: any;
    resolve: (result: ConfirmationResult) => void;
}
export declare class ConfirmationBus {
    private listeners;
    subscribe(listener: (request: ConfirmationRequest) => void): () => void;
    requestConfirmation(toolName: string, args: any): Promise<ConfirmationResult>;
}
export declare const confirmationBus: ConfirmationBus;
