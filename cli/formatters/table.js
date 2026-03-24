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
function shortenKey(key) {
  return key.replace(/^[A-Za-z0-9-]+:[A-Za-z0-9-]+\.?/, (match) => {
    const parts = match.split(":");
    if (parts.length === 2) return parts[1];
    return match;
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
  const shortKeys = keys.map(shortenKey);

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
    table.push({ [shortenKey(key)]: val });
  }
  return table.toString();
}

module.exports = { formatTable };
