"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { getConfigDir } = require("../utils/config.js");
const { printResult, printError } = require("../utils/output.js");

module.exports = function registerAuditCommand(program) {
  program
    .command("audit")
    .description("Show recent entries from the local audit log")
    .option("-n, --count <n>", "number of entries to show (default 20)")
    .option("--device <name>", "only show entries for this device")
    .option(
      "--status <status>",
      "only show entries with this status (success/error)",
    )
    .action(async (cmdOpts) => {
      try {
        const filePath = path.join(getConfigDir(), "audit.jsonl");
        const format = program.opts().format;

        if (!fs.existsSync(filePath)) {
          await printResult([], format);
          return;
        }

        let entries = fs
          .readFileSync(filePath, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        if (cmdOpts.device) {
          entries = entries.filter((e) => e.device === cmdOpts.device);
        }
        if (cmdOpts.status) {
          entries = entries.filter((e) => e.status === cmdOpts.status);
        }

        const count = parseInt(cmdOpts.count, 10) || 20;
        entries = entries.slice(-count).reverse();

        if (format !== "json" && format !== "csv") {
          // Errors can be long, multi-line ss-cli/RESTCONF messages —
          // collapse and truncate for a readable table (full text is
          // still available via --format json/csv).
          entries = entries.map((e) => {
            if (typeof e.error !== "string") return e;
            const oneLine = e.error.replace(/\s*\n\s*/g, " ").trim();
            const short =
              oneLine.length > 100 ? oneLine.slice(0, 97) + "..." : oneLine;
            return { ...e, error: short };
          });
        }

        await printResult(entries, format);
      } catch (err) {
        printError(err);
      }
    });
};
