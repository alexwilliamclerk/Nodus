import { mkdir, readFile, writeFile, cp, access, rename } from "node:fs/promises";
import path from "node:path";
import {randomUUID} from 'node:crypto';
import { readArtifact } from "./artifact-service.mjs";

const EMPTY_STATE = {
  schemaVersion: 1,
  activeTaskId: null,
  tasks: [],
  settings: {
    provider: "kimi-coding",
    modelId: "",
  },
};

export class StorageService {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.statePath = path.join(dataDir, "state.json");
    this.credentialPath = path.join(dataDir, "credentials.json");
    this.artifactRoot = path.join(dataDir, "artifacts");
    this.piDir = path.join(dataDir, "pi");
  }

  async initialize() {
    await Promise.all([
      mkdir(this.dataDir, { recursive: true }),
      mkdir(this.artifactRoot, { recursive: true }),
      mkdir(this.piDir, { recursive: true }),
    ]);
  }

  async loadState() {
    try {
      const parsed = JSON.parse(await readFile(this.statePath, "utf8"));
      return { ...structuredClone(EMPTY_STATE), ...parsed };
    } catch (error) {
      if (error.code === "ENOENT") return structuredClone(EMPTY_STATE);
      throw error;
    }
  }

  async saveState(state) {
    const next = {
      schemaVersion: 1,
      activeTaskId: state.activeTaskId ?? null,
      tasks: Array.isArray(state.tasks) ? state.tasks : [],
      settings: { ...EMPTY_STATE.settings, ...(state.settings || {}) },
    };
    await writeFile(this.statePath, JSON.stringify(next, null, 2), "utf8");
    return next;
  }

  taskDir(taskId) {
    return path.join(this.artifactRoot, taskId);
  }

  versionDir(taskId, versionId) {
    return path.join(this.taskDir(taskId), versionId);
  }

  async prepareVersion(taskId, versionId, baseVersionId = null) {
    const destination = this.versionDir(taskId, versionId);
    await mkdir(this.taskDir(taskId), { recursive: true });
    if (baseVersionId) {
      await cp(this.versionDir(taskId, baseVersionId), destination, {
        recursive: true,
        errorOnExist: true,
      });
    } else {
      await mkdir(destination, { recursive: false });
    }
    return destination;
  }

  async prepareWorkingVersion(taskId, versionId, baseVersionId = null) {
    const workingId = `.pending-${versionId}-${randomUUID()}`;
    const workingDir = this.versionDir(taskId, workingId);
    await mkdir(this.taskDir(taskId), { recursive: true });
    if (baseVersionId) {
      await cp(this.versionDir(taskId, baseVersionId), workingDir, { recursive: true, errorOnExist: true });
    } else {
      await mkdir(workingDir, { recursive: false });
    }
    return workingDir;
  }

  async commitWorkingVersion(taskId, versionId, workingDir) {
    const destination = this.versionDir(taskId, versionId);
    await rename(workingDir, destination);
    return destination;
  }

  async artifactExists(taskId, versionId) {
    try {
      await readArtifact(this.versionDir(taskId, versionId));
      return true;
    } catch {
      return false;
    }
  }
}

export function createEmptyState() {
  return structuredClone(EMPTY_STATE);
}
