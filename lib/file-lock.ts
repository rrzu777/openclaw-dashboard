import fs from 'fs/promises';

const LOCK_TIMEOUT = 10_000;
const RETRY_DELAY = 50;

export async function withFileLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  const lockFile = lockPath + '.lock';
  const start = Date.now();

  while (true) {
    try {
      await fs.writeFile(lockFile, String(process.pid), { flag: 'wx' });
      break;
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err;
      if (Date.now() - start > LOCK_TIMEOUT) {
        await fs.unlink(lockFile).catch(() => {});
        continue;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
    }
  }

  try {
    return await fn();
  } finally {
    await fs.unlink(lockFile).catch(() => {});
  }
}
