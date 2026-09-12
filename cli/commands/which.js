"use strict";

const { createService } = require("../utils/connection.js");
const { printError } = require("../utils/output.js");

module.exports = function registerWhichCommand(program) {
  program
    .command("which <name>")
    .description(
      "Check whether <name> is a GET-able data path or an RPC/action, and how to invoke it",
    )
    .action(async (name) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        const service = await createService(globalOpts);
        const [operations, models] = await Promise.all([
          service.getOperations(),
          service.getModels(),
        ]);

        const opKeys = Object.keys(operations || {});
        const modulePart = name.split(":")[0];
        const lowerName = name.toLowerCase();
        const lowerModule = modulePart.toLowerCase();

        const exactOp = opKeys.find((k) => k.toLowerCase() === lowerName);
        const exactModel = (models || []).find(
          (m) => m.name.toLowerCase() === lowerModule,
        );

        if (exactOp) {
          process.stdout.write(`"${exactOp}" is an RPC/action.\n`);
          process.stdout.write(
            `Invoke with: cisco-yang rpc "${exactOp}" [--input '<json>']\n`,
          );
          return;
        }

        if (exactModel) {
          process.stdout.write(
            `"${exactModel.name}" is a YANG data model — its paths are GET-able.\n`,
          );
          process.stdout.write(
            `Invoke with: cisco-yang get "${name}" (or set/delete)\n`,
          );
          process.stdout.write(
            `Run "cisco-yang describe ${exactModel.name}" to see its structure.\n`,
          );
          return;
        }

        const opMatches = opKeys.filter((k) =>
          k.toLowerCase().includes(lowerName),
        );
        const modelMatches = (models || []).filter(
          (m) =>
            m.name.toLowerCase().includes(lowerModule) ||
            m.namespace.toLowerCase().includes(lowerModule),
        );

        if (opMatches.length === 0 && modelMatches.length === 0) {
          process.stdout.write(`No operation or model matches "${name}".\n`);
          process.stdout.write(
            `Try: cisco-yang operations --filter <term>  or  cisco-yang models --filter <term>\n`,
          );
          status = "not_found";
          return;
        }

        if (opMatches.length > 0) {
          process.stdout.write(`Possible RPCs/actions matching "${name}":\n`);
          for (const op of opMatches.slice(0, 15)) {
            process.stdout.write(`  ${op}\n`);
          }
          if (opMatches.length > 15) {
            process.stdout.write(`  ...and ${opMatches.length - 15} more.\n`);
          }
        }

        if (modelMatches.length > 0) {
          process.stdout.write(`Possible data models matching "${name}":\n`);
          for (const m of modelMatches.slice(0, 15)) {
            process.stdout.write(`  ${m.name}\n`);
          }
          if (modelMatches.length > 15) {
            process.stdout.write(
              `  ...and ${modelMatches.length - 15} more.\n`,
            );
          }
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
            operation: "which",
            name,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
