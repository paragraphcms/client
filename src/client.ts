import ky, {
  HTTPError,
  TimeoutError,
  type KyInstance,
  type ShouldRetryState,
} from "ky";
import {
  ParagraphApiError,
  ParagraphClientError,
  type ParagraphError,
} from "./errors.js";
import { RequestRateLimiter } from "./rate-limiter.js";
import type {
  AiContentResult,
  AiMetaDescriptionResult,
  AiMetaNameResult,
  ApiErrorPayload,
  ApiInfo,
  ClientResult,
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
  PageListItem,
  PageListQuery,
  PageSummary,
  PageSummaryWithSlug,
  PageWithSlug,
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
type PlainObject = Record<string, unknown>;

type DataEnvelope<T> = {
  data: T;
};

const API_BASE_URL = "https://api.paragraphcms.com/v1";
const DEFAULT_REQUESTS_PER_SECOND = 5;
const DEFAULT_RATE_LIMIT_RETRIES = 5;
const LOOKUP_PAGE_SIZE = 100;
const PRESERVED_TRANSFORM_KEYS = new Set(["content", "editorNode", "fields"]);
const RETRYABLE_METHODS = ["get", "post", "patch", "delete"] as const;
const SAFE_TRANSIENT_RETRY_METHODS = new Set(["GET", "DELETE"]);
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];
const RETRY_AFTER_STATUS_CODES = [429, 503];

function resolveFetchImplementation(customFetch: FetchLike | undefined) {
  const fetchImpl = customFetch ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new ParagraphClientError(
      "No fetch implementation available. Pass `fetch` in the client options.",
    );
  }

  if (fetchImpl === globalThis.fetch) {
    return globalThis.fetch.bind(globalThis) as FetchLike;
  }

  return fetchImpl;
}

function isPlainObject(value: unknown): value is PlainObject {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function toCamelCaseKey(key: string) {
  return key.replace(/_([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );
}

function transformKeysDeep(
  value: unknown,
  transformKey: (key: string) => string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => transformKeysDeep(item, transformKey));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const transformed: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    const transformedKey = transformKey(key);

    if (PRESERVED_TRANSFORM_KEYS.has(transformedKey)) {
      transformed[transformedKey] = nestedValue;
      continue;
    }

    transformed[transformedKey] = transformKeysDeep(nestedValue, transformKey);
  }

  return transformed;
}

function toApiPayload<T>(value: T) {
  return value;
}

function toSdkPayload<T>(value: T) {
  return transformKeysDeep(value, toCamelCaseKey) as T;
}

function buildUrl(path: string, query?: object) {
  const normalizedPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);
  const apiQuery = query
    ? (toApiPayload(query) as Record<string, unknown>)
    : undefined;

  if (apiQuery) {
    for (const [key, rawValue] of Object.entries(apiQuery)) {
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

function toKyInput(url: URL) {
  const path = url.pathname.replace(/^\/v1/, "").replace(/^\/+/, "");

  return `${path}${url.search}`;
}

function canRetryTransientRequest(method: string | undefined) {
  return (
    typeof method === "string" &&
    SAFE_TRANSIENT_RETRY_METHODS.has(method.toUpperCase())
  );
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function resolveMaxRateLimitRetries(
  value: number | undefined,
  fallback = DEFAULT_RATE_LIMIT_RETRIES,
) {
  const resolved = value ?? fallback;

  if (!Number.isInteger(resolved) || resolved < 0) {
    throw new ParagraphClientError(
      "`maxRateLimitRetries` must be a non-negative integer.",
    );
  }

  return resolved;
}

function resolveTotalTimeout(timeoutMs: number | undefined) {
  return timeoutMs && timeoutMs > 0 ? timeoutMs : false;
}

function createRetryOptions(limit: number) {
  return {
    limit,
    methods: [...RETRYABLE_METHODS],
    statusCodes: [...RETRYABLE_STATUS_CODES],
    afterStatusCodes: [...RETRY_AFTER_STATUS_CODES],
    retryOnTimeout: false,
    shouldRetry: ({ error }: ShouldRetryState) => {
      if (error instanceof HTTPError) {
        return canRetryTransientRequest(error.request.method)
          ? undefined
          : false;
      }

      return canRetryTransientRequest(
        (error as { request?: Request }).request?.method,
      )
        ? undefined
        : false;
    },
  };
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
    input.fileName ??
    (typeof File !== "undefined" && input.file instanceof File
      ? input.file.name
      : "upload.bin");
  const contentType =
    input.contentType ??
    ("type" in source.value &&
    typeof source.value.type === "string" &&
    source.value.type.length > 0
      ? source.value.type
      : "application/octet-stream");

  if (typeof File !== "undefined") {
    if (source.value instanceof File) {
      if (source.value.name === fileName && source.value.type === contentType) {
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

  formData.append("pageId", input.pageId);

  if (input.alt !== undefined && input.alt !== null) {
    formData.append("alt", input.alt);
  }

  return formData;
}

export class Client {
  private readonly apiKey: string;
  private readonly http: KyInstance;
  private readonly defaultHeaders: Headers;
  private readonly timeoutMs?: number;
  private readonly maxRateLimitRetries: number;

  readonly pages = {
    list: <TQuery extends PageListQuery | undefined = undefined>(
      query?: TQuery,
      options?: RequestOptions,
    ) =>
      this.execute(() => this.listPages(query, options)),
    create: (body: CreatePageRequest = {}, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<PageMutationResult>("POST", "/pages", {
          body,
          options,
        }),
      ),
    get: (pageId: string, query?: GetPageQuery, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<Page>("GET", `/pages/${pageId}`, {
          query,
          options,
        }),
      ),
    getBySlug: (slug: string, options?: RequestOptions) =>
      this.execute(() => this.getPageBySlug(slug, options)),
    update: (
      pageId: string,
      body: UpdatePageRequest,
      options?: RequestOptions,
    ) =>
      this.execute(() =>
        this.requestData<PageMutationResult>("PATCH", `/pages/${pageId}`, {
          body,
          options,
        }),
      ),
    delete: (pageId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<DeleteResult>("DELETE", `/pages/${pageId}`, {
          options,
        }),
      ),
    restore: (pageId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<PageRestoreResult>("POST", `/pages/${pageId}/restore`, {
          options,
        }),
      ),
    permanentlyDelete: (pageId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<PermanentDeleteResult>(
          "DELETE",
          `/pages/${pageId}/permanent`,
          {
            options,
          },
        ),
      ),
    duplicate: (pageId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<PageMutationResult>(
          "POST",
          `/pages/${pageId}/duplicate`,
          {
            options,
          },
        ),
      ),
    createTranslation: (
      pageId: string,
      body: CreatePageTranslationRequest,
      options?: RequestOptions,
    ) =>
      this.execute(() =>
        this.requestData<PageMutationResult>(
          "POST",
          `/pages/${pageId}/translations`,
          {
            body,
            options,
          },
        ),
      ),
  };

  readonly page = {
    get: (pageId: string, query?: GetPageQuery, options?: RequestOptions) =>
      this.pages.get(pageId, query, options),
    getBySlug: (slug: string, options?: RequestOptions) =>
      this.pages.getBySlug(slug, options),
  };

  readonly collections = {
    list: (query?: CollectionListQuery, options?: RequestOptions) =>
      this.execute(() =>
        this.requestList<Collection>("GET", "/collections", {
          query,
          options,
        }),
      ),
    create: (body: CreateCollectionRequest, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<CollectionMutationResult>("POST", "/collections", {
          body,
          options,
        }),
      ),
    get: (collectionId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<Collection>("GET", `/collections/${collectionId}`, {
          options,
        }),
      ),
    update: (
      collectionId: string,
      body: UpdateCollectionRequest,
      options?: RequestOptions,
    ) =>
      this.execute(() =>
        this.requestData<CollectionMutationResult>(
          "PATCH",
          `/collections/${collectionId}`,
          {
            body,
            options,
          },
        ),
      ),
    delete: (collectionId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<DeleteResult>("DELETE", `/collections/${collectionId}`, {
          options,
        }),
      ),
  };

  readonly media = {
    list: (query?: MediaListQuery, options?: RequestOptions) =>
      this.execute(() =>
        this.requestList<Media>("GET", "/media", {
          query,
          options,
        }),
      ),
    upload: (body: UploadMediaRequest, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<MediaUploadResult>("POST", "/media", {
          formData: createUploadFormData(body),
          options,
        }),
      ),
    get: (mediaId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<MediaDetail>("GET", `/media/${mediaId}`, {
          options,
        }),
      ),
    update: (
      mediaId: string,
      body: UpdateMediaRequest,
      options?: RequestOptions,
    ) =>
      this.execute(() =>
        this.requestData<MediaMutationResult>("PATCH", `/media/${mediaId}`, {
          body,
          options,
        }),
      ),
    delete: (mediaId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<MediaDeleteResult>("DELETE", `/media/${mediaId}`, {
          options,
        }),
      ),
  };

  readonly members = {
    list: (query?: MemberListQuery, options?: RequestOptions) =>
      this.execute(() =>
        this.requestList<Member>("GET", "/members", {
          query,
          options,
        }),
      ),
    get: (memberId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.findListItem<Member>(
          "/members",
          (member) => member.id === memberId,
          options,
          {
            code: "memberNotFound",
            message: "Member not found.",
            details: { memberId },
          },
        ),
      ),
  };

  readonly authors = {
    list: (query?: MemberListQuery, options?: RequestOptions) =>
      this.execute(() =>
        this.requestList<Member>("GET", "/authors", {
          query,
          options,
        }),
      ),
    get: (authorId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.findListItem<Member>(
          "/authors",
          (author) => author.id === authorId,
          options,
          {
            code: "authorNotFound",
            message: "Author not found.",
            details: { authorId },
          },
        ),
      ),
  };

  readonly reviewers = {
    list: (query?: MemberListQuery, options?: RequestOptions) =>
      this.execute(() =>
        this.requestList<Member>("GET", "/reviewers", {
          query,
          options,
        }),
      ),
    get: (reviewerId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.findListItem<Member>(
          "/reviewers",
          (reviewer) => reviewer.id === reviewerId,
          options,
          {
            code: "reviewerNotFound",
            message: "Reviewer not found.",
            details: { reviewerId },
          },
        ),
      ),
  };

  readonly statuses = {
    list: (query?: StatusListQuery, options?: RequestOptions) =>
      this.execute(() =>
        this.requestList<Status>("GET", "/statuses", {
          query,
          options,
        }),
      ),
    create: (body: CreateStatusRequest, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<StatusMutationResult>("POST", "/statuses", {
          body,
          options,
        }),
      ),
    get: (statusId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<Status>("GET", `/statuses/${statusId}`, {
          options,
        }),
      ),
    update: (
      statusId: string,
      body: UpdateStatusRequest,
      options?: RequestOptions,
    ) =>
      this.execute(() =>
        this.requestData<StatusMutationResult>("PATCH", `/statuses/${statusId}`, {
          body,
          options,
        }),
      ),
    reorder: (body: ReorderStatusesRequest, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<ReorderResult>("POST", "/statuses/reorder", {
          body,
          options,
        }),
      ),
    delete: (statusId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<DeleteResult>("DELETE", `/statuses/${statusId}`, {
          options,
        }),
      ),
  };

  readonly labels = {
    list: (query?: LabelListQuery, options?: RequestOptions) =>
      this.execute(() =>
        this.requestList<Label>("GET", "/labels", {
          query,
          options,
        }),
      ),
    create: (body: CreateLabelRequest, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<LabelMutationResult>("POST", "/labels", {
          body,
          options,
        }),
      ),
    get: (labelId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<Label>("GET", `/labels/${labelId}`, {
          options,
        }),
      ),
    update: (
      labelId: string,
      body: UpdateLabelRequest,
      options?: RequestOptions,
    ) =>
      this.execute(() =>
        this.requestData<LabelMutationResult>("PATCH", `/labels/${labelId}`, {
          body,
          options,
        }),
      ),
    reorder: (body: ReorderLabelsRequest, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<ReorderResult>("POST", "/labels/reorder", {
          body,
          options,
        }),
      ),
    delete: (labelId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<DeleteResult>("DELETE", `/labels/${labelId}`, {
          options,
        }),
      ),
  };

  readonly dataModels = {
    list: (query?: DataModelListQuery, options?: RequestOptions) =>
      this.execute(() =>
        this.requestList<DataModel>("GET", "/data-models", {
          query,
          options,
        }),
      ),
    create: (body: CreateDataModelRequest, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<DataModelMutationResult>("POST", "/data-models", {
          body,
          options,
        }),
      ),
    get: (dataModelId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<DataModel>("GET", `/data-models/${dataModelId}`, {
          options,
        }),
      ),
    update: (
      dataModelId: string,
      body: UpdateDataModelRequest,
      options?: RequestOptions,
    ) =>
      this.execute(() =>
        this.requestData<DataModelMutationResult>(
          "PATCH",
          `/data-models/${dataModelId}`,
          {
            body,
            options,
          },
        ),
      ),
    delete: (dataModelId: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<DeleteResult>("DELETE", `/data-models/${dataModelId}`, {
          options,
        }),
      ),
  };

  readonly locales = {
    list: (options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<Locale[]>("GET", "/locales", {
          options,
        }),
      ),
    getDefaultLocale: (options?: RequestOptions) =>
      this.execute(async () => {
        const response = await this.requestData<{ defaultLocale: string }>(
          "GET",
          "/locales/default",
          {
            options,
          },
        );

        return response.defaultLocale;
      }),
    get: (code: string, options?: RequestOptions) =>
      this.execute(() =>
        this.findArrayItem<Locale>(
          "/locales",
          (locale) => locale.code === code,
          options,
          {
            code: "localeNotFound",
            message: "Locale not found.",
            details: { code },
          },
        ),
      ),
    create: (body: CreateLocaleRequest, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<LocaleMutationResult>("POST", "/locales", {
          body,
          options,
        }),
      ),
    delete: (code: string, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<DeleteByCodeResult>("DELETE", `/locales/${code}`, {
          options,
        }),
      ),
  };

  readonly ai = {
    generateMetaName: (body: GenerateMetaRequest, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<AiMetaNameResult>("POST", "/ai/meta-name", {
          body,
          options,
        }),
      ),
    generateMetaDescription: (
      body: GenerateMetaRequest,
      options?: RequestOptions,
    ) =>
      this.execute(() =>
        this.requestData<AiMetaDescriptionResult>(
          "POST",
          "/ai/meta-description",
          {
            body,
            options,
          },
        ),
      ),
    generateContent: (body: GenerateContentRequest, options?: RequestOptions) =>
      this.execute(() =>
        this.requestData<AiContentResult>("POST", "/ai/content", {
          body,
          options,
        }),
      ),
  };

  constructor(options: ClientOptions) {
    if (
      "baseUrl" in (options as ClientOptions & { baseUrl?: unknown }) ||
      "apiUrl" in (options as ClientOptions & { apiUrl?: unknown })
    ) {
      throw new ParagraphClientError(
        "`baseUrl` and `apiUrl` are not supported. The client always uses the official Paragraph CMS API endpoint.",
      );
    }

    if (typeof options.apiKey !== "string" || !options.apiKey.trim()) {
      throw new ParagraphClientError("`apiKey` is required.");
    }

    this.apiKey = options.apiKey.trim();
    this.defaultHeaders = new Headers(options.headers);
    this.timeoutMs = options.timeoutMs;
    this.maxRateLimitRetries = resolveMaxRateLimitRetries(
      options.maxRateLimitRetries,
    );
    const fetchImpl = resolveFetchImplementation(options.fetch);
    const limiter = new RequestRateLimiter(
      options.maxRequestsPerSecond ?? DEFAULT_REQUESTS_PER_SECOND,
    );
    this.http = ky.create({
      fetch: (input, init) => limiter.schedule(() => fetchImpl(input, init)),
      prefix: API_BASE_URL,
      timeout: false,
    });
  }

  getInfo(options?: RequestOptions) {
    return this.execute(() => this.requestData<ApiInfo>("GET", "", { options }));
  }

  private async listPages<TQuery extends PageListQuery | undefined>(
    query?: TQuery,
    options?: RequestOptions,
  ): Promise<ListResponse<PageListItem<TQuery>>> {
    const pageListQuery = this.createPageListQuery(query, {
      defaultHasPublished: true,
    });
    const response = await this.requestList<PageSummary>("GET", "/pages", {
      query: pageListQuery,
      options,
    });

    if (
      pageListQuery.limit !== undefined ||
      pageListQuery.page !== undefined ||
      !response.meta.hasNextPage
    ) {
      return response as ListResponse<PageListItem<TQuery>>;
    }

    const items = [...response.data];
    let nextPage = response.meta.page + 1;
    let lastMeta = response.meta;

    while (lastMeta.hasNextPage) {
      const nextResponse = await this.requestList<PageSummary>(
        "GET",
        "/pages",
        {
          query: {
            ...pageListQuery,
            page: nextPage,
            limit: lastMeta.limit,
          },
          options,
        },
      );

      items.push(...nextResponse.data);
      lastMeta = nextResponse.meta;
      nextPage = lastMeta.page + 1;
    }

    return {
      data: items,
      meta: {
        page: 1,
        limit: items.length,
        totalItems: items.length,
        totalPages: items.length > 0 ? 1 : 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    } as ListResponse<PageListItem<TQuery>>;
  }

  private createPageListQuery(
    query?: PageListQuery,
    config?: {
      defaultHasPublished?: boolean;
    },
  ): PageListQuery {
    const { requiredSlug, hasPublished, published, ...restQuery } = query ?? {};
    const resolvedPublished =
      hasPublished ??
      published ??
      (config?.defaultHasPublished === true ? true : undefined);

    return {
      ...restQuery,
      includeContent: restQuery.includeContent ?? false,
      ...(resolvedPublished !== undefined
        ? { published: resolvedPublished }
        : {}),
      ...(requiredSlug === true ? { requiredSlug: true } : {}),
    };
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

  private async execute<T>(
    run: () => Promise<T>,
  ): Promise<ClientResult<T, ParagraphError>> {
    try {
      return {
        data: await run(),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: this.normalizeError(error),
      };
    }
  }

  private async getPageBySlug(
    slug: string,
    options?: RequestOptions,
  ): Promise<PageWithSlug> {
    const query = this.createPageListQuery({ slug, requiredSlug: true });
    const page = await this.findListItem<PageSummaryWithSlug>(
      "/pages",
      (item) => item.slug === slug,
      options,
      {
        code: "pageNotFound",
        message: "Page not found.",
        details: { slug },
      },
      query,
    );

    const resolvedPage = await this.requestData<Page>("GET", `/pages/${page.id}`, {
      options,
    });

    return this.requirePageWithSlug(resolvedPage, slug);
  }

  private requirePageWithSlug(
    page: Page,
    expectedSlug: string,
  ): PageWithSlug {
    if (page.slug === null || page.slug !== expectedSlug) {
      throw new ParagraphClientError(
        `Page fetched by slug returned inconsistent slug data for "${expectedSlug}".`,
      );
    }

    return page as PageWithSlug;
  }

  private async findListItem<T>(
    path: string,
    predicate: (item: T) => boolean,
    options: RequestOptions | undefined,
    error: {
      code: string;
      message: string;
      details?: unknown;
    },
    query?: object,
  ) {
    let page = 1;

    while (true) {
      const response = await this.requestList<T>("GET", path, {
        query: {
          ...(query ?? {}),
          page,
          limit: LOOKUP_PAGE_SIZE,
        },
        options,
      });
      const match = response.data.find(predicate);

      if (match) {
        return match;
      }

      if (!response.meta.hasNextPage) {
        break;
      }

      page += 1;
    }

    throw this.createLookupError("GET", path, {
      query: {
        ...(query ?? {}),
        page,
        limit: LOOKUP_PAGE_SIZE,
      },
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  private async findArrayItem<T>(
    path: string,
    predicate: (item: T) => boolean,
    options: RequestOptions | undefined,
    error: {
      code: string;
      message: string;
      details?: unknown;
    },
  ) {
    const items = await this.requestData<T[]>("GET", path, {
      options,
    });
    const match = items.find(predicate);

    if (match) {
      return match;
    }

    throw this.createLookupError("GET", path, {
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  private createLookupError(
    method: HttpMethod,
    path: string,
    config: {
      query?: object;
      code: string;
      message: string;
      details?: unknown;
    },
  ) {
    return new ParagraphApiError({
      status: 404,
      code: config.code,
      message: config.message,
      details: config.details,
      request: createRequestDescriptor(method, buildUrl(path, config.query)),
    });
  }

  private normalizeError(error: unknown): ParagraphError {
    if (
      error instanceof ParagraphApiError ||
      error instanceof ParagraphClientError
    ) {
      return error;
    }

    return new ParagraphClientError(
      error instanceof Error && error.message ? error.message : "Request failed.",
      {
        cause: error,
      },
    );
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
    const url = buildUrl(path, config?.query);
    const kyInput = toKyInput(url);
    const request = createRequestDescriptor(method, url);
    const headers = new Headers(this.defaultHeaders);
    const timeoutMs = config?.options?.timeoutMs ?? this.timeoutMs;
    const maxRateLimitRetries = resolveMaxRateLimitRetries(
      config?.options?.maxRateLimitRetries,
      this.maxRateLimitRetries,
    );

    headers.set("accept", "application/json");

    if (!headers.has("x-api-key") && !headers.has("authorization")) {
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

      body = JSON.stringify(toApiPayload(config.body));
    }

    const optionHeaders = new Headers(config?.options?.headers);

    for (const [key, value] of optionHeaders.entries()) {
      headers.set(key, value);
    }

    if (config?.formData) {
      headers.delete("content-type");
    }

    return (async () => {
      try {
        const response = await this.http(kyInput, {
          method,
          headers,
          body,
          signal: config?.options?.signal,
          timeout: false,
          totalTimeout: resolveTotalTimeout(timeoutMs),
          retry: createRetryOptions(maxRateLimitRetries),
        });
        const payload = await parseResponse(response);

        return toSdkPayload(payload) as T;
      } catch (error) {
        if (error instanceof HTTPError) {
          const responseHeaders = new Headers(error.response.headers);
          const payload = error.data;

          throw isApiErrorPayload(payload)
            ? new ParagraphApiError({
                body: toSdkPayload(payload),
                status: error.response.status,
                code: payload.error.code,
                message: payload.error.message,
                details: toSdkPayload(payload.error.details),
                headers: responseHeaders,
                request,
              })
            : new ParagraphApiError({
                status: error.response.status,
                code:
                  error.response.status === 401
                    ? "unauthorized"
                    : "requestFailed",
                message:
                  typeof payload === "string" && payload.length > 0
                    ? payload
                    : error.response.statusText || "Request failed.",
                headers: responseHeaders,
                request,
              });
        }

        if (error instanceof TimeoutError) {
          throw new ParagraphClientError(
            `Request timed out after ${timeoutMs}ms.`,
            {
              request,
              cause: error,
            },
          );
        }

        if (isAbortError(error) || config?.options?.signal?.aborted) {
          throw new ParagraphClientError("Request aborted.", {
            request,
            cause: error,
          });
        }

        throw new ParagraphClientError("Request failed.", {
          request,
          cause: error,
        });
      }
    })();
  }
}
