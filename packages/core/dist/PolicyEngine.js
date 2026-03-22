import fs from 'fs/promises';
import path from 'path';
export class PolicyEngine {
    rules = [];
    configPath;
    temporaryAllowAll = false;
    constructor() {
        this.configPath = path.resolve(process.cwd(), '.codeline-policy.json');
    }
    setTemporaryAllowAll(value) {
        this.temporaryAllowAll = value;
    }
    isTemporaryAllowAll() {
        return this.temporaryAllowAll;
    }
    async load() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            const config = JSON.parse(data);
            this.rules = (config.rules || []).sort((a, b) => b.priority - a.priority);
        }
        catch {
            // Default policy if no file exists
            this.rules = [
                { toolName: 'runShell', argsPattern: 'rm -rf', decision: 'DENY', priority: 1000 },
                { toolName: '*', decision: 'ASK_USER', priority: 0 }
            ];
        }
    }
    check(toolName, args) {
        if (this.temporaryAllowAll)
            return 'ALLOW';
        const stringifiedArgs = JSON.stringify(args);
        for (const rule of this.rules) {
            const isToolMatch = rule.toolName === '*' || rule.toolName === toolName;
            let isArgsMatch = true;
            if (rule.argsPattern) {
                const regex = new RegExp(rule.argsPattern, 'i');
                isArgsMatch = regex.test(stringifiedArgs);
            }
            if (isToolMatch && isArgsMatch) {
                return rule.decision;
            }
        }
        return 'ASK_USER'; // Default fallback
    }
}
export const policyEngine = new PolicyEngine();
