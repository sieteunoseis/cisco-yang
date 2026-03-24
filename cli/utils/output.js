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
