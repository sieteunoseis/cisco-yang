# cisco-yang CLI — Design Spec

## Overview

A Node.js CLI and SDK for querying and configuring IOS-XE devices via RESTCONF (HTTP/JSON). Follows the cisco-axl architectural pattern: commander-based CLI, multi-device config, dynamic YANG model discovery, four output formatters, audit logging, and a reusable library.

**Target:** Any IOS-XE device with RESTCONF enabled (CUBE, ISR, CSR, Cat8k, etc.), focused on voice troubleshooting.

**Protocol:** RESTCONF only (HTTP/JSON). No NETCONF.

## Stack

- `commander` — CLI framework
- `axios` — HTTP client for RESTCONF
- `cli-table3` — table output
- `csv-stringify` — CSV output
- `@toon-format/toon` — TUI formatting
- `update-notifier` — update checks

## Project Structure

```
cisco-yang/
├── bin/cisco-yang.js              # Entry point (shebang)
├── cli/
│   ├── index.js                   # Commander setup, global flags, command registration
│   ├── commands/
│   │   ├── config.js              # Device config management (add/use/list/show/remove/test)
│   │   ├── get.js                 # GET any YANG path
│   │   ├── set.js                 # PUT/PATCH data at a YANG path
│   │   ├── delete.js              # DELETE a YANG resource
│   │   ├── models.js              # Discover/search YANG models on device
│   │   ├── describe.js            # Show model structure/tree
│   │   ├── exec.js                # Run IOS-XE CLI via RESTCONF RPC
│   │   ├── voice.js               # Curated voice troubleshooting shortcuts
│   │   └── doctor.js              # Health check (connectivity + RESTCONF availability)
│   ├── formatters/
│   │   ├── table.js               # ASCII table (cli-table3)
│   │   ├── json.js                # Pretty-printed JSON
│   │   ├── csv.js                 # CSV (csv-stringify)
│   │   └── toon.js                # TUI formatting (@toon-format/toon)
│   └── utils/
│       ├── connection.js          # Resolve config, create YangService instance
│       ├── config.js              # ~/.cisco-yang/config.json management, Secret Server resolution
│       ├── output.js              # printResult(data, format), printError(err)
│       ├── audit.js               # JSONL audit logging with rotation, credential sanitization
│       ├── readonly.js            # --read-only enforcement with TTY confirmation
│       ├── confirm.js             # TTY-based confirmation prompts
│       ├── wordlist.js            # Random word list for confirmation prompts
│       ├── stdin.js               # Read piped JSON from stdin
│       └── template.js            # Template/variable substitution for bulk operations
├── src/
│   └── index.ts                   # TypeScript SDK source
├── dist/                          # Compiled JavaScript (from tsc)
├── index.js                       # Main library entry (CJS)
├── main.mjs                       # ESM entry
├── package.json
└── tsconfig.json
```

## Commands

### Generic RESTCONF Commands

| Command            | Description                                                | Example                                                   |
| ------------------ | ---------------------------------------------------------- | --------------------------------------------------------- |
| `get <path>`       | GET any YANG path                                          | `cisco-yang get "Cisco-IOS-XE-native:native/dial-peer"`   |
| `set <path>`       | PATCH data at a path (use `--method put` for full replace) | `cisco-yang set "native/voice" --data '{...}'`            |
| `delete <path>`    | DELETE a YANG resource                                     | `cisco-yang delete "native/dial-peer/dial-peer-voip/100"` |
| `exec <command>`   | Run IOS-XE CLI via RESTCONF RPC                            | `cisco-yang exec "show sip-ua calls"`                     |
| `models`           | List all YANG models on device                             | `cisco-yang models --filter voice`                        |
| `describe <model>` | Show structure/tree of a model                             | `cisco-yang describe Cisco-IOS-XE-voice-register-oper`    |
| `config`           | Manage device configs                                      | `cisco-yang config add`, `config use`, etc.               |
| `doctor`           | Test connectivity & RESTCONF                               | `cisco-yang doctor`                                       |

### Curated Voice Shortcuts

Convenience wrappers around common YANG paths and exec commands for voice troubleshooting.

#### YANG-based (via `get`)

| Subcommand            | YANG Path                                                      | Purpose                    |
| --------------------- | -------------------------------------------------------------- | -------------------------- |
| `voice dial-peers`    | `Cisco-IOS-XE-native:native/dial-peer`                         | List all dial-peers        |
| `voice registrations` | `Cisco-IOS-XE-voice-register-oper:voice-register-oper-data`    | SIP phone registrations    |
| `voice sip`           | `Cisco-IOS-XE-native:native/voice`                             | Voice service / SIP config |
| `voice calls`         | `Cisco-IOS-XE-voice-oper:voice-oper-data`                      | Active calls               |
| `voice dsp`           | `Cisco-IOS-XE-voice-oper:voice-oper-data/voice-recording-port` | DSP utilization            |
| `voice stats`         | `Cisco-IOS-XE-voice-call-history-oper:voice-call-history`      | Call history/stats         |

#### Exec-based (via RESTCONF RPC)

| Subcommand            | Wraps                            | Purpose                    |
| --------------------- | -------------------------------- | -------------------------- |
| `voice trace sip`     | `show sip-ua calls`              | Active SIP call details    |
| `voice trace history` | `show voice call history detail` | Recent call detail records |
| `voice trace rtp`     | `show voip rtp connections`      | RTP stream info            |

### exec Command

Uses the RESTCONF RPC endpoint to run IOS-XE CLI commands:

```
POST /restconf/operations/Cisco-IOS-XE-rpc:exec
Content-Type: application/yang-data+json

{ "input": { "args": "show voice call status" } }
```

Write-capable exec commands (e.g., `debug`) are guarded by `--read-only` mode and require TTY confirmation.

**Minimum IOS-XE version:** 16.5+ required for `Cisco-IOS-XE-rpc:exec`. The `doctor` command checks for RPC availability and warns if unsupported.

### Global Flags

| Flag                | Description                           | Default       |
| ------------------- | ------------------------------------- | ------------- |
| `--format <type>`   | Output format: table, json, csv, toon | table         |
| `--host <host>`     | Override device hostname              | -             |
| `--username <user>` | Override username                     | -             |
| `--password <pass>` | Override password                     | -             |
| `--device <name>`   | Select named device from config       | active device |
| `--insecure`        | Skip TLS certificate verification     | false         |
| `--clean`           | Strip null/empty values from output   | false         |
| `--no-audit`        | Disable audit logging                 | false         |
| `--read-only`       | Block write operations                | false         |
| `--debug`           | Enable debug logging                  | false         |

### set Command Options

| Flag                | Description                                     | Default |
| ------------------- | ----------------------------------------------- | ------- |
| `--data <json>`     | JSON payload (inline)                           | -       |
| `--stdin`           | Read JSON payload from stdin                    | false   |
| `--method <method>` | HTTP method: `patch` (merge) or `put` (replace) | patch   |

## SDK / Library Layer

The CLI is a thin wrapper over a reusable `YangService` class.

### YangService API

```javascript
const { YangService } = require("cisco-yang");

const yang = new YangService(host, username, password, { insecure: true });

// RESTCONF operations
await yang.get(path); // GET YANG path
await yang.set(path, data, method); // PUT or PATCH (method defaults to PATCH)
await yang.delete(path); // DELETE

// Discovery
await yang.getModels(filter); // Query ietf-yang-library:modules-state
await yang.describeModel(module); // Get model structure/tree

// Exec
await yang.exec(command); // POST to Cisco-IOS-XE-rpc:exec

// Connection test
await yang.testConnection(); // GET /restconf (root resource)
```

### HTTP Details

- **Base URLs:**
  - Data: `https://<host>/restconf/data/`
  - Operations: `https://<host>/restconf/operations/`
- **Auth:** Basic HTTP authentication (base64 encoded)
- **Headers:**
  - `Accept: application/yang-data+json`
  - `Content-Type: application/yang-data+json`
- **TLS:** `--insecure` sets `rejectUnauthorized: false` on the HTTPS agent

### Path Handling

- Full module-prefixed paths: `Cisco-IOS-XE-native:native/dial-peer`
- Shorthand paths: `native/dial-peer` — SDK queries `ietf-yang-library:modules-state`, finds the module whose top-level container matches, and prefixes it. If ambiguous, returns an error listing matching modules.
- Response envelope unwrapping: strips the `"Module:container"` wrapper and returns the inner payload. Lists return arrays, containers return objects.

### Response Cleaning

- `--clean` strips null/empty values from response data
- Consistent with cisco-axl behavior

### describe Implementation

The `describe` command works by doing a GET on the module's root path and inspecting the response structure to show available children, their types, and nesting. It does not parse raw YANG files. This gives a practical "what can I query" view rather than a full schema tree.

### TypeScript Interfaces

```typescript
interface YangServiceOptions {
  insecure?: boolean; // skip TLS verification
  timeout?: number; // request timeout in ms (default: 30000)
  baseUrl?: string; // override base URL (default: https://<host>)
}

interface YangModel {
  name: string;
  revision: string;
  namespace: string;
  features?: string[];
}

interface ExecResult {
  output: string; // CLI output text
}
```

### Error Classes

```typescript
class YangError extends Error {} // Base error
class YangAuthError extends YangError {} // 401/403
class YangNotFoundError extends YangError {} // 404 — path not found
class YangConnectionError extends YangError {} // Network/TLS errors
class YangRequestError extends YangError {
  // Other 4xx/5xx
  statusCode: number;
  restconfError?: object; // RESTCONF error body if present
}
```

## Configuration

### Config File

Location: `~/.cisco-yang/config.json` (overridable via `CISCO_YANG_CONFIG_DIR` env var)

```json
{
  "activeDevice": "vcube",
  "devices": {
    "vcube": {
      "host": "vcube.automate.builders",
      "username": "admin",
      "password": "<ss:1234:password>",
      "insecure": true
    },
    "isr-prod": {
      "host": "10.1.1.1",
      "username": "admin",
      "password": "secret"
    }
  }
}
```

### Authentication Precedence (highest to lowest)

1. CLI flags: `--host`, `--username`, `--password`
2. Environment variables: `CISCO_YANG_HOST`, `CISCO_YANG_USERNAME`, `CISCO_YANG_PASSWORD`
3. Config file (active device)

### Secret Server Integration

Passwords containing `<ss:ID:field>` placeholders are resolved via `ss-cli` at runtime.

### Config Subcommands

| Subcommand             | Description                           |
| ---------------------- | ------------------------------------- |
| `config add <name>`    | Add a new device config (interactive) |
| `config use <name>`    | Set the active device                 |
| `config list`          | List all configured devices           |
| `config show [name]`   | Show device config (masks password)   |
| `config remove <name>` | Remove a device config                |
| `config test [name]`   | Test connectivity to a device         |

## Audit Logging

- Location: `~/.cisco-yang/audit.jsonl`
- Format: JSONL (one JSON object per line)
- Fields: timestamp, device, command, path, duration_ms, status
- Credentials are sanitized (never logged)
- 10MB rotation
- Disabled with `--no-audit`

## Skill Integration

### New Skill: `cisco-yang-cli`

A Claude Code skill that teaches the AI how to use `cisco-yang` for IOS-XE/gateway troubleshooting.

Triggers when the user asks about:

- IOS-XE gateway configuration
- Dial-peer troubleshooting
- Voice gateway health
- CUBE/SIP trunk issues
- RESTCONF/YANG operations on voice devices

### UC Engineer Integration

Added to the `cisco-uc-engineer` orchestrator alongside cisco-axl, cisco-dime, cisco-perfmon, cisco-risport, cisco-support, and cisco-ucce.

**Troubleshooting workflows:**

| Scenario          | cisco-yang commands                                             |
| ----------------- | --------------------------------------------------------------- |
| Calls not routing | `voice dial-peers` then `exec "show dial-peer voice summary"`   |
| One-way audio     | `exec "show voip rtp connections"` — check codec/IP/port        |
| SIP trunk down    | `voice registrations` then `exec "show sip-ua register status"` |
| Quality issues    | `exec "show voice call history detail"` — check MOS/jitter/loss |
| Gateway health    | `doctor` then `voice dsp` then `exec "show voice port summary"` |

## Package Specification

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
    "axios": "^1.x",
    "commander": "^14.0.3",
    "cli-table3": "^0.6.5",
    "csv-stringify": "^6.7.0",
    "@toon-format/toon": "^2.1.0",
    "update-notifier": "^7.3.1"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^22.x"
  }
}
```

**Entry points:**

- `index.js` (CJS) — re-exports `dist/index.js` (compiled from `src/index.ts`)
- `main.mjs` (ESM) — re-exports with named exports including error classes

## Design Notes

### Terminology: "devices" not "clusters"

cisco-axl uses "cluster" terminology because CUCM operates as a cluster. This tool uses "device" (`activeDevice`, `devices`, `--device`) because IOS-XE targets are standalone devices. This is intentional — the config/connection utilities are structurally identical but use device-appropriate naming.

### No version flag

Unlike cisco-axl's `--version-cucm` (needed for WSDL schema selection), RESTCONF is version-agnostic. The device self-describes its capabilities via the YANG library. No version parameter is needed.

### Voice command output differences

`voice trace *` subcommands use the `exec` RPC path and return CLI-formatted text. Other `voice` subcommands use direct YANG GET queries and return structured JSON data. The CLI help notes this distinction.
