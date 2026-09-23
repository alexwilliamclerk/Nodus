import path from 'node:path';
import os from 'node:os';

export function electronExecutable(root = process.cwd()) {
  const relative = process.platform === 'win32'
    ? ['electron.exe']
    : process.platform === 'darwin'
      ? ['Electron.app', 'Contents', 'MacOS', 'Electron']
      : ['electron'];
  return path.join(root, 'node_modules', 'electron', 'dist', ...relative);
}

export function savedLiveData(root = process.cwd()) {
  if (process.env.NODUS_LIVE_SOURCE) return path.resolve(process.env.NODUS_LIVE_SOURCE);
  return process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'Nodus', 'forma-data')
    : path.join(root, '.forma-data', 'live-flow-check');
}
