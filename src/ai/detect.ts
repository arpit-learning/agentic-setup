import { llmJsonCall } from '../llm/index.js';
import { getFastModel } from '../llm/config.js';
import { FINGERPRINT_SYSTEM_PROMPT } from './prompts.js';

interface DetectResult {
  languages: string[];
  frameworks: string[];
  tools: string[];
  workspaces: string[];
}

export async function detectProjectStack(
  fileTree: string[],
  suffixCounts: Record<string, number>,
  modelOverride?: string,
  programmaticHints?: { languages: string[]; frameworks: string[]; tools: string[] },
): Promise<DetectResult> {
  const parts: string[] = [
    'Analyze this project and detect languages, frameworks, and external tools/services.\n',
  ];

  if (programmaticHints) {
    parts.push('Programmatic checks have already pre-detected these components:');
    if (programmaticHints.languages.length > 0) {
      parts.push(`- Languages: ${programmaticHints.languages.join(', ')}`);
    }
    if (programmaticHints.frameworks.length > 0) {
      parts.push(`- Frameworks: ${programmaticHints.frameworks.join(', ')}`);
    }
    if (programmaticHints.tools.length > 0) {
      parts.push(`- Tools/Libraries: ${programmaticHints.tools.join(', ')}`);
    }
    parts.push(
      '\nUse this as baseline information. Search the file tree to confirm and find any other languages, frameworks, tools, services, and sub-workspaces that were not listed above.\n',
    );
  }

  if (fileTree.length > 0) {
    const cappedTree = fileTree.slice(0, 500);
    parts.push(`File tree (${cappedTree.length}/${fileTree.length} entries):`);
    parts.push(cappedTree.join('\n'));
  }

  const sorted = Object.entries(suffixCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) {
    parts.push('\nFile extension distribution (sorted by frequency):');
    for (const [ext, count] of sorted) {
      parts.push(`${ext}: ${count}`);
    }
  }

  const fastModel = modelOverride ?? getFastModel();

  const result = await llmJsonCall<DetectResult>({
    system: FINGERPRINT_SYSTEM_PROMPT,
    prompt: parts.join('\n'),
    ...(fastModel ? { model: fastModel } : {}),
    skipModelRecovery: true,
  });

  return {
    languages: Array.isArray(result.languages) ? result.languages : [],
    frameworks: Array.isArray(result.frameworks) ? result.frameworks : [],
    tools: Array.isArray(result.tools) ? result.tools : [],
    workspaces: Array.isArray(result.workspaces) ? result.workspaces : [],
  };
}
