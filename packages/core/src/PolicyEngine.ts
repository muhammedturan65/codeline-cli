import fs from 'fs/promises';
import path from 'path';

export type PolicyDecision = 'ALLOW' | 'DENY' | 'ASK_USER';

export interface PolicyRule {
  toolName: string;
  argsPattern?: string; // Regex string
  decision: PolicyDecision;
  priority: number;
}

export class PolicyEngine {
  private rules: PolicyRule[] = [];
  private configPath: string;
  private temporaryAllowAll: boolean = false;

  constructor() {
    this.configPath = path.resolve(process.cwd(), '.codeline-policy.json');
  }

  setTemporaryAllowAll(value: boolean) {
    this.temporaryAllowAll = value;
  }

  isTemporaryAllowAll(): boolean {
    return this.temporaryAllowAll;
  }

  async load() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(data);
      this.rules = (config.rules || []).sort((a: PolicyRule, b: PolicyRule) => b.priority - a.priority);
    } catch {
      // Default policy if no file exists
      this.rules = [
        { toolName: 'runShell', argsPattern: 'rm -rf', decision: 'DENY', priority: 1000 },
        { toolName: '*', decision: 'ASK_USER', priority: 0 }
      ];
    }
  }

  check(toolName: string, args: any): PolicyDecision {
    if (this.temporaryAllowAll) return 'ALLOW';
    
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
