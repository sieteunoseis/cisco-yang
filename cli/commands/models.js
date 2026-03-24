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
