declare class Logger {
    private level;
    constructor();
    private shouldLog;
    private formatMessage;
    private sanitizeData;
    debug(_message: string, _data?: any): void;
    info(_message: string, _data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, error?: any): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map