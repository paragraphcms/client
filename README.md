# Paragraph CMS Client

Official TypeScript client for the Paragraph CMS v1 API.

The package is built on top of the standard Fetch API, so it works in modern Node.js, Cloudflare Workers, Next.js route handlers/server actions, AWS Lambda, and other server-side JavaScript runtimes that expose `fetch`, `Headers`, `FormData`, `Blob`, and `AbortController`.

## Features

- Full coverage for the current Paragraph CMS v1 API surface.
- `new Client({ apiKey })` entrypoint with a small, typed SDK.
- Built-in request queue that rate-limits each client instance to `5 req/s` by default.
- Runtime-agnostic implementation with no runtime dependencies.
- First-class TypeScript types for request payloads, responses, list metadata, and API errors.
- Request cancellation with `AbortSignal`.

## Installation

```bash
npm install @paragraphcms/client
```

## Quick Start

```ts
import { Client } from "@paragraphcms/client";

const client = new Client({
  apiKey: process.env.PARAGRAPH_API_KEY!,
});

const pages = await client.pages.list({
  limit: 20,
  include_content: false,
  sort: "-updated_at",
});

const created = await client.pages.create({
  title: "Pricing",
  language: "en",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Pricing" }],
    },
  ],
});

console.log(pages.meta.total_items);
console.log(created.page.id);
```

## Runtime Notes

- The default API base URL is `https://api.paragraphcms.com/v1`.
- If you pass `baseUrl: "https://api.paragraphcms.com"`, the client automatically normalizes it to `https://api.paragraphcms.com/v1`.
- The client uses `x-api-key` authentication by default.
- Field names in request and response payloads intentionally mirror the HTTP API. That means body/query keys stay in `snake_case`.

## Rate Limiting

Paragraph CMS v1 is rate-limited to `5 req/s`. Each `Client` instance contains an internal queue that spaces request starts so the instance does not exceed that budget by default.

Important details:

- The limiter is per client instance, not global across all containers, lambdas, or workers.
- If your app creates many `Client` instances, each instance will maintain its own queue.
- The safest pattern is to reuse one shared `Client` instance per process or isolate when possible.

You can override the per-instance limit if you need a lower ceiling:

```ts
const client = new Client({
  apiKey: process.env.PARAGRAPH_API_KEY!,
  maxRequestsPerSecond: 3,
});
```

## Configuration

```ts
type ClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  headers?: HeadersInit;
  timeoutMs?: number;
  maxRequestsPerSecond?: number;
};
```

### `apiKey`

Required. Paragraph CMS organization API key.

### `baseUrl`

Optional. Defaults to `https://api.paragraphcms.com/v1`.

Examples:

- `https://api.paragraphcms.com/v1`
- `https://api.paragraphcms.com`
- `http://localhost:3001/v1`

### `fetch`

Optional custom fetch implementation. Useful in tests or custom runtimes.

### `headers`

Optional default headers added to every request.

### `timeoutMs`

Optional default request timeout in milliseconds. Per-call options can override it.

### `maxRequestsPerSecond`

Optional per-client limiter ceiling. Defaults to `5`.

## Per-Request Options

Every SDK method accepts an optional last argument:

```ts
type RequestOptions = {
  signal?: AbortSignal;
  headers?: HeadersInit;
  timeoutMs?: number;
};
```

Example:

```ts
const controller = new AbortController();

const page = await client.pages.get("page-id", undefined, {
  signal: controller.signal,
  timeoutMs: 10_000,
});
```

## Error Handling

The client throws `ParagraphApiError` for non-2xx API responses and `ParagraphClientError` for local runtime/configuration problems.

```ts
import { Client, ParagraphApiError } from "@paragraphcms/client";

const client = new Client({
  apiKey: process.env.PARAGRAPH_API_KEY!,
});

try {
  await client.pages.get("missing-id");
} catch (error) {
  if (error instanceof ParagraphApiError) {
    console.error(error.status);
    console.error(error.code);
    console.error(error.message);
    console.error(error.details);
  }
}
```

## Return Shapes

- Single-resource endpoints return the unwrapped `data` payload.
- Paginated endpoints return `{ data, meta }`.
- `locales.list()` returns a plain `Locale[]` because the API endpoint itself is not paginated.

## API Surface

### Root

```ts
client.getInfo()
```

Returns the public `/v1` info payload:

```ts
{
  version: "v1",
  openapi_url: "/v1/openapi.json",
  authentication: {
    type: "api_key",
    supported_headers: ["x-api-key", "authorization"],
    authorization_format: "Bearer <api-key>",
  },
  resources: [...]
}
```

### Pages

```ts
client.pages.list(query?, options?)
client.pages.create(body?, options?)
client.pages.get(pageId, query?, options?)
client.pages.update(pageId, body, options?)
client.pages.delete(pageId, options?)
client.pages.restore(pageId, options?)
client.pages.permanentlyDelete(pageId, options?)
client.pages.duplicate(pageId, options?)
client.pages.createTranslation(pageId, body, options?)
```

Supported `sort` fields for `pages.list()`:

- `title`
- `language`
- `created_at`
- `updated_at`
- `published_at`

Notes:

- `label_id` is passed as `string[]` in the SDK and serialized to the API CSV format automatically.
- `content` is present in page list results only when `include_content: true`.
- Page responses should be treated as Tiptap JSON arrays. `content_format` is no longer required in the response shape.

### Collections

```ts
client.collections.list(query?, options?)
client.collections.create(body, options?)
client.collections.get(collectionId, options?)
client.collections.update(collectionId, body, options?)
client.collections.delete(collectionId, options?)
```

Supported `sort` fields for `collections.list()`:

- `name`
- `page_count`
- `last_modified_at`

### Media

```ts
client.media.list(query?, options?)
client.media.upload(body, options?)
client.media.get(mediaId, options?)
client.media.update(mediaId, body, options?)
client.media.delete(mediaId, options?)
```

Supported `sort` fields for `media.list()`:

- `file_name`
- `size`
- `created_at`
- `updated_at`

`media.upload()` accepts:

- `File`
- `Blob`
- `ArrayBuffer`
- Typed arrays like `Uint8Array`
- Node.js `Buffer`

Example:

```ts
const file = new File([imageBytes], "hero.png", {
  type: "image/png",
});

const upload = await client.media.upload({
  file,
  page_id: "page-id",
  alt: "Homepage hero",
});
```

If you upload from a raw `Buffer`, `Uint8Array`, or `ArrayBuffer`, you can also pass `file_name` and `content_type`:

```ts
await client.media.upload({
  file: imageBuffer,
  file_name: "hero.png",
  content_type: "image/png",
  page_id: "page-id",
});
```

### Members, Authors, Reviewers

```ts
client.members.list(query?, options?)
client.authors.list(query?, options?)
client.reviewers.list(query?, options?)
```

Supported `sort` fields:

- `name`
- `email`
- `created_at`

`authors` and `reviewers` are aliases of the member listing endpoints exposed by the API.

### Statuses

```ts
client.statuses.list(query?, options?)
client.statuses.create(body, options?)
client.statuses.get(statusId, options?)
client.statuses.update(statusId, body, options?)
client.statuses.reorder(body, options?)
client.statuses.delete(statusId, options?)
```

Supported `sort` fields for `statuses.list()`:

- `type`
- `order`
- `name`
- `created_at`

### Labels

```ts
client.labels.list(query?, options?)
client.labels.create(body, options?)
client.labels.get(labelId, options?)
client.labels.update(labelId, body, options?)
client.labels.reorder(body, options?)
client.labels.delete(labelId, options?)
```

Supported `sort` fields for `labels.list()`:

- `order`
- `name`
- `created_at`

### Data Models

```ts
client.dataModels.list(query?, options?)
client.dataModels.create(body, options?)
client.dataModels.get(dataModelId, options?)
client.dataModels.update(dataModelId, body, options?)
client.dataModels.delete(dataModelId, options?)
```

Supported `sort` fields for `dataModels.list()`:

- `name`
- `created_at`
- `updated_at`

### Locales

```ts
client.locales.list(options?)
client.locales.create(body, options?)
client.locales.delete(code, options?)
```

### AI

```ts
client.ai.generateMetaName(body, options?)
client.ai.generateMetaDescription(body, options?)
client.ai.generateContent(body, options?)
```

## End-to-End Examples

### Create a page and upload its hero image

```ts
const pageResult = await client.pages.create({
  title: "About",
  language: "en",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "About" }],
    },
  ],
});

await client.media.upload({
  file: heroBytes,
  file_name: "about-hero.png",
  content_type: "image/png",
  page_id: pageResult.page.id,
  alt: "About page hero image",
});
```

### Create a translated page variant

```ts
await client.pages.createTranslation("page-id", {
  language: "de",
  mode: "translate",
  model: "openai/gpt-5.4",
});
```

### Generate SEO fields with AI

```ts
const generatedMeta = await client.ai.generateMetaDescription({
  model: "openai/gpt-5.4",
  title: "Platform overview",
  content: [],
});

console.log(generatedMeta.meta_description);
```

## Exported Types

The package exports the `Client` class, both error classes, and the main request/response/domain types used by the SDK, including:

- `ClientOptions`
- `RequestOptions`
- `ListResponse`
- `PaginationMeta`
- `Page`
- `PageSummary`
- `Collection`
- `Media`
- `MediaDetail`
- `Status`
- `Label`
- `DataModel`
- `Locale`
- `Member`
- `CreatePageRequest`
- `UpdatePageRequest`
- `UploadMediaRequest`
- `GenerateContentRequest`

## Testing

The repository contains two test layers:

- Unit tests for request serialization, multipart uploads, error handling, and rate limiting.
- Live integration tests that create, update, fetch, reorder, delete, and clean up real resources against the Paragraph API.

Commands:

```bash
npm test
npm run test:unit
npm run test:integration
```

Environment variables for integration tests:

- `PARAGRAPH_API_KEY` required to run live API tests.
- `PARAGRAPH_API_BASE_URL` optional override for local/staging API targets.
- `PARAGRAPH_AI_MODEL` optional model id for AI endpoint tests. When omitted, AI integration tests are skipped.

The integration suite is self-contained and generates its own resources, so it does not rely on any existing content in the target organization.

## Requirements

- Node.js `18+` for direct Node usage.
- A runtime with standard Fetch API primitives for edge/serverless usage.

## License

ISC
