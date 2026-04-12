import {
  ParagraphApiError,
  ParagraphClientError,
} from "./errors.js";
import { RequestRateLimiter } from "./rate-limiter.js";
import type {
  AiContentResult,
  AiMetaDescriptionResult,
  AiMetaNameResult,
  ApiErrorPayload,
  ApiInfo,
  ClientOptions,
  Collection,
  CollectionListQuery,
  CollectionMutationResult,
  CreateCollectionRequest,
  CreateDataModelRequest,
  CreateLabelRequest,
  CreateLocaleRequest,
  CreatePageRequest,
  CreatePageTranslationRequest,
  CreateStatusRequest,
  DataModel,
  DataModelListQuery,
  DataModelMutationResult,
  DeleteByCodeResult,
  DeleteResult,
  GenerateContentRequest,
  GenerateMetaRequest,
  GetPageQuery,
  Label,
  LabelMutationResult,
  LabelListQuery,
  ListResponse,
  Locale,
  LocaleMutationResult,
  Media,
  MediaDeleteResult,
  MediaDetail,
  MediaListQuery,
  MediaMutationResult,
  MediaUploadResult,
  Member,
  MemberListQuery,
  Page,
  PageListQuery,
  PageSummary,
  PageMutationResult,
  PageRestoreResult,
  PermanentDeleteResult,
  ReorderLabelsRequest,
  ReorderResult,
  ReorderStatusesRequest,
  RequestDescriptor,
  RequestOptions,
  Status,
  StatusListQuery,
  StatusMutationResult,
  UpdateCollectionRequest,
  UpdateDataModelRequest,
  UpdateLabelRequest,
  UpdateMediaRequest,
  UpdatePageRequest,
  UpdateStatusRequest,
  UploadMediaRequest,
} from "./types.js";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type QueryPrimitive = string | number | boolean;

type FetchLike = typeof globalThis.fetch;

type DataEnvelope<T> = {
  data: T;
};

const DEFAULT_BASE_URL = "https://api.paragraphcms.com/v1";
const DEFAULT_REQUESTS_PER_SECOND = 5;

function normalizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");

  if (!trimmed) {
    throw new ParagraphClientError("`baseUrl` cannot be empty.");
  }

  const url = new URL(trimmed);
  const normalizedPath = url.pathname.replace(/\/+$/, "");

  if (normalizedPath === "" || normalizedPath === "/") {
    url.pathname = "/v1";
  } else {
    url.pathname = normalizedPath;
  }

  return url.toString().replace(/\/+$/, "");
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: object,
) {
  const normalizedPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  const url = new URL(`${baseUrl}${normalizedPath}`);

  if (query) {
    for (const [key, rawValue] of Object.entries(
      query as Record<string, unknown>,
    )) {
      if (rawValue === undefined || rawValue === null) {
        continue;
      }

      if (Array.isArray(rawValue)) {
        if (rawValue.length === 0) {
          continue;
        }

        url.searchParams.set(
          key,
          rawValue.map((value) => String(value as QueryPrimitive)).join(","),
        );
        continue;
      }

      url.searchParams.set(key, String(rawValue));
    }
  }

  return url;
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybeError = (value as { error?: unknown }).error;

  if (typeof maybeError !== "object" || maybeError === null) {
    return false;
  }

  const code = (maybeError as { code?: unknown }).code;
  const message = (maybeError as { message?: unknown }).message;

  return typeof code === "string" && typeof message === "string";
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json() as Promise<unknown>;
  }

  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function createRequestDescriptor(
  method: HttpMethod,
  url: URL,
): RequestDescriptor {
  return {
    method,
    url: url.toString(),
  };
}

function createRequestSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
) {
  if (!signal && (!timeoutMs || timeoutMs <= 0)) {
    return {
      signal: undefined,
      cleanup: () => {},
      didTimeout: () => false,
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: number | undefined;

  const onAbort = () => {
    controller.abort(signal?.reason);
  };

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort(
        new Error(`Request timed out after ${timeoutMs}ms.`),
      );
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    },
    didTimeout: () => timedOut,
  };
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException && error.name === "AbortError"
  );
}

function toBlobPart(file: UploadMediaRequest["file"]) {
  if (typeof File !== "undefined" && file instanceof File) {
    return {
      value: file,
      fileName: undefined as string | undefined,
    };
  }

  if (file instanceof Blob) {
    return {
      value: file,
      fileName: undefined as string | undefined,
    };
  }

  if (ArrayBuffer.isView(file)) {
    const source = new Uint8Array(
      file.buffer,
      file.byteOffset,
      file.byteLength,
    );
    const view = new Uint8Array(source.byteLength);

    view.set(source);

    return {
      value: new Blob([view]),
      fileName: undefined as string | undefined,
    };
  }

  return {
    value: new Blob([file]),
    fileName: undefined as string | undefined,
  };
}

function buildUploadFilePart(input: UploadMediaRequest) {
  const source = toBlobPart(input.file);
  const fileName =
    input.file_name ??
    (typeof File !== "undefined" && input.file instanceof File
      ? input.file.name
      : "upload.bin");
  const contentType =
    input.content_type ??
    ("type" in source.value &&
    typeof source.value.type === "string" &&
    source.value.type.length > 0
      ? source.value.type
      : "application/octet-stream");

  if (typeof File !== "undefined") {
    if (source.value instanceof File) {
      if (
        source.value.name === fileName &&
        source.value.type === contentType
      ) {
        return {
          value: source.value,
          fileName: undefined,
        };
      }

      return {
        value: new File([source.value], fileName, {
          type: contentType,
          lastModified: source.value.lastModified,
        }),
        fileName: undefined,
      };
    }

    return {
      value: new File([source.value], fileName, {
        type: contentType,
      }),
      fileName: undefined,
    };
  }

  return {
    value: new Blob([source.value], {
      type: contentType,
    }),
    fileName,
  };
}

function createUploadFormData(input: UploadMediaRequest) {
  const formData = new FormData();
  const filePart = buildUploadFilePart(input);

  if (filePart.fileName) {
    formData.append("file", filePart.value, filePart.fileName);
  } else {
    formData.append("file", filePart.value);
  }

  formData.append("page_id", input.page_id);

  if (input.alt !== undefined && input.alt !== null) {
    formData.append("alt", input.alt);
  }

  return formData;
}

export class Client {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly defaultHeaders: Headers;
  private readonly timeoutMs?: number;
  private readonly limiter: RequestRateLimiter;

  readonly pages = {
    list: (query?: PageListQuery, options?: RequestOptions) =>
      this.requestList<PageSummary>("GET", "/pages", {
        query,
        options,
      }),
    create: (
      body: CreatePageRequest = {},
      options?: RequestOptions,
    ) =>
      this.requestData<PageMutationResult>("POST", "/pages", {
        body,
        options,
      }),
    get: (
      pageId: string,
      query?: GetPageQuery,
      options?: RequestOptions,
    ) =>
      this.requestData<Page>("GET", `/pages/${pageId}`, {
        query,
        options,
      }),
    update: (
      pageId: string,
      body: UpdatePageRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<PageMutationResult>("PATCH", `/pages/${pageId}`, {
        body,
        options,
      }),
    delete: (pageId: string, options?: RequestOptions) =>
      this.requestData<DeleteResult>("DELETE", `/pages/${pageId}`, {
        options,
      }),
    restore: (pageId: string, options?: RequestOptions) =>
      this.requestData<PageRestoreResult>(
        "POST",
        `/pages/${pageId}/restore`,
        {
          options,
        },
      ),
    permanentlyDelete: (
      pageId: string,
      options?: RequestOptions,
    ) =>
      this.requestData<PermanentDeleteResult>(
        "DELETE",
        `/pages/${pageId}/permanent`,
        {
          options,
        },
      ),
    duplicate: (pageId: string, options?: RequestOptions) =>
      this.requestData<PageMutationResult>(
        "POST",
        `/pages/${pageId}/duplicate`,
        {
          options,
        },
      ),
    createTranslation: (
      pageId: string,
      body: CreatePageTranslationRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<PageMutationResult>(
        "POST",
        `/pages/${pageId}/translations`,
        {
          body,
          options,
        },
      ),
  };

  readonly collections = {
    list: (query?: CollectionListQuery, options?: RequestOptions) =>
      this.requestList<Collection>("GET", "/collections", {
        query,
        options,
      }),
    create: (
      body: CreateCollectionRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<CollectionMutationResult>(
        "POST",
        "/collections",
        {
          body,
          options,
        },
      ),
    get: (collectionId: string, options?: RequestOptions) =>
      this.requestData<Collection>(
        "GET",
        `/collections/${collectionId}`,
        {
          options,
        },
      ),
    update: (
      collectionId: string,
      body: UpdateCollectionRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<CollectionMutationResult>(
        "PATCH",
        `/collections/${collectionId}`,
        {
          body,
          options,
        },
      ),
    delete: (collectionId: string, options?: RequestOptions) =>
      this.requestData<DeleteResult>(
        "DELETE",
        `/collections/${collectionId}`,
        {
          options,
        },
      ),
  };

  readonly media = {
    list: (query?: MediaListQuery, options?: RequestOptions) =>
      this.requestList<Media>("GET", "/media", {
        query,
        options,
      }),
    upload: (body: UploadMediaRequest, options?: RequestOptions) =>
      this.requestData<MediaUploadResult>("POST", "/media", {
        formData: createUploadFormData(body),
        options,
      }),
    get: (mediaId: string, options?: RequestOptions) =>
      this.requestData<MediaDetail>("GET", `/media/${mediaId}`, {
        options,
      }),
    update: (
      mediaId: string,
      body: UpdateMediaRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<MediaMutationResult>(
        "PATCH",
        `/media/${mediaId}`,
        {
          body,
          options,
        },
      ),
    delete: (mediaId: string, options?: RequestOptions) =>
      this.requestData<MediaDeleteResult>(
        "DELETE",
        `/media/${mediaId}`,
        {
          options,
        },
      ),
  };

  readonly members = {
    list: (query?: MemberListQuery, options?: RequestOptions) =>
      this.requestList<Member>("GET", "/members", {
        query,
        options,
      }),
  };

  readonly authors = {
    list: (query?: MemberListQuery, options?: RequestOptions) =>
      this.requestList<Member>("GET", "/authors", {
        query,
        options,
      }),
  };

  readonly reviewers = {
    list: (query?: MemberListQuery, options?: RequestOptions) =>
      this.requestList<Member>("GET", "/reviewers", {
        query,
        options,
      }),
  };

  readonly statuses = {
    list: (query?: StatusListQuery, options?: RequestOptions) =>
      this.requestList<Status>("GET", "/statuses", {
        query,
        options,
      }),
    create: (
      body: CreateStatusRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<StatusMutationResult>("POST", "/statuses", {
        body,
        options,
      }),
    get: (statusId: string, options?: RequestOptions) =>
      this.requestData<Status>("GET", `/statuses/${statusId}`, {
        options,
      }),
    update: (
      statusId: string,
      body: UpdateStatusRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<StatusMutationResult>(
        "PATCH",
        `/statuses/${statusId}`,
        {
          body,
          options,
        },
      ),
    reorder: (
      body: ReorderStatusesRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<ReorderResult>(
        "POST",
        "/statuses/reorder",
        {
          body,
          options,
        },
      ),
    delete: (statusId: string, options?: RequestOptions) =>
      this.requestData<DeleteResult>(
        "DELETE",
        `/statuses/${statusId}`,
        {
          options,
        },
      ),
  };

  readonly labels = {
    list: (query?: LabelListQuery, options?: RequestOptions) =>
      this.requestList<Label>("GET", "/labels", {
        query,
        options,
      }),
    create: (
      body: CreateLabelRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<LabelMutationResult>("POST", "/labels", {
        body,
        options,
      }),
    get: (labelId: string, options?: RequestOptions) =>
      this.requestData<Label>("GET", `/labels/${labelId}`, {
        options,
      }),
    update: (
      labelId: string,
      body: UpdateLabelRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<LabelMutationResult>(
        "PATCH",
        `/labels/${labelId}`,
        {
          body,
          options,
        },
      ),
    reorder: (
      body: ReorderLabelsRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<ReorderResult>("POST", "/labels/reorder", {
        body,
        options,
      }),
    delete: (labelId: string, options?: RequestOptions) =>
      this.requestData<DeleteResult>("DELETE", `/labels/${labelId}`, {
        options,
      }),
  };

  readonly dataModels = {
    list: (query?: DataModelListQuery, options?: RequestOptions) =>
      this.requestList<DataModel>("GET", "/data-models", {
        query,
        options,
      }),
    create: (
      body: CreateDataModelRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<DataModelMutationResult>(
        "POST",
        "/data-models",
        {
          body,
          options,
        },
      ),
    get: (dataModelId: string, options?: RequestOptions) =>
      this.requestData<DataModel>(
        "GET",
        `/data-models/${dataModelId}`,
        {
          options,
        },
      ),
    update: (
      dataModelId: string,
      body: UpdateDataModelRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<DataModelMutationResult>(
        "PATCH",
        `/data-models/${dataModelId}`,
        {
          body,
          options,
        },
      ),
    delete: (dataModelId: string, options?: RequestOptions) =>
      this.requestData<DeleteResult>(
        "DELETE",
        `/data-models/${dataModelId}`,
        {
          options,
        },
      ),
  };

  readonly locales = {
    list: (options?: RequestOptions) =>
      this.requestData<Locale[]>("GET", "/locales", {
        options,
      }),
    create: (
      body: CreateLocaleRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<LocaleMutationResult>("POST", "/locales", {
        body,
        options,
      }),
    delete: (code: string, options?: RequestOptions) =>
      this.requestData<DeleteByCodeResult>(
        "DELETE",
        `/locales/${code}`,
        {
          options,
        },
      ),
  };

  readonly ai = {
    generateMetaName: (
      body: GenerateMetaRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<AiMetaNameResult>(
        "POST",
        "/ai/meta-name",
        {
          body,
          options,
        },
      ),
    generateMetaDescription: (
      body: GenerateMetaRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<AiMetaDescriptionResult>(
        "POST",
        "/ai/meta-description",
        {
          body,
          options,
        },
      ),
    generateContent: (
      body: GenerateContentRequest,
      options?: RequestOptions,
    ) =>
      this.requestData<AiContentResult>("POST", "/ai/content", {
        body,
        options,
      }),
  };

  constructor(options: ClientOptions) {
    if (!options.apiKey.trim()) {
      throw new ParagraphClientError("`apiKey` is required.");
    }

    const fetchImpl = options.fetch ?? globalThis.fetch;

    if (typeof fetchImpl !== "function") {
      throw new ParagraphClientError(
        "No fetch implementation available. Pass `fetch` in the client options.",
      );
    }

    this.apiKey = options.apiKey.trim();
    this.baseUrl = normalizeBaseUrl(
      options.baseUrl ?? DEFAULT_BASE_URL,
    );
    this.fetchImpl = fetchImpl;
    this.defaultHeaders = new Headers(options.headers);
    this.timeoutMs = options.timeoutMs;
    this.limiter = new RequestRateLimiter(
      options.maxRequestsPerSecond ?? DEFAULT_REQUESTS_PER_SECOND,
    );
  }

  getInfo(options?: RequestOptions) {
    return this.requestData<ApiInfo>("GET", "", { options });
  }

  private requestData<T>(
    method: HttpMethod,
    path: string,
    config?: {
      query?: object;
      body?: unknown;
      formData?: FormData;
      options?: RequestOptions;
    },
  ) {
    return this.requestJson<DataEnvelope<T>>(method, path, config).then(
      (response) => response.data,
    );
  }

  private requestList<T>(
    method: HttpMethod,
    path: string,
    config?: {
      query?: object;
      options?: RequestOptions;
    },
  ) {
    return this.requestJson<ListResponse<T>>(method, path, config);
  }

  private requestJson<T>(
    method: HttpMethod,
    path: string,
    config?: {
      query?: object;
      body?: unknown;
      formData?: FormData;
      options?: RequestOptions;
    },
  ) {
    const url = buildUrl(this.baseUrl, path, config?.query);
    const request = createRequestDescriptor(method, url);

    return this.limiter.schedule(async () => {
      const headers = new Headers(this.defaultHeaders);
      const timeoutMs =
        config?.options?.timeoutMs ?? this.timeoutMs;

      headers.set("accept", "application/json");

      if (
        !headers.has("x-api-key") &&
        !headers.has("authorization")
      ) {
        headers.set("x-api-key", this.apiKey);
      }

      let body: BodyInit | undefined;

      if (config?.formData) {
        headers.delete("content-type");
        body = config.formData;
      } else if (config?.body !== undefined) {
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }

        body = JSON.stringify(config.body);
      }

      const optionHeaders = new Headers(config?.options?.headers);

      for (const [key, value] of optionHeaders.entries()) {
        headers.set(key, value);
      }

      if (config?.formData) {
        headers.delete("content-type");
      }

      const requestSignal = createRequestSignal(
        config?.options?.signal,
        timeoutMs,
      );

      try {
        const response = await this.fetchImpl(url, {
          method,
          headers,
          body,
          signal: requestSignal.signal,
        });
        const payload = await parseResponse(response);

        if (!response.ok) {
          if (isApiErrorPayload(payload)) {
            throw new ParagraphApiError({
              status: response.status,
              code: payload.error.code,
              message: payload.error.message,
              details: payload.error.details,
              headers: new Headers(response.headers),
              request,
              body: payload,
            });
          }

          throw new ParagraphApiError({
            status: response.status,
            code: response.status === 401 ? "unauthorized" : "request_failed",
            message:
              typeof payload === "string" && payload.length > 0
                ? payload
                : response.statusText || "Request failed.",
            headers: new Headers(response.headers),
            request,
          });
        }

        return payload as T;
      } catch (error) {
        if (
          error instanceof ParagraphApiError ||
          error instanceof ParagraphClientError
        ) {
          throw error;
        }

        if (requestSignal.didTimeout()) {
          throw new ParagraphClientError(
            `Request timed out after ${timeoutMs}ms.`,
            {
              request,
              cause: error,
            },
          );
        }

        if (isAbortError(error)) {
          throw error;
        }

        throw new ParagraphClientError("Request failed.", {
          request,
          cause: error,
        });
      } finally {
        requestSignal.cleanup();
      }
    });
  }
}
