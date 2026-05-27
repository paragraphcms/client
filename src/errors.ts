import type {
  ApiErrorPayload,
  RequestDescriptor,
} from "./types.js";

export class ParagraphApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly headers: Headers;
  readonly request: RequestDescriptor;
  readonly body?: ApiErrorPayload;

  constructor(options: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    headers?: Headers;
    request: RequestDescriptor;
    body?: ApiErrorPayload;
  }) {
    super(options.message);
    this.name = "ParagraphApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.headers = options.headers ?? new Headers();
    this.request = options.request;
    this.body = options.body;
  }
}

export class ParagraphClientError extends Error {
  readonly request?: RequestDescriptor;
  override readonly cause?: unknown;

  constructor(
    message: string,
    options?: {
      request?: RequestDescriptor;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "ParagraphClientError";
    this.request = options?.request;
    this.cause = options?.cause;
  }
}

export type ParagraphError = ParagraphApiError | ParagraphClientError;
