/** Build SKILL.md content from name/description/body (legacy refresh/regenerate output). */
export function buildSkillContent(skill: {
  name: string;
  description: string;
  content: string;
}): string {
  const frontmatter = `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n`;
  return frontmatter + skill.content;
}
