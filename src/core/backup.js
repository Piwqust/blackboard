import {
  WORKSPACE_FORMAT,
  WORKSPACE_SCHEMA_VERSION,
  normalizeWorkspace
} from './schema.js';

export const BACKUP_FILE_EXTENSION = '.blackboard.json';
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export function createWorkspaceBackup(workspace, { appVersion = 'development', exportedAt = new Date().toISOString() } = {}) {
  return {
    format: WORKSPACE_FORMAT,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt,
    appVersion,
    workspace: normalizeWorkspace(workspace)
  };
}

export function serializeWorkspaceBackup(workspace, metadata) {
  return `${JSON.stringify(createWorkspaceBackup(workspace, metadata), null, 2)}\n`;
}

export function parseWorkspaceBackup(text, options = {}) {
  if (typeof text !== 'string') {
    throw new Error('The selected backup is not text.');
  }

  if (text.length > MAX_BACKUP_BYTES) {
    throw new Error('This backup is larger than 50 MB and was not opened.');
  }

  let candidate;
  try {
    candidate = JSON.parse(text);
  } catch (error) {
    throw new Error('This file is not valid JSON.');
  }

  const backup = asRecord(candidate);
  if (!backup || backup.format !== WORKSPACE_FORMAT) {
    throw new Error('This is not a Blackboard Text backup.');
  }

  if (backup.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    throw new Error(`This backup uses schema version ${String(backup.schemaVersion)} and cannot be imported by this release.`);
  }

  const sourceWorkspace = asRecord(backup.workspace);
  if (!sourceWorkspace || !Array.isArray(sourceWorkspace.pages) || sourceWorkspace.pages.length === 0) {
    throw new Error('The backup does not contain any pages.');
  }

  const workspace = normalizeWorkspace(sourceWorkspace, options);
  if (workspace.pages.length === 0) {
    throw new Error('The backup does not contain an importable page.');
  }

  return {
    metadata: {
      exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : null,
      appVersion: typeof backup.appVersion === 'string' ? backup.appVersion : null
    },
    workspace
  };
}

export function makeBackupFilename(date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
  return `blackboard-text_${stamp}${BACKUP_FILE_EXTENSION}`;
}

export function describeBackup(workspace) {
  const count = Array.isArray(workspace?.pages) ? workspace.pages.length : 0;
  return `${count} ${count === 1 ? 'page' : 'pages'}`;
}
