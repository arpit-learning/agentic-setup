import fs from 'fs';
import path from 'path';

interface Section {
  title: string;
  content: string;
}

export class DebugReport {
  private sections: Section[] = [];
  private startTime: number;
  private stepTimings: Array<{ step: string; durationMs: number }> = [];
  private lastStepStart: number;
  private lastStepName: string | null = null;

  constructor() {
    this.startTime = Date.now();
    this.lastStepStart = this.startTime;
  }

  markStep(name: string): void {
    if (this.lastStepName) {
      this.stepTimings.push({
        step: this.lastStepName,
        durationMs: Date.now() - this.lastStepStart,
      });
    }
    this.lastStepName = name;
    this.lastStepStart = Date.now();
  }

  addSection(title: string, content: string): void {
    this.sections.push({ title, content });
  }

  addJson(title: string, data: unknown): void {
    this.sections.push({
      title,
      content: '```json\n' + JSON.stringify(data, null, 2) + '\n```',
    });
  }

  addCodeBlock(title: string, code: string, lang = 'text'): void {
    this.sections.push({
      title,
      content: '```' + lang + '\n' + code + '\n```',
    });
  }

  write(outputPath: string): void {
    // Finalize last step timing
    if (this.lastStepName) {
      this.stepTimings.push({
        step: this.lastStepName,
        durationMs: Date.now() - this.lastStepStart,
      });
    }

    const totalMs = Date.now() - this.startTime;
    const lines: string[] = [];

    lines.push('# agentic-setup Debug Report');
    lines.push('');
    lines.push(`- **Generated**: ${new Date().toISOString()}`);
    lines.push(`- **CWD**: ${process.cwd()}`);
    lines.push(`- **Node**: ${process.version}`);
    lines.push(`- **Total elapsed**: ${formatMs(totalMs)}`);
    lines.push('');

    for (const section of this.sections) {
      lines.push(`## ${section.title}`);
      lines.push('');
      lines.push(section.content);
      lines.push('');
    }

    // Timing section
    if (this.stepTimings.length > 0) {
      lines.push('## Timing');
      lines.push('');
      lines.push('| Step | Duration |');
      lines.push('|------|----------|');
      for (const t of this.stepTimings) {
        lines.push(`| ${t.step} | ${formatMs(t.durationMs)} |`);
      }
      lines.push(`| **Total** | **${formatMs(totalMs)}** |`);
      lines.push('');
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, lines.join('\n'));
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins > 0) return `${mins}m ${remSecs}s`;
  return `${secs}s`;
}
