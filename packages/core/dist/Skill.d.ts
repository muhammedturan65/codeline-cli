import { Tool } from './tools.js';
export interface Skill {
    name: string;
    description: string;
    tools: Tool[];
}
export declare class SkillRegistry {
    private skills;
    register(skill: Skill): void;
    getSkill(name: string): Skill | undefined;
    getAllSkills(): Skill[];
}
export declare const skillRegistry: SkillRegistry;
