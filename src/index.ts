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

// ─── FetchError helper ──────────────────────────────────────────────────────

interface FetchErrorInfo {
  status?: number;
  body?: any;
  cause?: { code?: string };
  message: string;
}

// ─── YangService ─────────────────────────────────────────────────────────────

class YangService {
  private baseURL: string;
  private authHeader: string;
  private host: string;
  private debug: boolean;
  private timeout: number;
  private insecure: boolean;

  constructor(
    host: string,
    username: string,
    password: string,
    opts: YangServiceOptions = {},
  ) {
    this.host = host;
    this.debug = opts.logging?.level === "debug";
    this.baseURL = opts.baseUrl || `https://${host}`;
    this.timeout = opts.timeout || 30000;
    this.insecure = !!opts.insecure;

    this.authHeader =
      "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

    if (this.insecure) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
  }

  private log(message: string, data?: any): void {
    if (!this.debug) return;
    if (data) {
      console.log(`[YANG DEBUG] ${message}`, data);
    } else {
      console.log(`[YANG DEBUG] ${message}`);
    }
  }

  private async _fetch(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseURL}${path}`;
    this.log(`${method} ${path}`);

    const opts: RequestInit & { signal?: AbortSignal } = {
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

    let response: Response;
    try {
      response = await fetch(url, opts);
    } catch (err: any) {
      const code = err.cause?.code || "";
      if (
        code === "ECONNREFUSED" ||
        code === "ENOTFOUND" ||
        code === "ETIMEDOUT" ||
        err.name === "TimeoutError"
      ) {
        throw new YangConnectionError(
          `Connection failed to ${this.host}: ${err.message}`,
        );
      }
      if (
        err.message?.includes("certificate") ||
        code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
      ) {
        throw new YangConnectionError(
          `TLS certificate error for ${this.host}: ${err.message}. Try --insecure.`,
        );
      }
      throw new YangError(err.message);
    }

    if (!response.ok) {
      const status = response.status;
      let body: any;
      try {
        body = await response.json();
      } catch {
        body = await response.text().catch(() => "");
      }

      const restconfError =
        body?.errors?.error?.[0] || body?.["ietf-restconf:errors"]?.error?.[0];
      const errorMsg =
        restconfError?.["error-message"] ||
        restconfError?.["error-tag"] ||
        response.statusText;

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

    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private handleError(err: any): never {
    if (err instanceof YangError) throw err;
    throw new YangError(err.message);
  }

  async testConnection(): Promise<any> {
    try {
      return await this._fetch("GET", "/restconf");
    } catch (err) {
      this.handleError(err);
    }
  }

  async get(path: string, opts: { clean?: boolean } = {}): Promise<any> {
    try {
      let data = unwrapEnvelope(
        await this._fetch("GET", `/restconf/data/${path}`),
      );
      if (opts.clean) data = cleanObj(data);
      return data;
    } catch (err) {
      this.handleError(err);
    }
  }

  async set(
    path: string,
    data: any,
    method: "patch" | "put" = "patch",
  ): Promise<any> {
    try {
      const res = await this._fetch(
        method.toUpperCase(),
        `/restconf/data/${path}`,
        data,
      );
      return res || { status: "success" };
    } catch (err) {
      this.handleError(err);
    }
  }

  async delete(path: string): Promise<any> {
    try {
      const res = await this._fetch("DELETE", `/restconf/data/${path}`);
      return res || { status: "deleted" };
    } catch (err) {
      this.handleError(err);
    }
  }

  async rpc(operation: string, input?: any): Promise<any> {
    try {
      const body = input ? { input } : {};
      const res = await this._fetch(
        "POST",
        `/restconf/operations/${operation}`,
        body,
      );
      return unwrapEnvelope(res) || { status: "success" };
    } catch (err) {
      this.handleError(err);
    }
  }

  async getOperations(): Promise<Record<string, string>> {
    try {
      const res = await this._fetch("GET", "/restconf/operations");
      const ops = res?.["ietf-restconf:operations"] || {};
      return ops;
    } catch (err) {
      this.handleError(err);
    }
  }

  async getModels(filter?: string): Promise<YangModel[]> {
    try {
      const data = await this._fetch(
        "GET",
        "/restconf/data/ietf-yang-library:modules-state",
      );
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
      this.handleError(err);
    }
  }

  async describeModel(moduleName: string): Promise<any> {
    try {
      return unwrapEnvelope(
        await this._fetch("GET", `/restconf/data/${moduleName}:`),
      );
    } catch (err) {
      if (err instanceof YangNotFoundError) {
        try {
          return unwrapEnvelope(
            await this._fetch("GET", `/restconf/data/${moduleName}`),
          );
        } catch (innerErr) {
          this.handleError(innerErr);
        }
      }
      this.handleError(err);
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
