import { Tool } from './tools.js';

export interface Skill {
  name: string;
  description: string;
  tools: Tool[];
}

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  register(skill: Skill) {
    this.skills.set(skill.name, skill);
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
}

export const skillRegistry = new SkillRegistry();
