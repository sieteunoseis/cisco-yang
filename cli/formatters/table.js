"use strict";

const Table = require("cli-table3");

/**
 * Flatten a nested object into dot-notation keys.
 * { ip: { address: { primary: { address: "1.2.3.4" } } } }
 * → { "ip.address.primary.address": "1.2.3.4" }
 *
 * Arrays of primitives become comma-separated strings.
 * Arrays of objects are left as "[N items]" summaries.
 */
function flattenObj(obj, prefix = "", result = {}) {
  if (obj === null || obj === undefined) return result;
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val === null || val === undefined) {
      result[fullKey] = "";
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        result[fullKey] = "";
      } else if (typeof val[0] !== "object" || val[0] === null) {
        result[fullKey] = val.join(", ");
      } else {
        result[fullKey] = `[${val.length} items]`;
      }
    } else if (typeof val === "object") {
      flattenObj(val, fullKey, result);
    } else {
      result[fullKey] = String(val);
    }
  }
  return result;
}

/**
 * Strip a common YANG module prefix from column names for readability.
 * "Cisco-IOS-XE-ethernet:negotiation.auto" → "negotiation.auto"
 */
function stripYangPrefix(key) {
  // Strip YANG module prefixes anywhere in the key
  // "Cisco-IOS-XE-multicast:sparse-mode" → "sparse-mode"
  // "ip.Cisco-IOS-XE-ospf:router-ospf.process-id" → "ip.process-id"
  return key.replace(/[A-Za-z0-9-]+:/g, "");
}

/**
 * Shorten dot-notation keys to friendlier column headers.
 * Prefers the leaf (last segment) but falls back to more segments on collision.
 * "clock.source.line.line-mode" → "line-mode"
 * "pri-group.timeslots" → "timeslots"
 */
function shortenKeys(fullKeys) {
  const stripped = fullKeys.map(stripYangPrefix);
  const shortNames = stripped.map((k) => {
    const parts = k.split(".");
    return parts[parts.length - 1];
  });

  // Resolve collisions by progressively prepending parent segments
  const counts = {};
  for (const s of shortNames) counts[s] = (counts[s] || 0) + 1;

  return stripped.map((k, i) => {
    if (counts[shortNames[i]] <= 1) return shortNames[i];
    // collision — use last two segments
    const parts = k.split(".");
    return parts.length >= 2
      ? parts.slice(-2).join(".")
      : parts[parts.length - 1];
  });
}

/**
 * Try to unwrap a YANG-style object into a flat array of rows.
 * YANG responses often look like { "TypeName": [ {row}, {row} ] }
 */
function tryUnwrapToArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return null;

  const keys = Object.keys(data);
  if (keys.length === 1 && Array.isArray(data[keys[0]])) {
    const arr = data[keys[0]];
    if (arr.length > 0 && typeof arr[0] === "object" && arr[0] !== null) {
      return arr;
    }
  }

  return null;
}

function formatArrayTable(rows) {
  // Flatten each row and collect all unique keys
  const flatRows = rows.map((row) => flattenObj(row));
  const keySet = new Set();
  for (const flat of flatRows) {
    for (const k of Object.keys(flat)) keySet.add(k);
  }
  const keys = [...keySet];
  const shortKeys = shortenKeys(keys);

  const table = new Table({ head: shortKeys, wordWrap: true });

  for (const flat of flatRows) {
    table.push(keys.map((k) => (flat[k] !== undefined ? flat[k] : "")));
  }

  const footer = new Table();
  footer.push([
    { colSpan: keys.length || 1, content: `${rows.length} results found` },
  ]);

  return table.toString() + "\n" + footer.toString();
}

function formatTable(data) {
  // Plain primitive (string, number, boolean) — just display it
  if (data !== null && data !== undefined && typeof data !== "object") {
    return String(data);
  }

  if (Array.isArray(data) && data.length === 0) {
    return "No results found";
  }

  // Array of objects → flatten and show horizontal table
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
    return formatArrayTable(data);
  }

  // Array of primitives
  if (Array.isArray(data)) {
    const table = new Table({ head: ["value"] });
    for (const item of data) {
      table.push([item === null || item === undefined ? "" : String(item)]);
    }
    return table.toString();
  }

  // Object — try to unwrap YANG-style { "Type": [{...}, {...}] }
  const unwrapped = tryUnwrapToArray(data);
  if (unwrapped) {
    return formatArrayTable(unwrapped);
  }

  // Plain object → flatten and show vertical key-value table
  const flat = flattenObj(data);
  const table = new Table({ wordWrap: true });
  for (const [key, val] of Object.entries(flat)) {
    table.push({ [stripYangPrefix(key).split(".").pop()]: val });
  }
  return table.toString();
}

module.exports = { formatTable };
