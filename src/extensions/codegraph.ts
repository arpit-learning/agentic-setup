import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { execFileSync } from 'child_process';
import { Parser, Language, Node } from 'web-tree-sitter';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { resolveCliBinary } from '../lib/resolve-cli.js';

export interface CodegraphStats {
  indexed: boolean;
  index_path?: string;
  index_age_days?: number;
  symbol_count?: number;
  file_count?: number;
  node_count?: number;
  edge_count?: number;
  error?: string;
}

const DEFAULT_EXCLUDES = [
  'node_modules',
  'build',
  '.gradle',
  'dist',
  'target',
  '.git',
  '.agentic-setup',
  '.codegraph',
  '.neo4j',
];

export const CODEGRAPH_MCP_SERVER = {
  command: 'node',
  args: ['${workspaceFolder}/.agentic-setup/codegraph-mcp-server.cjs'],
};

export function getExcludePatterns(): string[] {
  return DEFAULT_EXCLUDES;
}

const LANGUAGE_MAPPING: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hxx': 'cpp',
  '.cs': 'c_sharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.sh': 'bash',
  '.bash': 'bash',
  '.json': 'json',
};

function walkRepo(dir: string, excludes: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (excludes.includes(file)) continue;
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results = results.concat(walkRepo(fullPath, excludes));
    } else if (stat.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = (currentUrl: string) => {
      https
        .get(currentUrl, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              request(new URL(redirectUrl, currentUrl).href);
              return;
            }
          }
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: ${response.statusCode} for ${currentUrl}`));
            return;
          }
          const file = fs.createWriteStream(dest);
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          reject(err);
        });
    };
    request(url);
  });
}

async function ensureLanguageWasm(language: string): Promise<string> {
  const cacheDir = path.join(os.homedir(), '.agentic-setup', 'parsers');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  const destPath = path.join(cacheDir, `tree-sitter-${language}.wasm`);
  if (fs.existsSync(destPath)) {
    return destPath;
  }
  const pkgName = language.replace(/_/g, '-');
  const url = `https://unpkg.com/tree-sitter-${pkgName}@latest/tree-sitter-${language}.wasm`;
  await downloadFile(url, destPath);
  return destPath;
}

let _parserInitialized = false;

async function initParser() {
  if (_parserInitialized) return;

  // Resolve absolute path to tree-sitter.wasm bundled in web-tree-sitter
  const packageDir = path.dirname(import.meta.url).replace('file://', '');

  await Parser.init({
    locateFile(scriptName: string) {
      const candidates = [
        path.resolve(packageDir, '..', 'node_modules', 'web-tree-sitter', scriptName),
        path.resolve(packageDir, 'node_modules', 'web-tree-sitter', scriptName),
        path.resolve(process.cwd(), 'node_modules', 'web-tree-sitter', scriptName),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
      return scriptName;
    },
  });
  _parserInitialized = true;
}

interface ExtractedSymbol {
  id: string;
  name: string;
  type: string;
  range: {
    start: { row: number; column: number };
    end: { row: number; column: number };
  };
}

interface ExtractedCall {
  callerId: string | null;
  targetName: string;
}

function traverseAst(
  node: Node,
  langName: string,
  filePath: string,
  currentCallerId: string | null,
  symbols: ExtractedSymbol[],
  calls: ExtractedCall[],
) {
  let nextCallerId = currentCallerId;
  const nodeType = node.type;

  let isDefinition = false;
  let symType = 'variable';
  let symName = '';

  if (langName === 'javascript' || langName === 'typescript') {
    if (nodeType === 'function_declaration' || nodeType === 'function') {
      isDefinition = true;
      symType = 'function';
      symName = node.childForFieldName('name')?.text || '';
    } else if (nodeType === 'class_declaration' || nodeType === 'class') {
      isDefinition = true;
      symType = 'class';
      symName = node.childForFieldName('name')?.text || '';
    } else if (nodeType === 'method_definition') {
      isDefinition = true;
      symType = 'method';
      symName = node.childForFieldName('name')?.text || '';
    } else if (nodeType === 'interface_declaration') {
      isDefinition = true;
      symType = 'interface';
      symName = node.childForFieldName('name')?.text || '';
    }
  } else if (langName === 'python') {
    if (nodeType === 'function_definition') {
      isDefinition = true;
      symType = 'function';
      symName = node.childForFieldName('name')?.text || '';
    } else if (nodeType === 'class_definition') {
      isDefinition = true;
      symType = 'class';
      symName = node.childForFieldName('name')?.text || '';
    }
  } else if (langName === 'go') {
    if (nodeType === 'function_declaration') {
      isDefinition = true;
      symType = 'function';
      symName = node.childForFieldName('name')?.text || '';
    } else if (nodeType === 'method_declaration') {
      isDefinition = true;
      symType = 'method';
      symName = node.childForFieldName('name')?.text || '';
    } else if (nodeType === 'type_declaration') {
      isDefinition = true;
      symType = 'class';
      symName = node.childForFieldName('name')?.text || '';
    }
  } else if (langName === 'rust') {
    if (nodeType === 'function_item') {
      isDefinition = true;
      symType = 'function';
      symName = node.childForFieldName('name')?.text || '';
    } else if (nodeType === 'struct_item' || nodeType === 'enum_item') {
      isDefinition = true;
      symType = 'struct';
      symName = node.childForFieldName('name')?.text || '';
    }
  } else if (langName === 'java') {
    if (nodeType === 'method_declaration') {
      isDefinition = true;
      symType = 'method';
      symName = node.childForFieldName('name')?.text || '';
    } else if (nodeType === 'class_declaration') {
      isDefinition = true;
      symType = 'class';
      symName = node.childForFieldName('name')?.text || '';
    }
  } else if (langName === 'c' || langName === 'cpp') {
    if (nodeType === 'function_definition') {
      isDefinition = true;
      symType = 'function';
      const decl = node.childForFieldName('declarator');
      if (decl) {
        let current = decl;
        while (current && current.type !== 'identifier') {
          current = current.childForFieldName('declarator') || current.firstChild || null!;
        }
        symName = current ? current.text : decl.text;
      }
    } else if (nodeType === 'class_specifier' || nodeType === 'struct_specifier') {
      isDefinition = true;
      symType = 'class';
      symName = node.childForFieldName('name')?.text || '';
    }
  }

  if (isDefinition && symName) {
    const id = `file://${filePath}#L${node.startPosition.row + 1}:${symName}`;
    symbols.push({
      id,
      name: symName,
      type: symType,
      range: {
        start: { row: node.startPosition.row, column: node.startPosition.column },
        end: { row: node.endPosition.row, column: node.endPosition.column },
      },
    });
    if (symType === 'function' || symType === 'method') {
      nextCallerId = id;
    }
  }

  let isCall = false;
  let calleeName = '';
  if (
    langName === 'javascript' ||
    langName === 'typescript' ||
    langName === 'go' ||
    langName === 'rust' ||
    langName === 'c' ||
    langName === 'cpp'
  ) {
    if (nodeType === 'call_expression') {
      isCall = true;
      const callee = node.childForFieldName('function') || node.firstChild;
      if (callee) {
        calleeName = callee.text;
        if (calleeName.includes('.')) {
          const parts = calleeName.split('.');
          calleeName = parts[parts.length - 1];
        }
      }
    }
  } else if (langName === 'python') {
    if (nodeType === 'call') {
      isCall = true;
      const callee = node.childForFieldName('function') || node.firstChild;
      if (callee) {
        calleeName = callee.text;
        if (calleeName.includes('.')) {
          const parts = calleeName.split('.');
          calleeName = parts[parts.length - 1];
        }
      }
    }
  } else if (langName === 'java') {
    if (nodeType === 'method_invocation') {
      isCall = true;
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        calleeName = nameNode.text;
      }
    }
  }

  if (isCall && calleeName && currentCallerId) {
    calls.push({
      callerId: currentCallerId,
      targetName: calleeName,
    });
  }

  const childCount = node.childCount;
  for (let i = 0; i < childCount; i++) {
    traverseAst(node.child(i)!, langName, filePath, nextCallerId, symbols, calls);
  }
}

export async function runCodegraphIndex(
  repoRoot: string,
  _options: { timeoutMs?: number } = {},
): Promise<{ ok: boolean; output: string }> {
  try {
    await initParser();

    const allFiles = walkRepo(repoRoot, DEFAULT_EXCLUDES);
    const parsedFiles: string[] = [];
    const symbols: ExtractedSymbol[] = [];
    const calls: ExtractedCall[] = [];

    // Group files by language mapping
    const langFiles: Record<string, string[]> = {};
    for (const file of allFiles) {
      const ext = path.extname(file).toLowerCase();
      const lang = LANGUAGE_MAPPING[ext];
      if (lang) {
        if (!langFiles[lang]) langFiles[lang] = [];
        langFiles[lang].push(file);
      }
    }

    for (const [langName, files] of Object.entries(langFiles)) {
      let wasmPath;
      try {
        wasmPath = await ensureLanguageWasm(langName);
      } catch (err) {
        console.warn(`  ⚠ Skipping ${langName} indexing: could not fetch parser WASM.`, err);
        continue;
      }

      const lang = await Language.load(wasmPath);
      const parser = new Parser();
      parser.setLanguage(lang);

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const tree = parser.parse(content);
          if (tree) {
            traverseAst(tree.rootNode, langName, file, null, symbols, calls);
            parsedFiles.push(file);
          }
        } catch {
          // ignore individual parse errors
        }
      }
    }

    // Build graph structure
    const graph: {
      stats: Record<string, number>;
      nodes: Record<string, any>;
      edges: any[];
    } = {
      stats: {},
      nodes: {},
      edges: [],
    };

    const symbolByName: Record<string, string[]> = Object.create(null);
    for (const sym of symbols) {
      graph.nodes[sym.id] = {
        id: sym.id,
        name: sym.name,
        file: sym.id.split('#')[0].replace('file://', ''),
        type: sym.type,
        range: sym.range,
      };
      if (!symbolByName[sym.name]) symbolByName[sym.name] = [];
      symbolByName[sym.name].push(sym.id);
    }

    // Resolve calls/edges
    for (const call of calls) {
      if (!call.callerId) continue;
      const targetIds = symbolByName[call.targetName];
      if (targetIds && targetIds.length > 0) {
        // Resolve to same-file first, otherwise just link to all matches
        const callerFile = call.callerId.split('#')[0];
        const sameFileTarget = targetIds.find((id) => id.startsWith(callerFile));
        if (sameFileTarget) {
          graph.edges.push({
            from: call.callerId,
            to: sameFileTarget,
            type: 'CALLS',
          });
        } else {
          for (const targetId of targetIds) {
            graph.edges.push({
              from: call.callerId,
              to: targetId,
              type: 'CALLS',
            });
          }
        }
      }
    }

    graph.stats = {
      files: parsedFiles.length,
      symbols: symbols.length,
      nodes: Object.keys(graph.nodes).length,
      edges: graph.edges.length,
    };

    const outPath = path.join(repoRoot, '.agents', 'codegraph.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(graph, null, 2));

    return {
      ok: true,
      output: `Indexed ${graph.stats.symbols} symbols in ${graph.stats.files} files (${graph.stats.nodes} nodes, ${graph.stats.edges} edges)`,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      output: err instanceof Error ? err.message : String(err),
    };
  }
}

export function getCodegraphStats(repoRoot: string): CodegraphStats {
  const statsPath = path.join(repoRoot, '.agents', 'codegraph.json');
  if (fs.existsSync(statsPath)) {
    try {
      const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8')).stats;
      let ageDays: number | undefined;
      try {
        const mtime = fs.statSync(statsPath).mtimeMs;
        ageDays = Math.floor((Date.now() - mtime) / (1000 * 60 * 60 * 24));
      } catch {
        // ignore
      }
      return {
        indexed: true,
        index_path: statsPath,
        index_age_days: ageDays,
        symbol_count: stats.symbols || 0,
        file_count: stats.files || 0,
        node_count: stats.nodes || 0,
        edge_count: stats.edges || 0,
      };
    } catch {
      // ignore
    }
  }
  return { indexed: false };
}

export function checkCodegraphCli(_repoRoot = process.cwd()): {
  available: boolean;
  version?: string;
  missing?: string[];
} {
  const missing: string[] = [];

  // Check Node.js
  try {
    execFileSync('node', ['--version'], { encoding: 'utf-8', timeout: 3_000 });
  } catch {
    missing.push('node');
  }

  return {
    available: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
  };
}

export function mergeCodegraphMcp(repoRoot: string, dryRun = false): boolean {
  let added = false;

  const cliBin = resolveCliBinary();
  const mcpServerConfig = cliBin.includes(' ')
    ? {
        command: cliBin.split(' ')[0],
        args: [...cliBin.split(' ').slice(1), 'codegraph', 'serve', '${workspaceFolder}'],
      }
    : { command: cliBin, args: ['codegraph', 'serve', '${workspaceFolder}'] };

  // IDE-specific MCP configuration paths and keys
  const ideConfigs: Array<{
    path: string;
    key: 'mcpServers' | 'servers';
  }> = [
    { path: '.cursor/mcp.json', key: 'mcpServers' },
    { path: '.vscode/mcp.json', key: 'servers' },
    { path: '.windsurf/mcp.json', key: 'mcpServers' },
    { path: '.devin/mcp.json', key: 'mcpServers' },
    { path: '.codex/mcp.json', key: 'mcpServers' },
    { path: '.idea/mcp.json', key: 'mcpServers' },
    { path: path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json'), key: 'mcpServers' },
  ];

  for (const config of ideConfigs) {
    const mcpPath = path.isAbsolute(config.path) ? config.path : path.join(repoRoot, config.path);
    if (!fs.existsSync(path.dirname(mcpPath))) {
      fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
    }

    let existing: Record<string, unknown> = {};
    if (fs.existsSync(mcpPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      } catch {
        existing = {};
      }
    }

    if (!existing[config.key]) existing[config.key] = {};
    const servers = existing[config.key] as Record<string, unknown>;
    if (!servers.codegraph) {
      servers.codegraph = mcpServerConfig;
      if (!dryRun) {
        fs.writeFileSync(mcpPath, JSON.stringify(existing, null, 2));
      }
      added = true;
    } else {
      const currentArgs = (servers.codegraph as any).args || [];
      if (currentArgs.some((arg: string) => arg.includes('codegraph-mcp-server.js'))) {
        servers.codegraph = mcpServerConfig;
        if (!dryRun) {
          fs.writeFileSync(mcpPath, JSON.stringify(existing, null, 2));
        }
        added = true;
      }
    }
  }

  return added;
}

export function writeIndexScript(repoRoot: string, dryRun = false): string {
  const scriptPath = path.join(repoRoot, '.agentic-setup', 'index-codegraph.js');
  const cliBin = resolveCliBinary();

  const content = `#!/usr/bin/env node
import { spawn } from 'child_process';

const child = spawn('${cliBin}', ['codegraph', 'index'], {
  shell: true,
  stdio: 'inherit'
});
child.on('exit', (code) => process.exit(code || 0));
`;

  if (!dryRun) {
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, content, { mode: 0o755 });
  }
  return scriptPath;
}

export function writeMcpServerScript(repoRoot: string, dryRun = false): string {
  const scriptPath = path.join(repoRoot, '.agentic-setup', 'codegraph-mcp-server.cjs');
  const cliBin = resolveCliBinary();

  const content = `#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const workspaceRoot = path.dirname(__dirname);
const child = spawn('${cliBin}', ['codegraph', 'serve', workspaceRoot], {
  shell: true,
  stdio: 'inherit'
});
child.on('exit', (code) => process.exit(code || 0));
`;

  if (!dryRun) {
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, content, { mode: 0o755 });
  }
  return scriptPath;
}

export function appendGitignoreEntries(repoRoot: string, dryRun = false): void {
  const gitignorePath = path.join(repoRoot, '.gitignore');
  const marker = '# agentic-setup codegraph';
  const content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
  if (content.includes(marker)) return;

  const block = `\n${marker}\n.codegraph/\ncodegraph.db\n.neo4j/\n.agentic-setup/index-codegraph.js\n.agentic-setup/codegraph-mcp-server.cjs\n.cursor/mcp.json\n.vscode/mcp.json\n.windsurf/mcp.json\n.devin/mcp.json\n.codex/mcp.json\n.idea/mcp.json\n`;
  if (!dryRun) {
    fs.writeFileSync(gitignorePath, content + block);
  }
}

export function parseIndexOutput(output: string): Partial<CodegraphStats> {
  const stats: Partial<CodegraphStats> = {};
  const symbolMatch = output.match(/(\d+)\s+symbols?/i);
  const fileMatch = output.match(/(\d+)\s+files?/i);
  const nodeMatch = output.match(/(\d+)\s+nodes?/i);
  const edgeMatch = output.match(/(\d+)\s+edges?/i);

  if (symbolMatch) stats.symbol_count = parseInt(symbolMatch[1], 10);
  if (fileMatch) stats.file_count = parseInt(fileMatch[1], 10);
  if (nodeMatch) stats.node_count = parseInt(nodeMatch[1], 10);
  if (edgeMatch) stats.edge_count = parseInt(edgeMatch[1], 10);

  return stats;
}

export function readMcpConfig(repoRoot: string): { valid: boolean; hasCodegraph: boolean } {
  const mcpPaths = [
    path.join(repoRoot, 'mcp.json'),
    path.join(repoRoot, '.cursor', 'mcp.json'),
    path.join(repoRoot, '.vscode', 'mcp.json'),
    path.join(repoRoot, '.windsurf', 'mcp.json'),
    path.join(repoRoot, '.devin', 'mcp.json'),
    path.join(repoRoot, '.codex', 'mcp.json'),
    path.join(repoRoot, '.idea', 'mcp.json'),
    path.join(repoRoot, '.antigravity', 'mcp.json'),
  ];

  for (const mcpPath of mcpPaths) {
    if (!fs.existsSync(mcpPath)) continue;
    try {
      const config = JSON.parse(fs.readFileSync(mcpPath, 'utf-8')) as {
        mcpServers?: Record<string, unknown>;
        servers?: Record<string, unknown>;
      };
      const servers = config.mcpServers || config.servers;
      return { valid: true, hasCodegraph: Boolean(servers?.codegraph) };
    } catch {
      continue;
    }
  }

  return { valid: false, hasCodegraph: false };
}

export async function codegraphServe(repoRoot: string): Promise<void> {
  const dbPath = path.join(repoRoot, '.agents', 'codegraph.json');
  let graph: {
    stats: Record<string, number>;
    nodes: Record<string, any>;
    edges: any[];
  } = { stats: {}, nodes: {}, edges: [] };

  if (fs.existsSync(dbPath)) {
    try {
      graph = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch {
      // ignore
    }
  }

  const server = new Server(
    {
      name: 'codegraph-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  function findNodesBySymbol(symbol: string, file?: string) {
    return Object.values(graph.nodes).filter((node: any) => {
      if (node.name !== symbol) return false;
      if (file && !node.file.endsWith(file)) return false;
      return true;
    });
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_neighborhood',
          description:
            'Retrieve neighborhood around a node (function, class, variable) for LLM context',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                description: 'Symbol name to query (e.g., function name, class name)',
              },
              file: {
                type: 'string',
                description: 'File path to narrow search',
              },
              depth: {
                type: 'number',
                description: 'Neighborhood depth (default: 2)',
                default: 2,
              },
            },
            required: ['symbol'],
          },
        },
        {
          name: 'search_symbols',
          description: 'Search for symbols by name pattern',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'Search pattern (supports regex)',
              },
              limit: {
                type: 'number',
                description: 'Max results (default: 20)',
                default: 20,
              },
            },
            required: ['pattern'],
          },
        },
        {
          name: 'get_callers',
          description: 'Get all callers of a function',
          inputSchema: {
            type: 'object',
            properties: {
              function: {
                type: 'string',
                description: 'Function name',
              },
            },
            required: ['function'],
          },
        },
        {
          name: 'get_callees',
          description: 'Get all functions called by a function',
          inputSchema: {
            type: 'object',
            properties: {
              function: {
                type: 'string',
                description: 'Function name',
              },
            },
            required: ['function'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let records: any = [];

      switch (name) {
        case 'get_neighborhood': {
          const {
            symbol,
            file,
            depth = 2,
          } = args as { symbol: string; file?: string; depth?: number };
          const startNodes = findNodesBySymbol(symbol, file);

          if (startNodes.length > 0) {
            const visitedNodeIds = new Set<string>();
            const rships: any[] = [];
            let currentLevelIds = startNodes.map((n) => n.id);
            currentLevelIds.forEach((id) => visitedNodeIds.add(id));

            for (let d = 0; d < depth; d++) {
              const nextLevelIds = new Set<string>();
              for (const id of currentLevelIds) {
                const connectedEdges = graph.edges.filter((e) => e.from === id || e.to === id);
                for (const edge of connectedEdges) {
                  const fromNode = graph.nodes[edge.from];
                  const toNode = graph.nodes[edge.to];
                  rships.push({
                    from: fromNode?.name || edge.from,
                    to: toNode?.name || edge.to,
                    type: edge.type,
                  });

                  const neighborId = edge.from === id ? edge.to : edge.from;
                  if (!visitedNodeIds.has(neighborId)) {
                    visitedNodeIds.add(neighborId);
                    nextLevelIds.add(neighborId);
                  }
                }
              }
              currentLevelIds = Array.from(nextLevelIds);
            }

            const nodes = Array.from(visitedNodeIds)
              .map((id) => graph.nodes[id])
              .filter(Boolean)
              .map((n: any) => ({ name: n.name, file: n.file, type: n.type }));

            records = [
              {
                result: {
                  symbol,
                  file: startNodes[0].file,
                  type: startNodes[0].type,
                  neighborhood: { nodes, relationships: rships },
                },
              },
            ];
          }
          break;
        }

        case 'search_symbols': {
          const { pattern, limit = 20 } = args as { pattern: string; limit?: number };
          const regex = new RegExp(pattern, 'i');
          records = Object.values(graph.nodes)
            .filter((n: any) => regex.test(n.name))
            .slice(0, limit)
            .map((n: any) => ({ name: n.name, file: n.file, type: n.type }));
          break;
        }

        case 'get_callers': {
          const { function: func } = args as { function: string };
          const targetIds = Object.values(graph.nodes)
            .filter((n: any) => n.name === func)
            .map((n: any) => n.id);

          records = graph.edges
            .filter((e) => targetIds.includes(e.to))
            .map((e) => {
              const callerNode = graph.nodes[e.from];
              return callerNode ? { caller: callerNode.name, file: callerNode.file } : null;
            })
            .filter(Boolean);
          break;
        }

        case 'get_callees': {
          const { function: func } = args as { function: string };
          const callerIds = Object.values(graph.nodes)
            .filter((n: any) => n.name === func)
            .map((n: any) => n.id);

          records = graph.edges
            .filter((e) => callerIds.includes(e.from))
            .map((e) => {
              const calleeNode = graph.nodes[e.to];
              return calleeNode ? { callee: calleeNode.name, file: calleeNode.file } : null;
            })
            .filter(Boolean);
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(records, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }),
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
