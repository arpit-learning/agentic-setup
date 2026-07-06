import * as p from '@clack/prompts';

export async function promptInput(question: string): Promise<string> {
  if (!process.stdin.isTTY) return '';
  try {
    const answer = await p.text({ message: question });
    if (p.isCancel(answer)) return '';
    return answer.trim();
  } catch {
    return '';
  }
}
