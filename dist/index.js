"use strict";
// ─── Interfaces ──────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.YangRequestError = exports.YangConnectionError = exports.YangNotFoundError = exports.YangAuthError = exports.YangError = exports.YangService = void 0;
// ─── Error Classes ───────────────────────────────────────────────────────────
class YangError extends Error {
    constructor(message) {
        super(message);
        this.name = "YangError";
    }
}
exports.YangError = YangError;
class YangAuthError extends YangError {
    constructor(message = "Authentication failed. Check username and password.") {
        super(message);
        this.name = "YangAuthError";
    }
}
exports.YangAuthError = YangAuthError;
class YangNotFoundError extends YangError {
    constructor(message = "Resource not found.") {
        super(message);
        this.name = "YangNotFoundError";
    }
}
exports.YangNotFoundError = YangNotFoundError;
class YangConnectionError extends YangError {
    constructor(message = "Connection failed.") {
        super(message);
        this.name = "YangConnectionError";
    }
}
exports.YangConnectionError = YangConnectionError;
class YangRequestError extends YangError {
    constructor(message, statusCode, restconfError) {
        super(message);
        this.name = "YangRequestError";
        this.statusCode = statusCode;
        this.restconfError = restconfError;
    }
}
exports.YangRequestError = YangRequestError;
// ─── Helpers ─────────────────────────────────────────────────────────────────
function cleanObj(obj) {
    if (obj === null || obj === undefined)
        return obj;
    if (Array.isArray(obj))
        return obj
            .map(cleanObj)
            .filter((v) => v !== null && v !== undefined && v !== "");
    if (typeof obj !== "object")
        return obj;
    const cleaned = {};
    for (const [key, val] of Object.entries(obj)) {
        const v = cleanObj(val);
        if (v !== null && v !== undefined && v !== "") {
            if (typeof v === "object" &&
                !Array.isArray(v) &&
                Object.keys(v).length === 0)
                continue;
            cleaned[key] = v;
        }
    }
    return cleaned;
}
function unwrapEnvelope(data) {
    if (!data || typeof data !== "object" || Array.isArray(data))
        return data;
    const keys = Object.keys(data);
    if (keys.length === 1) {
        const key = keys[0];
        if (key.includes(":")) {
            return data[key];
        }
    }
    return data;
}
// ─── YangService ─────────────────────────────────────────────────────────────
class YangService {
    constructor(host, username, password, opts = {}) {
        var _a;
        this.host = host;
        this.debug = ((_a = opts.logging) === null || _a === void 0 ? void 0 : _a.level) === "debug";
        this.baseURL = opts.baseUrl || `https://${host}`;
        this.timeout = opts.timeout || 30000;
        this.insecure = !!opts.insecure;
        this.authHeader =
            "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
        if (this.insecure) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }
    }
    log(message, data) {
        if (!this.debug)
            return;
        if (data) {
            console.log(`[YANG DEBUG] ${message}`, data);
        }
        else {
            console.log(`[YANG DEBUG] ${message}`);
        }
    }
    async _fetch(method, path, body) {
        var _a, _b, _c, _d, _e, _f;
        const url = `${this.baseURL}${path}`;
        this.log(`${method} ${path}`);
        const opts = {
            method,
            headers: {
                Authorization: this.authHeader,
                Accept: "application/yang-data+json",
                "Content-Type": "application/yang-data+json",
            },
            signal: AbortSignal.timeout(this.timeout),
        };
        if (body !== undefined) {
            opts.body = JSON.stringify(body);
        }
        let response;
        try {
            response = await fetch(url, opts);
        }
        catch (err) {
            const code = ((_a = err.cause) === null || _a === void 0 ? void 0 : _a.code) || "";
            if (code === "ECONNREFUSED" ||
                code === "ENOTFOUND" ||
                code === "ETIMEDOUT" ||
                err.name === "TimeoutError") {
                throw new YangConnectionError(`Connection failed to ${this.host}: ${err.message}`);
            }
            if (((_b = err.message) === null || _b === void 0 ? void 0 : _b.includes("certificate")) ||
                code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
                throw new YangConnectionError(`TLS certificate error for ${this.host}: ${err.message}. Try --insecure.`);
            }
            throw new YangError(err.message);
        }
        if (!response.ok) {
            const status = response.status;
            let body;
            try {
                body = await response.json();
            }
            catch (_g) {
                body = await response.text().catch(() => "");
            }
            const restconfError = ((_d = (_c = body === null || body === void 0 ? void 0 : body.errors) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d[0]) || ((_f = (_e = body === null || body === void 0 ? void 0 : body["ietf-restconf:errors"]) === null || _e === void 0 ? void 0 : _e.error) === null || _f === void 0 ? void 0 : _f[0]);
            const errorMsg = (restconfError === null || restconfError === void 0 ? void 0 : restconfError["error-message"]) ||
                (restconfError === null || restconfError === void 0 ? void 0 : restconfError["error-tag"]) ||
                response.statusText;
            if (status === 401 || status === 403) {
                throw new YangAuthError(`Authentication failed (${status}): ${errorMsg}`);
            }
            if (status === 404) {
                throw new YangNotFoundError(`Resource not found: ${errorMsg}`);
            }
            throw new YangRequestError(`RESTCONF error (${status}): ${errorMsg}`, status, restconfError);
        }
        const text = await response.text();
        if (!text)
            return null;
        try {
            return JSON.parse(text);
        }
        catch (_h) {
            return text;
        }
    }
    handleError(err) {
        if (err instanceof YangError)
            throw err;
        throw new YangError(err.message);
    }
    async testConnection() {
        try {
            return await this._fetch("GET", "/restconf");
        }
        catch (err) {
            this.handleError(err);
        }
    }
    async get(path, opts = {}) {
        try {
            let data = unwrapEnvelope(await this._fetch("GET", `/restconf/data/${path}`));
            if (opts.clean)
                data = cleanObj(data);
            return data;
        }
        catch (err) {
            this.handleError(err);
        }
    }
    async set(path, data, method = "patch") {
        try {
            const res = await this._fetch(method.toUpperCase(), `/restconf/data/${path}`, data);
            return res || { status: "success" };
        }
        catch (err) {
            this.handleError(err);
        }
    }
    async delete(path) {
        try {
            const res = await this._fetch("DELETE", `/restconf/data/${path}`);
            return res || { status: "deleted" };
        }
        catch (err) {
            this.handleError(err);
        }
    }
    async rpc(operation, input) {
        try {
            const body = input ? { input } : {};
            const res = await this._fetch("POST", `/restconf/operations/${operation}`, body);
            return unwrapEnvelope(res) || { status: "success" };
        }
        catch (err) {
            this.handleError(err);
        }
    }
    async getOperations() {
        try {
            const res = await this._fetch("GET", "/restconf/operations");
            const ops = (res === null || res === void 0 ? void 0 : res["ietf-restconf:operations"]) || {};
            return ops;
        }
        catch (err) {
            this.handleError(err);
        }
    }
    async getModels(filter) {
        var _a;
        try {
            const data = await this._fetch("GET", "/restconf/data/ietf-yang-library:modules-state");
            const modules = ((_a = data === null || data === void 0 ? void 0 : data["ietf-yang-library:modules-state"]) === null || _a === void 0 ? void 0 : _a.module) || [];
            let models = modules.map((m) => ({
                name: m.name,
                revision: m.revision || "",
                namespace: m.namespace || "",
                features: m.feature || [],
            }));
            if (filter) {
                const lowerFilter = filter.toLowerCase();
                models = models.filter((m) => m.name.toLowerCase().includes(lowerFilter) ||
                    m.namespace.toLowerCase().includes(lowerFilter));
            }
            return models.sort((a, b) => a.name.localeCompare(b.name));
        }
        catch (err) {
            this.handleError(err);
        }
    }
    async describeModel(moduleName) {
        try {
            return unwrapEnvelope(await this._fetch("GET", `/restconf/data/${moduleName}:`));
        }
        catch (err) {
            if (err instanceof YangNotFoundError) {
                try {
                    return unwrapEnvelope(await this._fetch("GET", `/restconf/data/${moduleName}`));
                }
                catch (innerErr) {
                    this.handleError(innerErr);
                }
            }
            this.handleError(err);
        }
    }
}
exports.YangService = YangService;
// ─── Exports ─────────────────────────────────────────────────────────────────
YangService.YangError = YangError;
YangService.YangAuthError = YangAuthError;
YangService.YangNotFoundError = YangNotFoundError;
YangService.YangConnectionError = YangConnectionError;
YangService.YangRequestError = YangRequestError;
exports.default = YangService;
