"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

module.exports = function registerOperationsCommand(program) {
  program
    .command("operations")
    .description("List available RESTCONF RPC operations on the device")
    .option("--filter <text>", "filter operations by name")
    .action(async (cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        const service = await createService(globalOpts);
        const ops = await service.getOperations();

        let rows = Object.entries(ops).map(([name, path]) => ({
          operation: name,
          path,
        }));

        if (cmdOpts.filter) {
          const lowerFilter = cmdOpts.filter.toLowerCase();
          rows = rows.filter((r) =>
            r.operation.toLowerCase().includes(lowerFilter),
          );
        }

        rows.sort((a, b) => a.operation.localeCompare(b.operation));

        const format = globalOpts.format;
        await printResult(rows, format);
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
            operation: "operations",
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
