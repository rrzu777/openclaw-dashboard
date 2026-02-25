import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import util from 'util';
import path from 'path';

const execFilePromise = util.promisify(execFile);
const MEMORY_DIR = '/root/.openclaw/workspace/memory';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  // Sanitization: Only allow alphanumeric, spaces, hyphens, underscores
  const safeQuery = query.replace(/[^a-zA-Z0-9\s\-_]/g, '');
  if (!safeQuery) return NextResponse.json({ results: [] });

  try {
    // Use execFile with argument array to prevent shell injection
    const { stdout } = await execFilePromise('grep', [
      '-rin',
      '--max-count=5',
      '--',
      safeQuery,
      MEMORY_DIR,
    ]);

    const results = stdout
      .trim()
      .split('\n')
      .slice(0, 20)
      .map(line => {
        const parts = line.split(':');
        if (parts.length < 3) return null;

        const filePath = parts[0];
        const lineNum = parts[1];
        const content = parts.slice(2).join(':').trim();
        const fileName = path.basename(filePath);

        return {
          id: `${fileName}-${lineNum}`,
          fileName,
          lineNum,
          content,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ results });
  } catch (error: unknown) {
    // Grep returns exit code 1 if no matches found
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === '1') {
      return NextResponse.json({ results: [] });
    }
    // execFile sets exitCode on the error for non-zero exits
    const execError = error as { code?: number };
    if (execError.code === 1) return NextResponse.json({ results: [] });

    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
