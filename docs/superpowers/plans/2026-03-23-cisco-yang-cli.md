# cisco-yang CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js CLI and SDK for querying IOS-XE devices via RESTCONF, focused on voice troubleshooting.

**Architecture:** Commander-based CLI wrapping a `YangService` class that makes HTTP requests to RESTCONF endpoints. Follows the cisco-axl pattern exactly — same config system, formatters, audit logging, and read-only enforcement adapted for RESTCONF instead of SOAP.

**Tech Stack:** Node.js, TypeScript, Commander, Axios, cli-table3, csv-stringify, @toon-format/toon

**Spec:** `docs/superpowers/specs/2026-03-23-cisco-yang-cli-design.md`

**Reference:** `/Users/wordenj/Developer/cisco-axl/` — the cisco-axl CLI this is modeled after.

---

## File Map

| File                       | Responsibility                                                |
| -------------------------- | ------------------------------------------------------------- |
| `package.json`             | Package metadata, dependencies, scripts, bin entry            |
| `tsconfig.json`            | TypeScript compiler config                                    |
| `bin/cisco-yang.js`        | Shebang entry point, delegates to `cli/index.js`              |
| `cli/index.js`             | Commander program setup, global flags, command registration   |
| `cli/formatters/json.js`   | JSON output formatter                                         |
| `cli/formatters/csv.js`    | CSV output formatter                                          |
| `cli/formatters/table.js`  | ASCII table output formatter                                  |
| `cli/formatters/toon.js`   | TOON output formatter                                         |
| `cli/utils/wordlist.js`    | Random word generator for confirmation                        |
| `cli/utils/stdin.js`       | Read piped stdin                                              |
| `cli/utils/confirm.js`     | TTY confirmation with random word                             |
| `cli/utils/readonly.js`    | Read-only mode enforcement                                    |
| `cli/utils/config.js`      | Multi-device config file management, Secret Server resolution |
| `cli/utils/audit.js`       | JSONL audit logging with rotation                             |
| `cli/utils/output.js`      | Output routing (printResult, printError)                      |
| `cli/utils/connection.js`  | Config resolution, YangService creation                       |
| `src/index.ts`             | TypeScript SDK — YangService class, error classes, interfaces |
| `index.js`                 | CJS entry point re-export                                     |
| `main.mjs`                 | ESM entry point re-export                                     |
| `cli/commands/config.js`   | Device config management subcommands                          |
| `cli/commands/doctor.js`   | Health check command                                          |
| `cli/commands/get.js`      | GET YANG path command                                         |
| `cli/commands/set.js`      | SET (PATCH/PUT) YANG path command                             |
| `cli/commands/delete.js`   | DELETE YANG path command                                      |
| `cli/commands/exec.js`     | Execute IOS-XE CLI via RESTCONF RPC                           |
| `cli/commands/models.js`   | List/search YANG models on device                             |
| `cli/commands/describe.js` | Show YANG model structure                                     |
| `cli/commands/voice.js`    | Curated voice troubleshooting shortcuts                       |
| `test/tests.js`            | Test runner                                                   |

---

**Note:** `cli/utils/template.js` (template/variable substitution for bulk operations) is listed in the spec but deferred to a future release. The core troubleshooting use case does not require it.

---

### Task 1: Project Scaffolding

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `bin/cisco-yang.js`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "cisco-yang",
  "version": "1.0.0",
  "description": "CLI and SDK for IOS-XE devices via RESTCONF",
  "main": "dist/index.js",
  "module": "main.mjs",
  "types": "dist/index.d.ts",
  "bin": {
    "cisco-yang": "./bin/cisco-yang.js"
  },
  "exports": {
    ".": {
      "require": "./dist/index.js",
      "import": "./main.mjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "node ./test/tests.js",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "axios": "^1.7.9",
    "commander": "^14.0.3",
    "cli-table3": "^0.6.5",
    "csv-stringify": "^6.7.0",
    "@toon-format/toon": "^2.1.0",
    "update-notifier": "^7.3.1"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "@types/node": "^22.10.5"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "commonjs",
    "lib": ["ES2018"],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create bin/cisco-yang.js**

```javascript
#!/usr/bin/env node
require("../cli/index.js");
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated

- [ ] **Step 6: Make bin executable**

Run: `chmod +x bin/cisco-yang.js`

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json bin/cisco-yang.js .gitignore package-lock.json
git commit -m "feat: project scaffolding with package.json, tsconfig, and bin entry"
```

---

### Task 2: Output Formatters

**Files:**

- Create: `cli/formatters/json.js`
- Create: `cli/formatters/csv.js`
- Create: `cli/formatters/table.js`
- Create: `cli/formatters/toon.js`

These are direct ports from cisco-axl with no modifications needed.

- [ ] **Step 1: Create cli/formatters/json.js**

```javascript
"use strict";

function formatJson(data) {
  return JSON.stringify(data, null, 2);
}

module.exports = { formatJson };
```

- [ ] **Step 2: Create cli/formatters/csv.js**

```javascript
"use strict";

const { stringify } = require("csv-stringify/sync");

function formatCsv(data) {
  const rows = Array.isArray(data) ? data : [data];
  return stringify(rows, { header: true });
}

module.exports = { formatCsv };
```

- [ ] **Step 3: Create cli/formatters/table.js**

```javascript
"use strict";

const Table = require("cli-table3");

function toDisplayString(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function formatTable(data) {
  if (Array.isArray(data) && data.length === 0) {
    return "No results found";
  }

  if (Array.isArray(data)) {
    const keys = Object.keys(data[0]);
    const table = new Table({ head: keys });

    for (const row of data) {
      table.push(keys.map((k) => toDisplayString(row[k])));
    }

    const count = data.length;
    const footer = new Table();
    footer.push([{ colSpan: keys.length, content: `${count} results found` }]);

    return table.toString() + "\n" + footer.toString();
  }

  const table = new Table();
  for (const [key, val] of Object.entries(data)) {
    table.push({ [key]: toDisplayString(val) });
  }
  return table.toString();
}

module.exports = { formatTable };
```

- [ ] **Step 4: Create cli/formatters/toon.js**

```javascript
"use strict";

async function formatToon(data) {
  const { encode } = await import("@toon-format/toon");
  return encode(data);
}

module.exports = { formatToon };
```

- [ ] **Step 5: Verify formatters load without error**

Run: `node -e "require('./cli/formatters/json.js'); require('./cli/formatters/csv.js'); require('./cli/formatters/table.js'); require('./cli/formatters/toon.js'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add cli/formatters/
git commit -m "feat: add output formatters (json, csv, table, toon)"
```

---

### Task 3: Utility Modules (Part 1 — No External Dependencies)

**Files:**

- Create: `cli/utils/wordlist.js`
- Create: `cli/utils/stdin.js`
- Create: `cli/utils/confirm.js`
- Create: `cli/utils/readonly.js`

- [ ] **Step 1: Create cli/utils/wordlist.js**

```javascript
const crypto = require("crypto");

function getRandomWord() {
  return crypto.randomBytes(4).toString("hex");
}

module.exports = { getRandomWord };
```

- [ ] **Step 2: Create cli/utils/stdin.js**

```javascript
"use strict";

function readStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      return resolve(null);
    }
    const chunks = [];
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", reject);
  });
}

module.exports = { readStdin };
```

- [ ] **Step 3: Create cli/utils/confirm.js**

```javascript
const readline = require("readline");
const { getRandomWord } = require("./wordlist.js");

function checkWriteAllowed(deviceConfig, globalOpts = {}) {
  const readOnly = deviceConfig?.readOnly || globalOpts.readOnly;
  if (!readOnly) return Promise.resolve(true);

  if (!process.stdin.isTTY) {
    throw new Error(
      "This device is configured as read-only. " +
        "Interactive TTY required for write confirmation. " +
        "Change config with: cisco-yang config add <name> (without --read-only)",
    );
  }

  const word = getRandomWord();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise((resolve, reject) => {
    rl.question(
      `\n⚠ This device is configured as read-only.\nTo proceed, type "${word}" to confirm: `,
      (answer) => {
        rl.close();
        if (answer.trim().toLowerCase() === word.toLowerCase()) {
          resolve({ confirmed: true, word });
        } else {
          reject(new Error("Confirmation failed. Write operation cancelled."));
        }
      },
    );
  });
}

module.exports = { checkWriteAllowed };
```

- [ ] **Step 4: Create cli/utils/readonly.js**

```javascript
"use strict";

const { checkWriteAllowed } = require("./confirm.js");

async function enforceReadOnly(globalOpts, operation) {
  const { getActiveDevice } = require("./config.js");
  const device = getActiveDevice(globalOpts.device);
  const deviceConfig = device || {};

  const config = {
    readOnly: globalOpts.readOnly || deviceConfig.readOnly || false,
  };

  await checkWriteAllowed(config, globalOpts);
}

module.exports = { enforceReadOnly };
```

- [ ] **Step 5: Verify modules load**

Run: `node -e "require('./cli/utils/wordlist.js'); require('./cli/utils/stdin.js'); require('./cli/utils/confirm.js'); console.log('OK')"`
Expected: `OK`

Note: `readonly.js` cannot be verified yet — it has a deferred require of `config.js` which is created in Task 4.

- [ ] **Step 6: Commit**

```bash
git add cli/utils/wordlist.js cli/utils/stdin.js cli/utils/confirm.js cli/utils/readonly.js
git commit -m "feat: add utility modules (wordlist, stdin, confirm, readonly)"
```

---

### Task 4: Config and Audit Utilities

**Files:**

- Create: `cli/utils/config.js`
- Create: `cli/utils/audit.js`
- Create: `cli/utils/output.js`

- [ ] **Step 1: Create cli/utils/config.js**

```javascript
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

const SS_PLACEHOLDER_RE = /<ss:\d+:[^>]+>/;

function getConfigDir() {
  return (
    process.env.CISCO_YANG_CONFIG_DIR ||
    path.join(require("node:os").homedir(), ".cisco-yang")
  );
}

function getConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

function loadConfig() {
  const cfgPath = getConfigPath();
  if (!fs.existsSync(cfgPath)) {
    return { activeDevice: null, devices: {} };
  }
  try {
    const raw = fs.readFileSync(cfgPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to load config from ${cfgPath}: ${err.message}`);
  }
}

function saveConfig(config) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const cfgPath = getConfigPath();
  const json = JSON.stringify(config, null, 2);
  fs.writeFileSync(cfgPath, json, { mode: 0o600, encoding: "utf8" });
}

function addDevice(name, opts) {
  const { host, username, password, insecure } = opts;

  const config = loadConfig();

  const entry = { host, username, password };
  if (insecure !== undefined) {
    entry.insecure = insecure;
  }

  config.devices[name] = entry;

  if (
    config.activeDevice === null ||
    Object.keys(config.devices).length === 1
  ) {
    config.activeDevice = name;
  }

  saveConfig(config);
  return config;
}

function useDevice(name) {
  const config = loadConfig();
  if (!config.devices[name]) {
    throw new Error(`Device "${name}" not found`);
  }
  config.activeDevice = name;
  saveConfig(config);
  return config;
}

function removeDevice(name) {
  const config = loadConfig();
  if (!config.devices[name]) {
    throw new Error(`Device "${name}" not found`);
  }

  const wasActive = config.activeDevice === name;
  delete config.devices[name];

  if (wasActive) {
    const remaining = Object.keys(config.devices);
    config.activeDevice = remaining.length > 0 ? remaining[0] : null;
  }

  saveConfig(config);
  return config;
}

function getActiveDevice(deviceName) {
  const config = loadConfig();

  if (deviceName) {
    const device = config.devices[deviceName];
    if (!device) return null;
    return { name: deviceName, ...device };
  }

  const activeName = config.activeDevice;
  if (!activeName || !config.devices[activeName]) {
    return null;
  }

  return { name: activeName, ...config.devices[activeName] };
}

function listDevices() {
  return loadConfig();
}

function maskPassword(password) {
  if (!password) return password;
  if (SS_PLACEHOLDER_RE.test(password)) return password;
  return "*".repeat(password.length);
}

function hasSsPlaceholders(obj) {
  for (const value of Object.values(obj)) {
    if (typeof value === "string" && SS_PLACEHOLDER_RE.test(value)) {
      return true;
    }
    if (value !== null && typeof value === "object") {
      if (hasSsPlaceholders(value)) return true;
    }
  }
  return false;
}

async function resolveSsPlaceholders(obj) {
  if (!hasSsPlaceholders(obj)) {
    return obj;
  }

  const resolved = { ...obj };

  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string") {
      const match = value.match(/<ss:(\d+):([^>]+)>/);
      if (match) {
        const [, id, field] = match;
        resolved[key] = await resolveSsValue(id, field);
      }
    } else if (value !== null && typeof value === "object") {
      resolved[key] = await resolveSsPlaceholders(value);
    }
  }

  return resolved;
}

function resolveSsValue(id, field) {
  return new Promise((resolve, reject) => {
    execFile(
      "ss-cli",
      ["get", id, "--format", "json"],
      (err, stdout, stderr) => {
        if (err) {
          if (err.code === "ENOENT" || (stderr && /not found/i.test(stderr))) {
            return reject(
              new Error(
                "ss-cli is not installed or not in PATH. " +
                  "Please install ss-cli to resolve Secret Server placeholders. " +
                  `Original error: ${err.message}`,
              ),
            );
          }
          return reject(
            new Error(`ss-cli failed for secret ${id}: ${err.message}`),
          );
        }

        try {
          const data = JSON.parse(stdout);
          const fieldLower = field.toLowerCase();

          const foundKey = Object.keys(data).find(
            (k) => k.toLowerCase() === fieldLower,
          );
          if (foundKey !== undefined) {
            return resolve(data[foundKey]);
          }

          if (Array.isArray(data.items)) {
            const item = data.items.find(
              (i) =>
                (i.slug && i.slug.toLowerCase() === fieldLower) ||
                (i.fieldName && i.fieldName.toLowerCase() === fieldLower),
            );
            if (item) {
              return resolve(item.itemValue);
            }
          }

          return reject(
            new Error(`Field "${field}" not found in secret ${id}`),
          );
        } catch (parseErr) {
          reject(
            new Error(
              `Failed to parse ss-cli output for secret ${id}: ${parseErr.message}`,
            ),
          );
        }
      },
    );
  });
}

module.exports = {
  loadConfig,
  saveConfig,
  addDevice,
  useDevice,
  removeDevice,
  getActiveDevice,
  listDevices,
  maskPassword,
  getConfigDir,
  getConfigPath,
  hasSsPlaceholders,
  resolveSsPlaceholders,
};
```

- [ ] **Step 2: Create cli/utils/audit.js**

```javascript
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const AUDIT_FILE = "audit.jsonl";
const ROTATION_THRESHOLD = 10 * 1024 * 1024;

const REDACTED_FIELDS = new Set([
  "password",
  "username",
  "user",
  "pass",
  "secret",
  "token",
  "auth",
]);

function getConfigDir() {
  return (
    process.env.CISCO_YANG_CONFIG_DIR || path.join(os.homedir(), ".cisco-yang")
  );
}

function sanitize(entry) {
  if (!entry || typeof entry !== "object") return {};
  const safe = {};
  for (const [key, val] of Object.entries(entry)) {
    if (!REDACTED_FIELDS.has(key.toLowerCase())) {
      safe[key] = val;
    }
  }
  return safe;
}

async function logAudit(entry) {
  try {
    const safe = sanitize(entry);
    const record = { timestamp: new Date().toISOString(), ...safe };
    const line = JSON.stringify(record) + "\n";

    const dir = getConfigDir();
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, AUDIT_FILE);
    fs.appendFileSync(filePath, line, "utf8");
  } catch {
    // Fire-and-forget
  }
}

async function rotateAuditLog() {
  try {
    const dir = getConfigDir();
    const filePath = path.join(dir, AUDIT_FILE);

    if (!fs.existsSync(filePath)) return;

    const stat = fs.statSync(filePath);
    if (stat.size <= ROTATION_THRESHOLD) return;

    const rotatedPath = path.join(dir, AUDIT_FILE + ".1");
    if (fs.existsSync(rotatedPath)) {
      fs.unlinkSync(rotatedPath);
    }
    fs.renameSync(filePath, rotatedPath);
    fs.writeFileSync(filePath, "", "utf8");
  } catch {
    // Fire-and-forget
  }
}

module.exports = { logAudit, rotateAuditLog };
```

- [ ] **Step 3: Create cli/utils/output.js**

```javascript
"use strict";

const { formatJson } = require("../formatters/json.js");
const { formatCsv } = require("../formatters/csv.js");
const { formatTable } = require("../formatters/table.js");
const { formatToon } = require("../formatters/toon.js");

async function printResult(data, format = "table") {
  let output;

  switch (format) {
    case "json":
      output = formatJson(data);
      break;
    case "csv":
      output = formatCsv(data);
      break;
    case "toon":
      output = await formatToon(data);
      break;
    case "table":
    default:
      output = formatTable(data);
      break;
  }

  process.stdout.write(output + "\n");
}

function printError(err) {
  const message = err instanceof Error ? err.message : String(err);

  process.stderr.write(`Error: ${message}\n`);

  if (message.includes("Authentication failed") || message.includes("401")) {
    process.stderr.write(
      `Hint: Run "cisco-yang config test" to verify your credentials.\n`,
    );
  } else if (message.includes("ECONNREFUSED")) {
    process.stderr.write(
      `Hint: Check that the device is reachable and RESTCONF is enabled.\n`,
    );
  } else if (message.includes("certificate")) {
    process.stderr.write(
      `Hint: Try adding --insecure to skip TLS verification.\n`,
    );
  }

  process.exitCode = 1;
}

module.exports = { printResult, printError };
```

- [ ] **Step 4: Verify all utils load (including readonly.js from Task 3)**

Run: `node -e "require('./cli/utils/config.js'); require('./cli/utils/audit.js'); require('./cli/utils/output.js'); require('./cli/utils/readonly.js'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add cli/utils/config.js cli/utils/audit.js cli/utils/output.js
git commit -m "feat: add config, audit, and output utilities"
```

---

### Task 5: TypeScript SDK — YangService

**Files:**

- Create: `src/index.ts`
- Create: `index.js`
- Create: `main.mjs`

- [ ] **Step 1: Create src/index.ts**

```typescript
import axios, { AxiosInstance, AxiosError } from "axios";
import * as https from "https";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface YangServiceOptions {
  insecure?: boolean;
  timeout?: number;
  baseUrl?: string;
  logging?: { level?: string };
}

interface YangModel {
  name: string;
  revision: string;
  namespace: string;
  features?: string[];
}

interface ExecResult {
  output: string;
}

// ─── Error Classes ───────────────────────────────────────────────────────────

class YangError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YangError";
  }
}

class YangAuthError extends YangError {
  constructor(
    message: string = "Authentication failed. Check username and password.",
  ) {
    super(message);
    this.name = "YangAuthError";
  }
}

class YangNotFoundError extends YangError {
  constructor(message: string = "Resource not found.") {
    super(message);
    this.name = "YangNotFoundError";
  }
}

class YangConnectionError extends YangError {
  constructor(message: string = "Connection failed.") {
    super(message);
    this.name = "YangConnectionError";
  }
}

class YangRequestError extends YangError {
  statusCode: number;
  restconfError?: object;

  constructor(message: string, statusCode: number, restconfError?: object) {
    super(message);
    this.name = "YangRequestError";
    this.statusCode = statusCode;
    this.restconfError = restconfError;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanObj(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj))
    return obj
      .map(cleanObj)
      .filter((v: any) => v !== null && v !== undefined && v !== "");
  if (typeof obj !== "object") return obj;
  const cleaned: any = {};
  for (const [key, val] of Object.entries(obj)) {
    const v = cleanObj(val);
    if (v !== null && v !== undefined && v !== "") {
      if (
        typeof v === "object" &&
        !Array.isArray(v) &&
        Object.keys(v).length === 0
      )
        continue;
      cleaned[key] = v;
    }
  }
  return cleaned;
}

function unwrapEnvelope(data: any): any {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const keys = Object.keys(data);
  if (keys.length === 1) {
    const key = keys[0];
    // Unwrap "Module:container" pattern
    if (key.includes(":")) {
      return data[key];
    }
  }
  return data;
}

// ─── YangService ─────────────────────────────────────────────────────────────

class YangService {
  private client: AxiosInstance;
  private host: string;
  private debug: boolean;

  constructor(
    host: string,
    username: string,
    password: string,
    opts: YangServiceOptions = {},
  ) {
    this.host = host;
    this.debug = opts.logging?.level === "debug";

    const baseURL = opts.baseUrl || `https://${host}`;

    const httpsAgent = new https.Agent({
      rejectUnauthorized: !opts.insecure,
    });

    this.client = axios.create({
      baseURL,
      auth: { username, password },
      headers: {
        Accept: "application/yang-data+json",
        "Content-Type": "application/yang-data+json",
      },
      httpsAgent,
      timeout: opts.timeout || 30000,
    });
  }

  private log(message: string, data?: any): void {
    if (!this.debug) return;
    if (data) {
      console.log(`[YANG DEBUG] ${message}`, data);
    } else {
      console.log(`[YANG DEBUG] ${message}`);
    }
  }

  private handleError(err: AxiosError): never {
    if (err.response) {
      const status = err.response.status;
      const body = err.response.data as any;
      const restconfError =
        body?.errors?.error?.[0] || body?.["ietf-restconf:errors"]?.error?.[0];
      const errorMsg =
        restconfError?.["error-message"] ||
        restconfError?.["error-tag"] ||
        err.message;

      if (status === 401 || status === 403) {
        throw new YangAuthError(
          `Authentication failed (${status}): ${errorMsg}`,
        );
      }
      if (status === 404) {
        throw new YangNotFoundError(`Resource not found: ${errorMsg}`);
      }
      throw new YangRequestError(
        `RESTCONF error (${status}): ${errorMsg}`,
        status,
        restconfError,
      );
    }

    if (
      err.code === "ECONNREFUSED" ||
      err.code === "ENOTFOUND" ||
      err.code === "ETIMEDOUT"
    ) {
      throw new YangConnectionError(
        `Connection failed to ${this.host}: ${err.message}`,
      );
    }

    if (
      err.message?.includes("certificate") ||
      err.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
    ) {
      throw new YangConnectionError(
        `TLS certificate error for ${this.host}: ${err.message}. Try --insecure.`,
      );
    }

    throw new YangError(err.message);
  }

  async testConnection(): Promise<any> {
    try {
      this.log("Testing connection", { host: this.host });
      const res = await this.client.get("/restconf");
      return res.data;
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async get(path: string, opts: { clean?: boolean } = {}): Promise<any> {
    try {
      this.log("GET", { path });
      const res = await this.client.get(`/restconf/data/${path}`);
      let data = unwrapEnvelope(res.data);
      if (opts.clean) data = cleanObj(data);
      return data;
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async set(
    path: string,
    data: any,
    method: "patch" | "put" = "patch",
  ): Promise<any> {
    try {
      this.log(`${method.toUpperCase()}`, { path, data });
      const res =
        method === "put"
          ? await this.client.put(`/restconf/data/${path}`, data)
          : await this.client.patch(`/restconf/data/${path}`, data);
      return res.data || { status: "success" };
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async delete(path: string): Promise<any> {
    try {
      this.log("DELETE", { path });
      const res = await this.client.delete(`/restconf/data/${path}`);
      return res.data || { status: "deleted" };
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async exec(command: string): Promise<ExecResult> {
    try {
      this.log("EXEC", { command });
      const res = await this.client.post(
        "/restconf/operations/Cisco-IOS-XE-rpc:exec",
        { input: { args: command } },
      );
      const output =
        res.data?.["Cisco-IOS-XE-rpc:output"]?.result ||
        res.data?.output?.result ||
        "";
      return { output };
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async getModels(filter?: string): Promise<YangModel[]> {
    try {
      this.log("GET models", { filter });
      const res = await this.client.get(
        "/restconf/data/ietf-yang-library:modules-state",
      );
      const data = res.data;
      const modules = data?.["ietf-yang-library:modules-state"]?.module || [];

      let models: YangModel[] = modules.map((m: any) => ({
        name: m.name,
        revision: m.revision || "",
        namespace: m.namespace || "",
        features: m.feature || [],
      }));

      if (filter) {
        const lowerFilter = filter.toLowerCase();
        models = models.filter(
          (m: YangModel) =>
            m.name.toLowerCase().includes(lowerFilter) ||
            m.namespace.toLowerCase().includes(lowerFilter),
        );
      }

      return models.sort((a: YangModel, b: YangModel) =>
        a.name.localeCompare(b.name),
      );
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async describeModel(moduleName: string): Promise<any> {
    try {
      this.log("DESCRIBE", { moduleName });
      // Try to GET the module root and inspect the response structure
      const res = await this.client.get(`/restconf/data/${moduleName}:`);
      return unwrapEnvelope(res.data);
    } catch (err) {
      // If 404, try without trailing colon
      if ((err as AxiosError).response?.status === 404) {
        try {
          const res = await this.client.get(`/restconf/data/${moduleName}`);
          return unwrapEnvelope(res.data);
        } catch (innerErr) {
          this.handleError(innerErr as AxiosError);
        }
      }
      this.handleError(err as AxiosError);
    }
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

// Attach error classes as static properties for CJS consumers
(YangService as any).YangError = YangError;
(YangService as any).YangAuthError = YangAuthError;
(YangService as any).YangNotFoundError = YangNotFoundError;
(YangService as any).YangConnectionError = YangConnectionError;
(YangService as any).YangRequestError = YangRequestError;

export default YangService;
export { YangService, YangServiceOptions, YangModel, ExecResult };
export {
  YangError,
  YangAuthError,
  YangNotFoundError,
  YangConnectionError,
  YangRequestError,
};
```

- [ ] **Step 2: Build TypeScript**

Run: `npm run build`
Expected: `dist/index.js` and `dist/index.d.ts` created successfully

- [ ] **Step 3: Create index.js (CJS entry)**

```javascript
module.exports =
  require("./dist/index.js").default || require("./dist/index.js");
```

- [ ] **Step 4: Create main.mjs (ESM entry)**

```javascript
import YangService from "./dist/index.js";
export default YangService;
export const {
  YangError,
  YangAuthError,
  YangNotFoundError,
  YangConnectionError,
  YangRequestError,
} = YangService;
```

- [ ] **Step 5: Verify SDK loads**

Run: `node -e "const YangService = require('./index.js'); console.log(typeof YangService); console.log('OK')"`
Expected: `function` then `OK`

- [ ] **Step 6: Commit**

```bash
git add src/index.ts dist/ index.js main.mjs
git commit -m "feat: add YangService SDK with RESTCONF client and error classes"
```

---

### Task 6: Connection Utility

**Files:**

- Create: `cli/utils/connection.js`

- [ ] **Step 1: Create cli/utils/connection.js**

```javascript
"use strict";

const {
  getActiveDevice,
  hasSsPlaceholders,
  resolveSsPlaceholders,
} = require("./config.js");

async function resolveConfig(flags = {}) {
  // Layer 1: config file (lowest priority)
  let cfgHost, cfgUsername, cfgPassword, cfgInsecure;

  const deviceName = flags.device || undefined;
  const device = getActiveDevice(deviceName);

  if (deviceName && !device) {
    throw new Error(`Device "${deviceName}" not found`);
  }

  if (device) {
    cfgHost = device.host;
    cfgUsername = device.username;
    cfgPassword = device.password;
    cfgInsecure = device.insecure;
  }

  // Layer 2: environment variables
  const envHost = process.env.CISCO_YANG_HOST;
  const envUsername = process.env.CISCO_YANG_USERNAME;
  const envPassword = process.env.CISCO_YANG_PASSWORD;

  // Layer 3: CLI flags (highest priority)
  const flagHost = flags.host;
  const flagUsername = flags.username;
  const flagPassword = flags.password;
  const flagInsecure = flags.insecure;

  // Merge: flags > env > config
  const host = flagHost || envHost || cfgHost;
  const username = flagUsername || envUsername || cfgUsername;
  const password = flagPassword || envPassword || cfgPassword;

  // insecure: flag overrides config
  const insecure = flagInsecure !== undefined ? flagInsecure : cfgInsecure;

  // Validate required fields
  if (!host) {
    throw new Error(
      "No device host configured. Provide --host, set CISCO_YANG_HOST, or add a device with: cisco-yang config add",
    );
  }
  if (!username) {
    throw new Error(
      "No username configured. Provide --username, set CISCO_YANG_USERNAME, or add a device with: cisco-yang config add",
    );
  }
  if (!password) {
    throw new Error(
      "No password configured. Provide --password, set CISCO_YANG_PASSWORD, or add a device with: cisco-yang config add",
    );
  }

  const result = { host, username, password };
  if (insecure !== undefined) {
    result.insecure = insecure;
  }

  // Resolve Secret Server placeholders if present
  if (hasSsPlaceholders(result)) {
    return resolveSsPlaceholders(result);
  }

  return result;
}

async function createService(flags = {}) {
  const config = await resolveConfig(flags);

  // Handle --insecure flag
  if (config.insecure || flags.insecure) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    process.emitWarning = ((orig) =>
      function (warning, ...args) {
        if (
          typeof warning === "string" &&
          warning.includes("NODE_TLS_REJECT_UNAUTHORIZED")
        )
          return;
        return orig.call(process, warning, ...args);
      })(process.emitWarning);
  }

  const opts = { insecure: config.insecure };
  if (flags.debug) {
    opts.logging = { level: "debug" };
  }

  const YangService =
    require("../../dist/index.js").default || require("../../dist/index.js");
  return new YangService(config.host, config.username, config.password, opts);
}

module.exports = {
  resolveConfig,
  createService,
};
```

- [ ] **Step 2: Verify connection module loads**

Run: `node -e "require('./cli/utils/connection.js'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add cli/utils/connection.js
git commit -m "feat: add connection utility with config resolution"
```

---

### Task 7: CLI Index and Config Command

**Files:**

- Create: `cli/index.js`
- Create: `cli/commands/config.js`

- [ ] **Step 1: Create cli/index.js**

```javascript
"use strict";

const { Command } = require("commander");
const pkg = require("../package.json");

// Suppress Node.js TLS warning when --insecure is used
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  if (
    typeof warning === "string" &&
    warning.includes("NODE_TLS_REJECT_UNAUTHORIZED")
  )
    return;
  originalEmitWarning.call(process, warning, ...args);
};

try {
  const updateNotifier =
    require("update-notifier").default || require("update-notifier");
  updateNotifier({ pkg }).notify();
} catch {}

const program = new Command();

program
  .name("cisco-yang")
  .description("CLI for IOS-XE devices via RESTCONF")
  .version(pkg.version)
  .option("--format <type>", "output format: table, json, toon, csv", "table")
  .option("--host <host>", "device hostname (overrides config/env)")
  .option("--username <user>", "device username (overrides config/env)")
  .option("--password <pass>", "device password (overrides config/env)")
  .option("--device <name>", "use a specific named device from config")
  .option("--clean", "remove empty/null values from results")
  .option("--insecure", "skip TLS certificate verification")
  .option("--no-audit", "disable audit logging for this command")
  .option("--read-only", "restrict to read-only operations")
  .option("--debug", "enable debug logging");

// Register commands
require("./commands/config.js")(program);
require("./commands/get.js")(program);
require("./commands/set.js")(program);
require("./commands/delete.js")(program);
require("./commands/exec.js")(program);
require("./commands/models.js")(program);
require("./commands/describe.js")(program);
require("./commands/voice.js")(program);
require("./commands/doctor.js")(program);

program.parse();
```

- [ ] **Step 2: Create stub files for commands not yet implemented**

Create these 8 stub files so `cli/index.js` can load without crashing. Each stub exports a no-op function that will be replaced in Tasks 8-11:

```javascript
// cli/commands/get.js, set.js, delete.js, exec.js, models.js, describe.js, voice.js, doctor.js
module.exports = function (program) {};
```

Create all 8 files with identical content.

- [ ] **Step 3: Create cli/commands/config.js**

```javascript
"use strict";

const configUtil = require("../utils/config.js");
const { printResult, printError } = require("../utils/output.js");
const { createService } = require("../utils/connection.js");

module.exports = function registerConfigCommand(program) {
  const config = program
    .command("config")
    .description("Manage IOS-XE device configuration");

  // config add <name>
  config
    .command("add <name>")
    .description(
      "Add a named device to config (use --host, --username, --password)",
    )
    .option("--insecure", "skip TLS verification for this device")
    .action((name, opts, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const host = globalOpts.host;
        const username = globalOpts.username;
        const password = globalOpts.password;
        if (!host) throw new Error("Missing required option: --host");
        if (!username) throw new Error("Missing required option: --username");
        if (!password) throw new Error("Missing required option: --password");

        const deviceOpts = { host, username, password };
        if (opts.insecure || globalOpts.insecure) {
          deviceOpts.insecure = true;
        }

        configUtil.addDevice(name, deviceOpts);
        process.stdout.write(`Device "${name}" added successfully.\n`);
      } catch (err) {
        printError(err);
      }
    });

  // config use <name>
  config
    .command("use <name>")
    .description("Set a named device as the active device")
    .action((name) => {
      try {
        configUtil.useDevice(name);
        process.stdout.write(`Device "${name}" is now the active device.\n`);
      } catch (err) {
        printError(err);
      }
    });

  // config list
  config
    .command("list")
    .description("List all configured devices")
    .action(async () => {
      try {
        const { activeDevice, devices } = configUtil.listDevices();
        const rows = Object.entries(devices).map(([name, device]) => ({
          name,
          active: name === activeDevice ? "\u2713" : "",
          host: device.host,
          username: device.username,
        }));
        const format = program.opts().format;
        await printResult(rows, format);
      } catch (err) {
        printError(err);
      }
    });

  // config show
  config
    .command("show")
    .description("Show the active device configuration")
    .action(async () => {
      try {
        const deviceName = program.opts().device;
        const device = configUtil.getActiveDevice(deviceName);
        if (!device) {
          printError(
            new Error(
              "No active device configured. Run: cisco-yang config add",
            ),
          );
          return;
        }
        const display = {
          ...device,
          password: configUtil.maskPassword(device.password),
        };
        const format = program.opts().format;
        await printResult(display, format);
      } catch (err) {
        printError(err);
      }
    });

  // config remove <name>
  config
    .command("remove <name>")
    .description("Remove a named device from config")
    .action((name) => {
      try {
        configUtil.removeDevice(name);
        process.stdout.write(`Device "${name}" removed successfully.\n`);
      } catch (err) {
        printError(err);
      }
    });

  // config test
  config
    .command("test")
    .description("Test connectivity to the active device")
    .action(async () => {
      try {
        const flags = program.opts();
        const service = await createService(flags);
        await service.testConnection();

        const deviceName =
          flags.device || configUtil.getActiveDevice()?.name || "unknown";
        const device = configUtil.getActiveDevice(flags.device);
        const host = device ? device.host : flags.host || "unknown";

        process.stdout.write(
          `Connection to ${deviceName} (${host}) successful — RESTCONF is available\n`,
        );
      } catch (err) {
        printError(err);
      }
    });
};
```

- [ ] **Step 4: Verify CLI loads**

Run: `node bin/cisco-yang.js --help`
Expected: Shows help with all commands listed (stubs are registered)

- [ ] **Step 5: Commit**

```bash
git add cli/index.js cli/commands/
git commit -m "feat: add CLI index with global flags, config command, and command stubs"
```

---

### Task 8: RESTCONF Commands — get, set, delete

**Files:**

- Create: `cli/commands/get.js`
- Create: `cli/commands/set.js`
- Create: `cli/commands/delete.js`

- [ ] **Step 1: Create cli/commands/get.js**

```javascript
"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

module.exports = function registerGetCommand(program) {
  program
    .command("get <path>")
    .description("GET a YANG resource at the given RESTCONF path")
    .action(async (yangPath, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        const service = await createService(globalOpts);
        const opts = { clean: globalOpts.clean || false };
        const result = await service.get(yangPath, opts);
        const format = globalOpts.format;
        await printResult(result, format);
      } catch (err) {
        status = "error";
        errorMsg = err.message;
        printError(err);
      } finally {
        if (globalOpts.audit !== false) {
          const { logAudit } = require("../utils/audit.js");
          const { getActiveDevice } = require("../utils/config.js");
          const deviceName =
            getActiveDevice(globalOpts.device)?.name || "env/flags";
          const entry = {
            device: deviceName,
            operation: "get",
            path: yangPath,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
```

- [ ] **Step 2: Create cli/commands/set.js**

```javascript
"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const { enforceReadOnly } = require("../utils/readonly.js");
const { readStdin } = require("../utils/stdin.js");

module.exports = function registerSetCommand(program) {
  program
    .command("set <path>")
    .description("PATCH (or PUT with --method put) data at a YANG path")
    .option("--data <json>", "JSON payload (inline)")
    .option("--stdin", "read JSON payload from stdin")
    .option("--method <method>", "HTTP method: patch or put", "patch")
    .action(async (yangPath, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        await enforceReadOnly(globalOpts, "set");

        let jsonData = cmdOpts.data;
        if (cmdOpts.stdin) {
          const stdinData = await readStdin();
          if (stdinData) jsonData = stdinData.trim();
        }

        if (!jsonData) {
          throw new Error("No data provided. Use --data '{...}' or --stdin");
        }

        const data = JSON.parse(jsonData);
        const service = await createService(globalOpts);
        const result = await service.set(yangPath, data, cmdOpts.method);
        const format = globalOpts.format;
        await printResult(result, format);
      } catch (err) {
        status = "error";
        errorMsg = err.message;
        printError(err);
      } finally {
        if (globalOpts.audit !== false) {
          const { logAudit } = require("../utils/audit.js");
          const { getActiveDevice } = require("../utils/config.js");
          const deviceName =
            getActiveDevice(globalOpts.device)?.name || "env/flags";
          const entry = {
            device: deviceName,
            operation: "set",
            path: yangPath,
            method: cmdOpts.method,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
```

- [ ] **Step 3: Create cli/commands/delete.js**

```javascript
"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const { enforceReadOnly } = require("../utils/readonly.js");

module.exports = function registerDeleteCommand(program) {
  program
    .command("delete <path>")
    .description("DELETE a YANG resource at the given RESTCONF path")
    .action(async (yangPath, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        await enforceReadOnly(globalOpts, "delete");

        const service = await createService(globalOpts);
        const result = await service.delete(yangPath);
        const format = globalOpts.format;
        await printResult(result, format);
      } catch (err) {
        status = "error";
        errorMsg = err.message;
        printError(err);
      } finally {
        if (globalOpts.audit !== false) {
          const { logAudit } = require("../utils/audit.js");
          const { getActiveDevice } = require("../utils/config.js");
          const deviceName =
            getActiveDevice(globalOpts.device)?.name || "env/flags";
          const entry = {
            device: deviceName,
            operation: "delete",
            path: yangPath,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
```

- [ ] **Step 4: Commit**

```bash
git add cli/commands/get.js cli/commands/set.js cli/commands/delete.js
git commit -m "feat: add get, set, and delete RESTCONF commands"
```

---

### Task 9: Exec, Models, and Describe Commands

**Files:**

- Create: `cli/commands/exec.js`
- Create: `cli/commands/models.js`
- Create: `cli/commands/describe.js`

- [ ] **Step 1: Create cli/commands/exec.js**

```javascript
"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const { enforceReadOnly } = require("../utils/readonly.js");

// Commands that are read-only (show, display, etc.)
const READ_ONLY_PREFIXES = ["show ", "display "];

function isReadOnlyCommand(command) {
  const lower = command.trim().toLowerCase();
  return READ_ONLY_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

module.exports = function registerExecCommand(program) {
  program
    .command("exec <command>")
    .description("Execute an IOS-XE CLI command via RESTCONF RPC")
    .action(async (command, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        // Only enforce read-only for non-show commands
        if (!isReadOnlyCommand(command)) {
          await enforceReadOnly(globalOpts, "exec");
        }

        const service = await createService(globalOpts);
        const result = await service.exec(command);

        // For exec, output is plain text — print directly unless JSON format requested
        const format = globalOpts.format;
        if (format === "json") {
          await printResult(result, format);
        } else {
          process.stdout.write(result.output + "\n");
        }
      } catch (err) {
        status = "error";
        errorMsg = err.message;
        printError(err);
      } finally {
        if (globalOpts.audit !== false) {
          const { logAudit } = require("../utils/audit.js");
          const { getActiveDevice } = require("../utils/config.js");
          const deviceName =
            getActiveDevice(globalOpts.device)?.name || "env/flags";
          const entry = {
            device: deviceName,
            operation: "exec",
            command,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
```

- [ ] **Step 2: Create cli/commands/models.js**

```javascript
"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

module.exports = function registerModelsCommand(program) {
  program
    .command("models")
    .description("List YANG models available on the device")
    .option("--filter <text>", "filter models by name or namespace")
    .action(async (cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        const service = await createService(globalOpts);
        const models = await service.getModels(cmdOpts.filter);
        const format = globalOpts.format;
        await printResult(models, format);
      } catch (err) {
        status = "error";
        errorMsg = err.message;
        printError(err);
      } finally {
        if (globalOpts.audit !== false) {
          const { logAudit } = require("../utils/audit.js");
          const { getActiveDevice } = require("../utils/config.js");
          const deviceName =
            getActiveDevice(globalOpts.device)?.name || "env/flags";
          const entry = {
            device: deviceName,
            operation: "models",
            filter: cmdOpts.filter || null,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
```

- [ ] **Step 3: Create cli/commands/describe.js**

```javascript
"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

module.exports = function registerDescribeCommand(program) {
  program
    .command("describe <model>")
    .description("Show the structure of a YANG model by querying the device")
    .action(async (model, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        const service = await createService(globalOpts);
        const result = await service.describeModel(model);
        const format = globalOpts.format;
        await printResult(result, format);
      } catch (err) {
        status = "error";
        errorMsg = err.message;
        printError(err);
      } finally {
        if (globalOpts.audit !== false) {
          const { logAudit } = require("../utils/audit.js");
          const { getActiveDevice } = require("../utils/config.js");
          const deviceName =
            getActiveDevice(globalOpts.device)?.name || "env/flags";
          const entry = {
            device: deviceName,
            operation: "describe",
            model,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
```

- [ ] **Step 4: Commit**

```bash
git add cli/commands/exec.js cli/commands/models.js cli/commands/describe.js
git commit -m "feat: add exec, models, and describe commands"
```

---

### Task 10: Voice Shortcuts Command

**Files:**

- Create: `cli/commands/voice.js`

- [ ] **Step 1: Create cli/commands/voice.js**

```javascript
"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

// YANG-based shortcuts (use GET)
const YANG_SHORTCUTS = {
  "dial-peers": "Cisco-IOS-XE-native:native/dial-peer",
  registrations: "Cisco-IOS-XE-voice-register-oper:voice-register-oper-data",
  sip: "Cisco-IOS-XE-native:native/voice",
  calls: "Cisco-IOS-XE-voice-oper:voice-oper-data",
  dsp: "Cisco-IOS-XE-voice-oper:voice-oper-data/voice-recording-port",
  stats: "Cisco-IOS-XE-voice-call-history-oper:voice-call-history",
};

// Exec-based shortcuts (use RPC exec)
const EXEC_SHORTCUTS = {
  "trace sip": "show sip-ua calls",
  "trace history": "show voice call history detail",
  "trace rtp": "show voip rtp connections",
};

module.exports = function registerVoiceCommand(program) {
  const voice = program
    .command("voice")
    .description("Voice troubleshooting shortcuts");

  // Register YANG-based subcommands
  for (const [name, yangPath] of Object.entries(YANG_SHORTCUTS)) {
    voice
      .command(name)
      .description(`GET ${yangPath}`)
      .action(async (cmdOpts) => {
        const startTime = Date.now();
        const globalOpts = program.opts();
        let status = "success";
        let errorMsg;

        try {
          const service = await createService(globalOpts);
          const opts = { clean: globalOpts.clean || false };
          const result = await service.get(yangPath, opts);
          const format = globalOpts.format;
          await printResult(result, format);
        } catch (err) {
          status = "error";
          errorMsg = err.message;
          printError(err);
        } finally {
          if (globalOpts.audit !== false) {
            const { logAudit } = require("../utils/audit.js");
            const { getActiveDevice } = require("../utils/config.js");
            const deviceName =
              getActiveDevice(globalOpts.device)?.name || "env/flags";
            const entry = {
              device: deviceName,
              operation: `voice ${name}`,
              path: yangPath,
              duration_ms: Date.now() - startTime,
              status,
            };
            if (errorMsg) entry.error = errorMsg;
            logAudit(entry);
          }
        }
      });
  }

  // Register trace subcommand group
  const trace = voice
    .command("trace")
    .description("Voice trace shortcuts (uses exec RPC)");

  // trace sip, trace history, trace rtp
  for (const [fullName, execCmd] of Object.entries(EXEC_SHORTCUTS)) {
    const subName = fullName.replace("trace ", "");
    trace
      .command(subName)
      .description(`exec "${execCmd}"`)
      .action(async (cmdOpts) => {
        const startTime = Date.now();
        const globalOpts = program.opts();
        let status = "success";
        let errorMsg;

        try {
          const service = await createService(globalOpts);
          const result = await service.exec(execCmd);

          const format = globalOpts.format;
          if (format === "json") {
            await printResult(result, format);
          } else {
            process.stdout.write(result.output + "\n");
          }
        } catch (err) {
          status = "error";
          errorMsg = err.message;
          printError(err);
        } finally {
          if (globalOpts.audit !== false) {
            const { logAudit } = require("../utils/audit.js");
            const { getActiveDevice } = require("../utils/config.js");
            const deviceName =
              getActiveDevice(globalOpts.device)?.name || "env/flags";
            const entry = {
              device: deviceName,
              operation: `voice ${fullName}`,
              command: execCmd,
              duration_ms: Date.now() - startTime,
              status,
            };
            if (errorMsg) entry.error = errorMsg;
            logAudit(entry);
          }
        }
      });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add cli/commands/voice.js
git commit -m "feat: add voice troubleshooting shortcuts command"
```

---

### Task 11: Doctor Command

**Files:**

- Create: `cli/commands/doctor.js`

- [ ] **Step 1: Create cli/commands/doctor.js**

```javascript
"use strict";

const {
  loadConfig,
  getConfigPath,
  getConfigDir,
} = require("../utils/config.js");
const { resolveConfig } = require("../utils/connection.js");

module.exports = function registerDoctorCommand(program) {
  program
    .command("doctor")
    .description("Check RESTCONF connectivity and configuration health")
    .action(async (opts, command) => {
      const globalOpts = command.optsWithGlobals();
      let passed = 0;
      let warned = 0;
      let failed = 0;

      const ok = (msg) => {
        console.log(`  ✓ ${msg}`);
        passed++;
      };
      const warn = (msg) => {
        console.log(`  ⚠ ${msg}`);
        warned++;
      };
      const fail = (msg) => {
        console.log(`  ✗ ${msg}`);
        failed++;
      };

      console.log("\n  cisco-yang doctor");
      console.log("  " + "─".repeat(50));

      // 1. Configuration
      console.log("\n  Configuration");
      let conn;
      try {
        const data = loadConfig();
        if (!data.activeDevice) {
          fail("No active device configured");
          console.log(
            "    Run: cisco-yang config add <name> --host <host> --username <user> --password <pass>",
          );
          printSummary(passed, warned, failed);
          return;
        }
        ok(`Active device: ${data.activeDevice}`);
        const device = data.devices[data.activeDevice];
        ok(`Host: ${device.host}`);
        ok(`Username: ${device.username}`);

        if (device.insecure) warn("TLS verification: disabled (--insecure)");
        else ok("TLS verification: enabled");

        conn = await resolveConfig(globalOpts);
      } catch (err) {
        fail(`Config error: ${err.message}`);
        printSummary(passed, warned, failed);
        return;
      }

      // 2. RESTCONF connectivity
      console.log("\n  RESTCONF API");
      try {
        if (conn.insecure) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }
        const YangService =
          require("../../dist/index.js").default ||
          require("../../dist/index.js");
        const service = new YangService(
          conn.host,
          conn.username,
          conn.password,
          { insecure: conn.insecure },
        );

        await service.testConnection();
        ok("RESTCONF API: connected");

        // Check YANG model count
        try {
          const models = await service.getModels();
          ok(`YANG models: ${models.length} available`);

          const voiceModels = models.filter((m) =>
            m.name.toLowerCase().includes("voice"),
          );
          if (voiceModels.length > 0) {
            ok(`Voice models: ${voiceModels.length} found`);
          } else {
            warn("Voice models: none found — device may not support voice");
          }
        } catch {
          warn("Could not list YANG models");
        }

        // Check exec RPC availability
        try {
          await service.exec("show version | include Version");
          ok("Exec RPC: available (Cisco-IOS-XE-rpc:exec)");
        } catch {
          warn("Exec RPC: not available — requires IOS-XE 16.5+");
        }
      } catch (err) {
        const msg = err.message || String(err);
        if (
          msg.includes("401") ||
          msg.includes("Authentication") ||
          msg.includes("Unauthorized")
        ) {
          fail("RESTCONF API: authentication failed — check username/password");
        } else if (msg.includes("ECONNREFUSED")) {
          fail(
            "RESTCONF API: connection refused — check host and verify RESTCONF is enabled",
          );
        } else if (msg.includes("ENOTFOUND")) {
          fail("RESTCONF API: hostname not found — check host");
        } else if (msg.includes("certificate")) {
          fail(
            "RESTCONF API: TLS certificate error — try adding --insecure to the device config",
          );
        } else {
          fail(`RESTCONF API: ${msg}`);
        }
      }

      // 3. Security
      console.log("\n  Security");
      try {
        const fs = require("node:fs");
        const configPath = getConfigPath();
        const stats = fs.statSync(configPath);
        const mode = (stats.mode & 0o777).toString(8);
        if (mode === "600") ok(`Config file permissions: ${mode} (secure)`);
        else
          warn(
            `Config file permissions: ${mode} — should be 600. Run: chmod 600 ${configPath}`,
          );
      } catch {
        /* config file may not exist yet */
      }

      // 4. Audit trail
      try {
        const fs = require("node:fs");
        const path = require("node:path");
        const auditPath = path.join(getConfigDir(), "audit.jsonl");
        if (fs.existsSync(auditPath)) {
          const stats = fs.statSync(auditPath);
          const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
          ok(`Audit trail: ${sizeMB}MB`);
          if (stats.size > 8 * 1024 * 1024)
            warn("Audit trail approaching 10MB rotation limit");
        } else {
          ok("Audit trail: empty (no operations logged yet)");
        }
      } catch {
        /* ignore */
      }

      printSummary(passed, warned, failed);
    });

  function printSummary(passed, warned, failed) {
    console.log("\n  " + "─".repeat(50));
    console.log(
      `  Results: ${passed} passed, ${warned} warning${warned !== 1 ? "s" : ""}, ${failed} failed`,
    );
    if (failed > 0) {
      process.exitCode = 1;
      console.log("  Status:  issues found — review failures above");
    } else if (warned > 0) {
      console.log("  Status:  healthy with warnings");
    } else {
      console.log("  Status:  all systems healthy");
    }
    console.log("");
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add cli/commands/doctor.js
git commit -m "feat: add doctor health check command"
```

---

### Task 12: End-to-End Verification

**Files:**

- Create: `test/tests.js`

- [ ] **Step 1: Create test/tests.js**

A basic smoke test that verifies the CLI loads and commands are registered.

```javascript
"use strict";

const { execFileSync } = require("node:child_process");
const path = require("node:path");
const assert = require("node:assert");

const BIN = path.join(__dirname, "..", "bin", "cisco-yang.js");

function run(args) {
  return execFileSync("node", [BIN, ...args], {
    encoding: "utf-8",
    timeout: 10000,
  });
}

// Test: --help shows all commands
console.log("Test: --help lists all commands");
const help = run(["--help"]);
assert(help.includes("get"), "should list get command");
assert(help.includes("set"), "should list set command");
assert(help.includes("delete"), "should list delete command");
assert(help.includes("exec"), "should list exec command");
assert(help.includes("models"), "should list models command");
assert(help.includes("describe"), "should list describe command");
assert(help.includes("voice"), "should list voice command");
assert(help.includes("doctor"), "should list doctor command");
assert(help.includes("config"), "should list config command");
console.log("  PASS");

// Test: --version
console.log("Test: --version shows version");
const version = run(["--version"]);
assert(version.trim() === "1.0.0", `expected 1.0.0, got ${version.trim()}`);
console.log("  PASS");

// Test: config list with no config
console.log("Test: config list with empty config");
const listOutput = run(["config", "list"]);
assert(listOutput.includes("No results found"), "should show no results");
console.log("  PASS");

// Test: voice --help
console.log("Test: voice --help lists subcommands");
const voiceHelp = run(["voice", "--help"]);
assert(voiceHelp.includes("dial-peers"), "should list dial-peers");
assert(voiceHelp.includes("registrations"), "should list registrations");
assert(voiceHelp.includes("sip"), "should list sip");
assert(voiceHelp.includes("trace"), "should list trace");
console.log("  PASS");

// Test: SDK loads
console.log("Test: SDK loads and exports YangService");
const YangService = require("../index.js");
assert(typeof YangService === "function", "should export constructor");
console.log("  PASS");

console.log("\nAll tests passed.");
```

- [ ] **Step 2: Set CISCO_YANG_CONFIG_DIR for test isolation**

Run: `CISCO_YANG_CONFIG_DIR=/tmp/cisco-yang-test npm test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add test/tests.js
git commit -m "feat: add smoke tests for CLI and SDK"
```

---

### Task 13: Link CLI Globally and Live Test

- [ ] **Step 1: Link the CLI globally**

Run: `npm link`
Expected: `cisco-yang` command is now available globally

- [ ] **Step 2: Test help output**

Run: `cisco-yang --help`
Expected: Shows all commands and global flags

- [ ] **Step 3: Test config add with the vcube device from spec**

Run: `cisco-yang config add vcube --host vcube.automate.builders --username admin --password h0mel@b --insecure`
Expected: `Device "vcube" added successfully.`

- [ ] **Step 4: Test doctor against the live device**

Run: `cisco-yang doctor`
Expected: Shows configuration checks, RESTCONF connectivity, voice model count

- [ ] **Step 5: Test a YANG GET**

Run: `cisco-yang get "Cisco-IOS-XE-native:native/dial-peer" --format json`
Expected: JSON output of dial-peer configuration

- [ ] **Step 6: Test exec**

Run: `cisco-yang exec "show version" --format json`
Expected: JSON with device version info

- [ ] **Step 7: Test voice shortcut**

Run: `cisco-yang voice dial-peers`
Expected: Table output of dial-peers

- [ ] **Step 8: Commit any fixes from live testing**

```bash
git add -A
git commit -m "fix: adjustments from live device testing"
```

---

### Task 14: Claude Code Skill File

**Files:**

- Create: `skills/cisco-yang-cli/SKILL.md`

- [ ] **Step 1: Create skills/cisco-yang-cli/SKILL.md**

````markdown
---
name: cisco-yang-cli
description: Use when managing IOS-XE devices via the cisco-yang CLI — RESTCONF queries, voice troubleshooting, dial-peer management, SIP trace, device health checks, and any YANG/RESTCONF operation on voice gateways (CUBE, ISR, CSR, Cat8k).
---

# cisco-yang CLI

CLI and SDK for IOS-XE devices via RESTCONF (HTTP/JSON). Focused on voice troubleshooting.

## Setup

The user must first configure a device:

```bash
cisco-yang config add <name> --host <host> --username <user> --password <pass> [--insecure]
cisco-yang doctor   # verify connectivity
```
````

## Common Operations

### Query any YANG path

```bash
cisco-yang get "Cisco-IOS-XE-native:native/dial-peer"
cisco-yang get "Cisco-IOS-XE-native:native/voice" --format json
```

### Execute IOS-XE CLI commands

```bash
cisco-yang exec "show dial-peer voice summary"
cisco-yang exec "show sip-ua calls"
cisco-yang exec "show voice call history detail"
cisco-yang exec "show voip rtp connections"
cisco-yang exec "show voice port summary"
```

### Voice troubleshooting shortcuts

```bash
cisco-yang voice dial-peers       # dial-peer config
cisco-yang voice registrations    # SIP phone registrations
cisco-yang voice sip              # voice service/SIP config
cisco-yang voice calls            # active calls
cisco-yang voice dsp              # DSP utilization
cisco-yang voice stats            # call history
cisco-yang voice trace sip        # exec: show sip-ua calls
cisco-yang voice trace history    # exec: show voice call history detail
cisco-yang voice trace rtp        # exec: show voip rtp connections
```

### Discover YANG models

```bash
cisco-yang models --filter voice
cisco-yang describe Cisco-IOS-XE-voice-register-oper
```

### Modify configuration

```bash
cisco-yang set "Cisco-IOS-XE-native:native/voice" --data '{"voice":{"service":{"voip":{"sip":{}}}}}'
cisco-yang delete "Cisco-IOS-XE-native:native/dial-peer/dial-peer-voip/100"
```

## Troubleshooting Workflows

| Scenario          | Commands                                                        |
| ----------------- | --------------------------------------------------------------- |
| Calls not routing | `voice dial-peers` then `exec "show dial-peer voice summary"`   |
| One-way audio     | `exec "show voip rtp connections"` — check codec/IP/port        |
| SIP trunk down    | `voice registrations` then `exec "show sip-ua register status"` |
| Quality issues    | `exec "show voice call history detail"` — check MOS/jitter/loss |
| Gateway health    | `doctor` then `voice dsp` then `exec "show voice port summary"` |

## Output Formats

`--format table` (default), `--format json`, `--format csv`, `--format toon`

## Tips

- Use `--clean` to strip null/empty values from output
- Use `--insecure` for devices with self-signed certificates
- Use `--debug` to see raw HTTP requests/responses
- `voice trace *` commands return CLI text; other voice commands return structured JSON
- The `exec` command can run any IOS-XE CLI command via RESTCONF RPC
- Write operations (`set`, `delete`, non-show `exec`) are blocked in `--read-only` mode

````

- [ ] **Step 2: Commit**

```bash
git add skills/
git commit -m "feat: add cisco-yang-cli Claude Code skill"
````

---

### Task 15: Update UC Engineer Skill

- [ ] **Step 1: Find and update the cisco-uc-engineer skill**

Locate the cisco-uc-engineer skill file (likely in `~/.claude/` or a skills directory) and add cisco-yang to its list of orchestrated tools. Add a section describing when to use cisco-yang:

> Use `cisco-yang` for IOS-XE voice gateway troubleshooting — dial-peer status, SIP traces, voice registrations, DSP utilization, and device health checks via RESTCONF.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: integrate cisco-yang into cisco-uc-engineer skill"
```
