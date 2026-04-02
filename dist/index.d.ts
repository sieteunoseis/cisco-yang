interface YangServiceOptions {
    insecure?: boolean;
    timeout?: number;
    baseUrl?: string;
    logging?: {
        level?: string;
    };
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
declare class YangError extends Error {
    constructor(message: string);
}
declare class YangAuthError extends YangError {
    constructor(message?: string);
}
declare class YangNotFoundError extends YangError {
    constructor(message?: string);
}
declare class YangConnectionError extends YangError {
    constructor(message?: string);
}
declare class YangRequestError extends YangError {
    statusCode: number;
    restconfError?: object;
    constructor(message: string, statusCode: number, restconfError?: object);
}
declare class YangService {
    private baseURL;
    private authHeader;
    private host;
    private debug;
    private timeout;
    private insecure;
    constructor(host: string, username: string, password: string, opts?: YangServiceOptions);
    private log;
    private _fetch;
    private handleError;
    testConnection(): Promise<any>;
    get(path: string, opts?: {
        clean?: boolean;
    }): Promise<any>;
    set(path: string, data: any, method?: "patch" | "put"): Promise<any>;
    delete(path: string): Promise<any>;
    rpc(operation: string, input?: any): Promise<any>;
    getOperations(): Promise<Record<string, string>>;
    getModels(filter?: string): Promise<YangModel[]>;
    describeModel(moduleName: string): Promise<any>;
}
export default YangService;
export { YangService, YangServiceOptions, YangModel, ExecResult };
export { YangError, YangAuthError, YangNotFoundError, YangConnectionError, YangRequestError, };
