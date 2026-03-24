import axios, { AxiosInstance, AxiosError } from "axios";
import * as https from "https";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface YangServiceOptions {
  insecure?: boolean;
  timeout?: number;
  baseUrl?: string;
  logging?: { level?: string };
}

interface YangModel {
  name: string;
  revision: string;
  namespace: string;
  features?: string[];
}

interface ExecResult {
  output: string;
}

// ─── Error Classes ───────────────────────────────────────────────────────────

class YangError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YangError";
  }
}

class YangAuthError extends YangError {
  constructor(
    message: string = "Authentication failed. Check username and password.",
  ) {
    super(message);
    this.name = "YangAuthError";
  }
}

class YangNotFoundError extends YangError {
  constructor(message: string = "Resource not found.") {
    super(message);
    this.name = "YangNotFoundError";
  }
}

class YangConnectionError extends YangError {
  constructor(message: string = "Connection failed.") {
    super(message);
    this.name = "YangConnectionError";
  }
}

class YangRequestError extends YangError {
  statusCode: number;
  restconfError?: object;

  constructor(message: string, statusCode: number, restconfError?: object) {
    super(message);
    this.name = "YangRequestError";
    this.statusCode = statusCode;
    this.restconfError = restconfError;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanObj(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj))
    return obj
      .map(cleanObj)
      .filter((v: any) => v !== null && v !== undefined && v !== "");
  if (typeof obj !== "object") return obj;
  const cleaned: any = {};
  for (const [key, val] of Object.entries(obj)) {
    const v = cleanObj(val);
    if (v !== null && v !== undefined && v !== "") {
      if (
        typeof v === "object" &&
        !Array.isArray(v) &&
        Object.keys(v).length === 0
      )
        continue;
      cleaned[key] = v;
    }
  }
  return cleaned;
}

function unwrapEnvelope(data: any): any {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
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
  private client: AxiosInstance;
  private host: string;
  private debug: boolean;

  constructor(
    host: string,
    username: string,
    password: string,
    opts: YangServiceOptions = {},
  ) {
    this.host = host;
    this.debug = opts.logging?.level === "debug";

    const baseURL = opts.baseUrl || `https://${host}`;

    const httpsAgent = new https.Agent({
      rejectUnauthorized: !opts.insecure,
    });

    this.client = axios.create({
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

  private log(message: string, data?: any): void {
    if (!this.debug) return;
    if (data) {
      console.log(`[YANG DEBUG] ${message}`, data);
    } else {
      console.log(`[YANG DEBUG] ${message}`);
    }
  }

  private handleError(err: AxiosError): never {
    if (err.response) {
      const status = err.response.status;
      const body = err.response.data as any;
      const restconfError =
        body?.errors?.error?.[0] || body?.["ietf-restconf:errors"]?.error?.[0];
      const errorMsg =
        restconfError?.["error-message"] ||
        restconfError?.["error-tag"] ||
        err.message;

      if (status === 401 || status === 403) {
        throw new YangAuthError(
          `Authentication failed (${status}): ${errorMsg}`,
        );
      }
      if (status === 404) {
        throw new YangNotFoundError(`Resource not found: ${errorMsg}`);
      }
      throw new YangRequestError(
        `RESTCONF error (${status}): ${errorMsg}`,
        status,
        restconfError,
      );
    }

    if (
      err.code === "ECONNREFUSED" ||
      err.code === "ENOTFOUND" ||
      err.code === "ETIMEDOUT"
    ) {
      throw new YangConnectionError(
        `Connection failed to ${this.host}: ${err.message}`,
      );
    }

    if (
      err.message?.includes("certificate") ||
      err.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
    ) {
      throw new YangConnectionError(
        `TLS certificate error for ${this.host}: ${err.message}. Try --insecure.`,
      );
    }

    throw new YangError(err.message);
  }

  async testConnection(): Promise<any> {
    try {
      this.log("Testing connection", { host: this.host });
      const res = await this.client.get("/restconf");
      return res.data;
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async get(path: string, opts: { clean?: boolean } = {}): Promise<any> {
    try {
      this.log("GET", { path });
      const res = await this.client.get(`/restconf/data/${path}`);
      let data = unwrapEnvelope(res.data);
      if (opts.clean) data = cleanObj(data);
      return data;
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async set(
    path: string,
    data: any,
    method: "patch" | "put" = "patch",
  ): Promise<any> {
    try {
      this.log(`${method.toUpperCase()}`, { path, data });
      const res =
        method === "put"
          ? await this.client.put(`/restconf/data/${path}`, data)
          : await this.client.patch(`/restconf/data/${path}`, data);
      return res.data || { status: "success" };
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async delete(path: string): Promise<any> {
    try {
      this.log("DELETE", { path });
      const res = await this.client.delete(`/restconf/data/${path}`);
      return res.data || { status: "deleted" };
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async rpc(operation: string, input?: any): Promise<any> {
    try {
      this.log("RPC", { operation, input });
      const body = input ? { input } : {};
      const res = await this.client.post(
        `/restconf/operations/${operation}`,
        body,
      );
      return unwrapEnvelope(res.data) || { status: "success" };
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async getOperations(): Promise<Record<string, string>> {
    try {
      this.log("GET operations");
      const res = await this.client.get("/restconf/operations");
      const ops = res.data?.["ietf-restconf:operations"] || {};
      return ops;
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async getModels(filter?: string): Promise<YangModel[]> {
    try {
      this.log("GET models", { filter });
      const res = await this.client.get(
        "/restconf/data/ietf-yang-library:modules-state",
      );
      const data = res.data;
      const modules = data?.["ietf-yang-library:modules-state"]?.module || [];

      let models: YangModel[] = modules.map((m: any) => ({
        name: m.name,
        revision: m.revision || "",
        namespace: m.namespace || "",
        features: m.feature || [],
      }));

      if (filter) {
        const lowerFilter = filter.toLowerCase();
        models = models.filter(
          (m: YangModel) =>
            m.name.toLowerCase().includes(lowerFilter) ||
            m.namespace.toLowerCase().includes(lowerFilter),
        );
      }

      return models.sort((a: YangModel, b: YangModel) =>
        a.name.localeCompare(b.name),
      );
    } catch (err) {
      this.handleError(err as AxiosError);
    }
  }

  async describeModel(moduleName: string): Promise<any> {
    try {
      this.log("DESCRIBE", { moduleName });
      const res = await this.client.get(`/restconf/data/${moduleName}:`);
      return unwrapEnvelope(res.data);
    } catch (err) {
      if ((err as AxiosError).response?.status === 404) {
        try {
          const res = await this.client.get(`/restconf/data/${moduleName}`);
          return unwrapEnvelope(res.data);
        } catch (innerErr) {
          this.handleError(innerErr as AxiosError);
        }
      }
      this.handleError(err as AxiosError);
    }
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

(YangService as any).YangError = YangError;
(YangService as any).YangAuthError = YangAuthError;
(YangService as any).YangNotFoundError = YangNotFoundError;
(YangService as any).YangConnectionError = YangConnectionError;
(YangService as any).YangRequestError = YangRequestError;

export default YangService;
export { YangService, YangServiceOptions, YangModel, ExecResult };
export {
  YangError,
  YangAuthError,
  YangNotFoundError,
  YangConnectionError,
  YangRequestError,
};
