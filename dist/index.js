"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YangRequestError = exports.YangConnectionError = exports.YangNotFoundError = exports.YangAuthError = exports.YangError = exports.YangService = void 0;
const axios_1 = __importDefault(require("axios"));
const https = __importStar(require("https"));
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
        const baseURL = opts.baseUrl || `https://${host}`;
        const httpsAgent = new https.Agent({
            rejectUnauthorized: !opts.insecure,
        });
        this.client = axios_1.default.create({
            baseURL,
            auth: { username, password },
            headers: {
                Accept: "application/yang-data+json",
                "Content-Type": "application/yang-data+json",
            },
            httpsAgent,
            timeout: opts.timeout || 30000,
        });
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
    handleError(err) {
        var _a, _b, _c, _d, _e;
        if (err.response) {
            const status = err.response.status;
            const body = err.response.data;
            const restconfError = ((_b = (_a = body === null || body === void 0 ? void 0 : body.errors) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b[0]) || ((_d = (_c = body === null || body === void 0 ? void 0 : body["ietf-restconf:errors"]) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d[0]);
            const errorMsg = (restconfError === null || restconfError === void 0 ? void 0 : restconfError["error-message"]) ||
                (restconfError === null || restconfError === void 0 ? void 0 : restconfError["error-tag"]) ||
                err.message;
            if (status === 401 || status === 403) {
                throw new YangAuthError(`Authentication failed (${status}): ${errorMsg}`);
            }
            if (status === 404) {
                throw new YangNotFoundError(`Resource not found: ${errorMsg}`);
            }
            throw new YangRequestError(`RESTCONF error (${status}): ${errorMsg}`, status, restconfError);
        }
        if (err.code === "ECONNREFUSED" ||
            err.code === "ENOTFOUND" ||
            err.code === "ETIMEDOUT") {
            throw new YangConnectionError(`Connection failed to ${this.host}: ${err.message}`);
        }
        if (((_e = err.message) === null || _e === void 0 ? void 0 : _e.includes("certificate")) ||
            err.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
            throw new YangConnectionError(`TLS certificate error for ${this.host}: ${err.message}. Try --insecure.`);
        }
        throw new YangError(err.message);
    }
    async testConnection() {
        try {
            this.log("Testing connection", { host: this.host });
            const res = await this.client.get("/restconf");
            return res.data;
        }
        catch (err) {
            this.handleError(err);
        }
    }
    async get(path, opts = {}) {
        try {
            this.log("GET", { path });
            const res = await this.client.get(`/restconf/data/${path}`);
            let data = unwrapEnvelope(res.data);
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
            this.log(`${method.toUpperCase()}`, { path, data });
            const res = method === "put"
                ? await this.client.put(`/restconf/data/${path}`, data)
                : await this.client.patch(`/restconf/data/${path}`, data);
            return res.data || { status: "success" };
        }
        catch (err) {
            this.handleError(err);
        }
    }
    async delete(path) {
        try {
            this.log("DELETE", { path });
            const res = await this.client.delete(`/restconf/data/${path}`);
            return res.data || { status: "deleted" };
        }
        catch (err) {
            this.handleError(err);
        }
    }
    async rpc(operation, input) {
        try {
            this.log("RPC", { operation, input });
            const body = input ? { input } : {};
            const res = await this.client.post(`/restconf/operations/${operation}`, body);
            return unwrapEnvelope(res.data) || { status: "success" };
        }
        catch (err) {
            this.handleError(err);
        }
    }
    async getOperations() {
        var _a;
        try {
            this.log("GET operations");
            const res = await this.client.get("/restconf/operations");
            const ops = ((_a = res.data) === null || _a === void 0 ? void 0 : _a["ietf-restconf:operations"]) || {};
            return ops;
        }
        catch (err) {
            this.handleError(err);
        }
    }
    async getModels(filter) {
        var _a;
        try {
            this.log("GET models", { filter });
            const res = await this.client.get("/restconf/data/ietf-yang-library:modules-state");
            const data = res.data;
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
        var _a;
        try {
            this.log("DESCRIBE", { moduleName });
            const res = await this.client.get(`/restconf/data/${moduleName}:`);
            return unwrapEnvelope(res.data);
        }
        catch (err) {
            if (((_a = err.response) === null || _a === void 0 ? void 0 : _a.status) === 404) {
                try {
                    const res = await this.client.get(`/restconf/data/${moduleName}`);
                    return unwrapEnvelope(res.data);
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
