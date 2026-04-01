/**
 * Witness MCP client wrapper.
 * Spawns the Witness MCP server as a child process and communicates via stdio.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let client: Client | null = null;
let transport: StdioClientTransport | null = null;
let inSession = false;

const WITNESS_BIN = `${process.env.HOME}/.witness/witness`;

export async function connect(): Promise<Client> {
  if (client) return client;

  transport = new StdioClientTransport({
    command: WITNESS_BIN,
    args: [],
    cwd: `${process.env.HOME}/.witness`,
  });

  client = new Client({ name: 'pantry-host-tests', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

export async function disconnect(): Promise<void> {
  if (inSession) {
    try { await endSession(); } catch {}
  }
  if (transport) {
    await transport.close();
  }
  client = null;
  transport = null;
}

type ContentBlock = { type: string; text?: string; data?: string };

async function callTool(name: string, args: Record<string, unknown> = {}): Promise<ContentBlock[]> {
  if (!client) throw new Error('Not connected — call connect() first');
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    const msg = (result.content as ContentBlock[])?.[0]?.text ?? JSON.stringify(result.content);
    throw new Error(`Witness "${name}" failed: ${msg}`);
  }
  return (result.content ?? []) as ContentBlock[];
}

function extractText(content: ContentBlock[]): string {
  return content.find(c => c.type === 'text')?.text ?? '';
}

// --- Session ---

export async function startSession(name: string, options: {
  baseUrl?: string;
  headless?: boolean;
  width?: number;
  height?: number;
} = {}): Promise<void> {
  const args: Record<string, unknown> = { name, headless: options.headless ?? true };
  if (options.baseUrl) args.base_url = options.baseUrl;
  if (options.width) args.width = options.width;
  if (options.height) args.height = options.height;
  await callTool('start_session', args);
  inSession = true;
}

export async function endSession(): Promise<string> {
  const content = await callTool('end_session');
  inSession = false;
  return extractText(content);
}

// --- Navigation ---

export async function navigate(url: string): Promise<void> {
  await callTool('navigate__web', { url, returnScreenshot: false });
}

export async function reload(): Promise<void> {
  await callTool('reload__web', { returnScreenshot: false });
}

// --- Interaction ---

export async function click(target: { text?: string; selector?: string; x?: number; y?: number; waitAfter?: number }): Promise<void> {
  await callTool('click', { ...target, returnScreenshot: false });
}

export async function type(target: { text?: string; selector?: string }, value: string, clear = true): Promise<void> {
  await callTool('type', { ...target, value, clear, returnScreenshot: false });
}

export async function select(target: { text?: string; selector?: string }, value: string): Promise<void> {
  await callTool('select', { ...target, value, returnScreenshot: false });
}

export async function hover(target: { text?: string; selector?: string; x?: number; y?: number }): Promise<void> {
  await callTool('hover', { ...target, returnScreenshot: false });
}

export async function scroll(direction: 'up' | 'down' | 'left' | 'right', amount = 300): Promise<void> {
  await callTool('scroll', { direction, amount, returnScreenshot: false });
}

// --- Observation ---

export async function screenshot(name?: string): Promise<string> {
  const content = await callTool('screenshot', name ? { name } : {});
  const img = content.find(c => c.type === 'image');
  return img?.data ?? '';
}

export async function getPageState(): Promise<{
  url: string;
  title: string;
  forms: unknown[];
  buttons: Array<{ selector: string; text: string }>;
  links: Array<{ href: string; text: string }>;
  headings: Array<{ level: number; text: string }>;
}> {
  const content = await callTool('get_page_state__web');
  const text = extractText(content);
  try { return JSON.parse(text); } catch { return { url: '', title: '', forms: [], buttons: [], links: [], headings: [] }; }
}

export async function getText(target: { text?: string; selector?: string }): Promise<string> {
  const content = await callTool('get_text', target);
  return extractText(content);
}

export async function getHtml(selector = 'body', depth = 3): Promise<string> {
  const content = await callTool('get_html__web', { selector, depth });
  return extractText(content);
}

export async function findElements(description: string): Promise<string> {
  const content = await callTool('find_elements__web', { description });
  return extractText(content);
}

// --- Assertions ---

export async function assertVisible(target: { text?: string; selector?: string }, timeout = 5000): Promise<boolean> {
  const content = await callTool('assert_visible', { ...target, timeout, returnScreenshot: false });
  const text = extractText(content);
  // Witness returns text like "Assertion passed: ..." or throws on failure
  return !text.toLowerCase().includes('failed');
}

export async function assertText(target: { text?: string; selector?: string }, expected: string, exact = false): Promise<boolean> {
  const content = await callTool('assert_text', { ...target, expected, exact, returnScreenshot: false });
  const text = extractText(content);
  return !text.toLowerCase().includes('failed');
}

export async function assertUrl(pattern: string): Promise<boolean> {
  const content = await callTool('assert_url__web', { pattern, returnScreenshot: false });
  const text = extractText(content);
  return !text.toLowerCase().includes('failed');
}
