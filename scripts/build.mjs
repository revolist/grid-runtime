import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
rmSync(new URL('../dist/', import.meta.url), { recursive: true, force: true });
for (const [tool, args] of [
  [resolve(dirname(require.resolve('typescript')), '../bin/tsc'), ['-p', 'tsconfig.json']],
  [resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js'), ['build']],
]) {
  const result = spawnSync(process.execPath, [tool, ...args], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
