export type PolicyDecision = 'ALLOW' | 'DENY' | 'ASK_USER';
export interface PolicyRule {
    toolName: string;
    argsPattern?: string;
    decision: PolicyDecision;
    priority: number;
}
export declare class PolicyEngine {
    private rules;
    private configPath;
    private temporaryAllowAll;
    constructor();
    setTemporaryAllowAll(value: boolean): void;
    isTemporaryAllowAll(): boolean;
    load(): Promise<void>;
    check(toolName: string, args: any): PolicyDecision;
}
export declare const policyEngine: PolicyEngine;
