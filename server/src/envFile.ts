import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(process.cwd(), '.env');

function formatValue(value: string): string {
  if (/\s|#|"|'/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

export function updateEnvFile(updates: Record<string, string>): void {
  let content = '';
  try {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  } catch {
    content = '';
  }

  const lines = content.split(/\r?\n/);
  const keys = Object.keys(updates);
  const updated = new Set<string>();

  const newLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match && keys.includes(match[1])) {
      updated.add(match[1]);
      return `${match[1]}=${formatValue(updates[match[1]])}`;
    }
    return line;
  });

  for (const key of keys) {
    if (!updated.has(key)) {
      newLines.push(`${key}=${formatValue(updates[key])}`);
    }
  }

  fs.writeFileSync(ENV_PATH, newLines.join('\n'), 'utf8');

  for (const key of keys) {
    process.env[key] = updates[key];
  }
}
