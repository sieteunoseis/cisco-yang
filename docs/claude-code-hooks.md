# Claude Code Hooks for cisco-yang

[Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) let you enforce guardrails when AI agents use the CLI. The examples below block write operations so Claude can only read from IOS-XE devices.

## Block Write Operations

Add this to your `~/.claude/settings.json` (global) or `.claude/settings.json` (project-level) under `hooks.PreToolUse`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.command' | { read -r cmd; if echo \"$cmd\" | grep -qE '^(npx )?cisco-yang (set|delete|rpc) '; then echo '{\"decision\":\"block\",\"reason\":\"BLOCKED: cisco-yang write operation. Use --read-only or get explicit user approval.\"}'; fi; }"
          }
        ]
      }
    ]
  }
}
```

### What it blocks

| Command                                                        | Blocked | Why                    |
| -------------------------------------------------------------- | ------- | ---------------------- |
| `cisco-yang get Cisco-IOS-XE-native:native/...`                | No      | Read operation         |
| `cisco-yang models --filter voice`                             | No      | Schema discovery       |
| `cisco-yang describe Cisco-IOS-XE-voice`                       | No      | Schema discovery       |
| `cisco-yang doctor`                                            | No      | Health check           |
| `cisco-yang set Cisco-IOS-XE-native:native/... --data '{...}'` | **Yes** | Modifies device config |
| `cisco-yang delete Cisco-IOS-XE-native:native/...`             | **Yes** | Removes device config  |
| `cisco-yang rpc Cisco-IOS-XE-rpc:reboot`                       | **Yes** | Executes device action |

### Alternative: Use the built-in `--read-only` flag

The CLI has a native `--read-only` flag that restricts to read-only operations:

```bash
cisco-yang --read-only set Cisco-IOS-XE-native:native/... --data '{...}'
# Error: Write operations are not allowed in read-only mode
```

You can enforce this globally by adding a hook that requires `--read-only`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.command' | { read -r cmd; if echo \"$cmd\" | grep -qE '^(npx )?cisco-yang ' && ! echo \"$cmd\" | grep -q '\\-\\-read-only'; then echo '{\"decision\":\"block\",\"reason\":\"BLOCKED: cisco-yang must be run with --read-only. Retry with the flag.\"}'; fi; }"
          }
        ]
      }
    ]
  }
}
```

## Audit Logging

All cisco-yang operations are logged to `~/.cisco-yang/audit.jsonl` by default. This provides a record of every command run by Claude or any other agent.
