// Runs a bash script with the right bash on every system (used by `npm run check:prod`).
// On Windows, `bash` in PowerShell or cmd is usually WSL's, which fails without a Linux distribution,
// so this uses Git Bash, found next to git itself. Elsewhere it uses the bash on the PATH.
//
//   node scripts/run-bash.mjs scripts/check-production.sh [arguments]
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function findBash() {
  if (process.platform !== 'win32') return 'bash';
  try {
    // e.g. C:/Program Files/Git/mingw64/libexec/git-core → C:/Program Files/Git/bin/bash.exe
    const execPath = execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim();
    const gitBash = join(execPath, '..', '..', '..', 'bin', 'bash.exe');
    if (existsSync(gitBash)) return gitBash;
  } catch {
    // git isn't on the PATH: fall through to the default install folder.
  }
  const fallback = 'C:\\Program Files\\Git\\bin\\bash.exe';
  if (existsSync(fallback)) return fallback;
  console.error('Git Bash not found. Install Git for Windows (https://git-scm.com) or run the script from Git Bash.');
  process.exit(1);
}

const [script, ...args] = process.argv.slice(2);
const result = spawnSync(findBash(), [script, ...args], { stdio: 'inherit' });
process.exit(result.status ?? 1);
