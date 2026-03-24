# Cisco YANG Library & CLI

[![npm version](https://img.shields.io/npm/v/cisco-yang.svg)](https://www.npmjs.com/package/cisco-yang)
[![CI](https://github.com/sieteunoseis/cisco-yang/actions/workflows/release.yml/badge.svg)](https://github.com/sieteunoseis/cisco-yang/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/cisco-yang.svg)](https://nodejs.org)
[![Skills](https://img.shields.io/badge/skills.sh-cisco--yang--cli-blue)](https://skills.sh/sieteunoseis/cisco-yang)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-orange?logo=buy-me-a-coffee)](https://buymeacoffee.com/automatebldrs)

A JavaScript library and CLI to interact with Cisco IOS-XE devices via RESTCONF (HTTP/JSON). Dynamically discovers YANG models and RPC operations on the device — works with any IOS-XE platform (CUBE, ISR, Cat8k, CSR).

Focused on voice gateway troubleshooting: dial-peers, SIP configuration, voice registrations, and device health checks.

RESTCONF information can be found at:
[Cisco IOS-XE Programmability Configuration Guide](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/prog/configuration/1712/b_1712_programmability_cg/restconf.html).

## Installation

```bash
npm install cisco-yang
```

### Global CLI install

```bash
npm install -g cisco-yang
```

Or run without installing:

```bash
npx cisco-yang --help
```

### AI Agent Skills

```bash
npx skills add sieteunoseis/cisco-yang
```

## Requirements

If you are using self-signed certificates on IOS-XE devices you may need to disable TLS verification, or use the `--insecure` CLI flag.

RESTCONF must be enabled on the device:

```
conf t
restconf
ip http secure-server
```

## Quick Start

```bash
# Configure a device
cisco-yang config add myrouter --host 10.0.0.1 --username admin --password secret --insecure

# Test the connection
cisco-yang config test

# Run the health check
cisco-yang doctor

# Get hostname
cisco-yang get "Cisco-IOS-XE-native:native/hostname"

# Get interfaces (flattened table)
cisco-yang get "Cisco-IOS-XE-native:native/interface/GigabitEthernet"

# List all YANG models
cisco-yang models --filter voice

# List available RPC operations
cisco-yang operations
```

## Configuration

```bash
cisco-yang config add <name> --host <host> --username <user> --password <pass> [--insecure]
cisco-yang config use <name>       # switch active device
cisco-yang config list             # list all devices
cisco-yang config show             # show active device (masks passwords)
cisco-yang config remove <name>    # remove a device
cisco-yang config test             # test RESTCONF connectivity
```

Auth precedence: CLI flags > env vars (`CISCO_YANG_HOST`, `CISCO_YANG_USERNAME`, `CISCO_YANG_PASSWORD`) > config file.

Config stored at `~/.cisco-yang/config.json`. Supports [ss-cli](https://github.com/sieteunoseis/ss-cli) `<ss:ID:field>` placeholders.

## CLI Commands

| Command            | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `get <path>`       | GET a YANG resource at the given RESTCONF path         |
| `set <path>`       | PATCH (or PUT with `--method put`) data at a YANG path |
| `delete <path>`    | DELETE a YANG resource                                 |
| `rpc <operation>`  | Invoke a RESTCONF RPC operation                        |
| `models`           | List YANG models available on the device               |
| `operations`       | List available RESTCONF RPC operations                 |
| `describe <model>` | Show the structure of a YANG model                     |
| `voice <shortcut>` | Voice troubleshooting shortcuts                        |
| `doctor`           | Check RESTCONF connectivity and device health          |
| `config`           | Manage device configurations                           |

## Voice Shortcuts

Convenience commands for common voice troubleshooting queries:

```bash
cisco-yang voice dial-peers       # Dial-peer configuration
cisco-yang voice sip              # Voice service / SIP configuration
cisco-yang voice sip-ua           # SIP user-agent configuration
cisco-yang voice interfaces       # Interface configuration (check voice bindings)
```

## Global Flags

| Flag                              | Description                            |
| --------------------------------- | -------------------------------------- |
| `--format table\|json\|toon\|csv` | Output format (default: table)         |
| `--insecure`                      | Skip TLS certificate verification      |
| `--clean`                         | Remove empty/null values from results  |
| `--read-only`                     | Restrict to read-only operations       |
| `--no-audit`                      | Disable audit logging for this command |
| `--debug`                         | Enable debug logging                   |

## Library API

```javascript
const YangService = require("cisco-yang");
const service = new YangService("10.10.20.48", "admin", "password", {
  insecure: true,
});

// RESTCONF operations
await service.get("Cisco-IOS-XE-native:native/hostname");
await service.get("Cisco-IOS-XE-native:native/interface/GigabitEthernet");
await service.set(
  "Cisco-IOS-XE-native:native/interface/Loopback=99",
  data,
  "put",
);
await service.delete("Cisco-IOS-XE-native:native/interface/Loopback=99");

// Discovery
await service.getModels("voice");
await service.getOperations();
await service.describeModel("Cisco-IOS-XE-voice");

// RPC
await service.rpc("cisco-ia:sync-from");
await service.rpc("Cisco-IOS-XE-rpc:reload", { input: {} });

// Connection test
await service.testConnection();
```

### Error Classes

```javascript
const {
  YangError,
  YangAuthError,
  YangNotFoundError,
  YangConnectionError,
  YangRequestError,
} = require("cisco-yang");

try {
  await service.get("invalid/path");
} catch (err) {
  if (err instanceof YangNotFoundError) {
    console.log("Path not found on device");
  } else if (err instanceof YangAuthError) {
    console.log("Check credentials");
  }
}
```

## Platform Compatibility

| Platform           | Config (YANG) |        Voice Config         | Voice Oper (live calls) |
| ------------------ | :-----------: | :-------------------------: | :---------------------: |
| ISR4k (physical)   |       ✓       |              ✓              |            ✓            |
| Cat8kv (virtual)   |       ✓       | ✓ (17.12+ with DNA license) |            ✗            |
| CSR1000v (virtual) |       ✓       |           partial           |            ✗            |

> **Note:** The `Cisco-IOS-XE-voice-oper` YANG model (active call monitoring, call history, DSP stats) is only available on physical ISR4k platforms. Virtual platforms expose the config models but not operational voice data.

## Giving Back

If you found this helpful, consider:

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/automatebldrs)

## License

MIT
