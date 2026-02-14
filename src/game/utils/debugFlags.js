const CONSOLE_BACKUP_KEY = "__DEBUG_CONSOLE_BACKUP__";

function getDebugOverride() {
  if (typeof globalThis.localStorage !== "undefined") {
    const stored = globalThis.localStorage.getItem("debugEnabled");
    if (stored === "true") return true;
    if (stored === "false") return false;
  }
  return typeof globalThis.__DEBUG_ENABLED__ === "boolean"
    ? globalThis.__DEBUG_ENABLED__
    : null;
}

export function isDebugEnabled() {
  const override = getDebugOverride();
  if (override !== null) return override;
  return import.meta.env.DEV || import.meta.env.VITE_DEBUG === "true";
}

function backupConsole() {
  if (globalThis[CONSOLE_BACKUP_KEY] || !globalThis.console) return;
  globalThis[CONSOLE_BACKUP_KEY] = {
    log: globalThis.console.log,
    info: globalThis.console.info,
    debug: globalThis.console.debug,
    warn: globalThis.console.warn,
  };
}

function restoreConsole() {
  const backup = globalThis[CONSOLE_BACKUP_KEY];
  if (!backup || !globalThis.console) return;
  globalThis.console.log = backup.log;
  globalThis.console.info = backup.info;
  globalThis.console.debug = backup.debug;
  globalThis.console.warn = backup.warn;
}

export function configureDebugRuntime() {
  if (isDebugEnabled()) {
    restoreConsole();
    return;
  }
  if (!globalThis.console) return;

  backupConsole();
  const noop = () => {};
  globalThis.console.log = noop;
  globalThis.console.info = noop;
  globalThis.console.debug = noop;
  globalThis.console.warn = noop;
}

export function setDebugEnabled(value) {
  globalThis.__DEBUG_ENABLED__ = Boolean(value);
  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.setItem(
      "debugEnabled",
      globalThis.__DEBUG_ENABLED__ ? "true" : "false",
    );
  }
  configureDebugRuntime();
  return isDebugEnabled();
}

export function registerDebugHelpers() {
  globalThis.setDebugEnabled = setDebugEnabled;
}
