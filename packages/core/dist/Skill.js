export class SkillRegistry {
    skills = new Map();
    register(skill) {
        this.skills.set(skill.name, skill);
    }
    getSkill(name) {
        return this.skills.get(name);
    }
    getAllSkills() {
        return Array.from(this.skills.values());
    }
}
export const skillRegistry = new SkillRegistry();
