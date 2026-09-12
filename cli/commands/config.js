"use strict";

const configUtil = require("../utils/config.js");
const { printResult, printError } = require("../utils/output.js");
const { createService } = require("../utils/connection.js");

module.exports = function registerConfigCommand(program) {
  const config = program
    .command("config")
    .description("Manage IOS-XE device configuration");

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

  config
    .command("use <name>")
    .description(
      "Set a named device as the active device (matches a unique substring of name/host too)",
    )
    .action((name) => {
      try {
        const { devices } = configUtil.listDevices();
        if (devices[name]) {
          configUtil.useDevice(name);
          process.stdout.write(`Device "${name}" is now the active device.\n`);
          return;
        }

        const matches = configUtil.findDevicesByTerm(name);
        if (matches.length === 0) {
          throw new Error(`Device "${name}" not found`);
        }
        if (matches.length === 1) {
          configUtil.useDevice(matches[0].name);
          process.stdout.write(
            `Device "${matches[0].name}" is now the active device (matched "${name}").\n`,
          );
          return;
        }

        process.stdout.write(`Multiple devices match "${name}":\n`);
        for (const m of matches.slice(0, 20)) {
          process.stdout.write(`  ${m.name} (${m.host})\n`);
        }
        if (matches.length > 20) {
          process.stdout.write(`  ...and ${matches.length - 20} more.\n`);
        }
        process.stdout.write(
          `Run "cisco-yang config use <exact-name>" with one of the names above.\n`,
        );
        process.exitCode = 1;
      } catch (err) {
        printError(err);
      }
    });

  config
    .command("list")
    .description("List configured devices (shows the first 10 by default)")
    .option("--filter <term>", "only show devices matching a name/host substring")
    .option("--all", "show every device, ignoring the default limit")
    .option("--limit <n>", "max number of devices to show (default 10)")
    .action(async (opts) => {
      try {
        const { activeDevice, devices } = configUtil.listDevices();
        let entries = Object.entries(devices).sort(([a], [b]) =>
          a.localeCompare(b),
        );
        const total = entries.length;

        if (opts.filter) {
          const lower = opts.filter.toLowerCase();
          entries = entries.filter(
            ([name, device]) =>
              name.toLowerCase().includes(lower) ||
              (device.host && device.host.toLowerCase().includes(lower)),
          );
        }
        const matched = entries.length;

        const limit = opts.all ? undefined : parseInt(opts.limit, 10) || 10;
        const truncated = limit !== undefined && matched > limit;
        let activeAppended = false;
        if (limit !== undefined) {
          const page = entries.slice(0, limit);
          const activeEntry =
            activeDevice && entries.find(([name]) => name === activeDevice);
          if (activeEntry && !page.includes(activeEntry)) {
            page.push(activeEntry);
            activeAppended = true;
          }
          entries = page;
        }

        const rows = entries.map(([name, device]) => ({
          name,
          active: name === activeDevice ? "\u2713" : "",
          host: device.host,
          username: device.username,
        }));
        const format = program.opts().format;
        await printResult(rows, format);

        if (truncated) {
          const suffix = opts.filter ? ` matching "${opts.filter}"` : "";
          process.stderr.write(
            `\nShowing ${entries.length} of ${matched}${suffix} device(s)` +
              (opts.filter ? "" : ` (${total} total)`) +
              `. Use --all to show everyone, --limit <n> to change, or --filter <term> to narrow down.\n`,
          );
          if (activeAppended) {
            process.stderr.write(
              `(active device "${activeDevice}" appended below the limit so it's always visible)\n`,
            );
          }
        }
      } catch (err) {
        printError(err);
      }
    });

  config
    .command("find <term>")
    .description("Search configured devices by name or host substring")
    .action(async (term) => {
      try {
        const { activeDevice } = configUtil.listDevices();
        const matches = configUtil.findDevicesByTerm(term);
        const rows = matches.map((d) => ({
          name: d.name,
          active: d.name === activeDevice ? "\u2713" : "",
          host: d.host,
          username: d.username,
        }));
        const format = program.opts().format;
        await printResult(rows, format);
      } catch (err) {
        printError(err);
      }
    });

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
