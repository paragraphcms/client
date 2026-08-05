# @paragraphcms/client

Official TypeScript client for the Paragraph CMS API.

<p align="center">
  <img src="./assets/paragraphcms-client-hero.jpg" alt="@paragraphcms/client" />
</p>

`@paragraphcms/client` is a small, typed SDK for the Paragraph CMS API. It runs in Node.js 18+ and other server-side runtimes that expose `fetch`.

Internally, the client uses `ky` for HTTP transport and retries, plus `Bottleneck` for per-instance rate limiting.

## Install

```bash
npm install @paragraphcms/client
# or
pnpm add @paragraphcms/client
# or
yarn add @paragraphcms/client
```

## Quick Start

Create a client instance with your API key:

```ts
import { Client } from "@paragraphcms/client";

const client = new Client({
  apiKey: process.env.PARAGRAPH_API_KEY!,
});
```

Every client method returns a non-throwing result object:

```ts
const { data, error } = await client.page.getBySlug("pricing");

if (error) {
  console.error(error.message);
  return;
}

console.log(data.title);
```

On success, `error` is `null`. On failure, `data` is `null` and `error` is a `ParagraphApiError` or `ParagraphClientError`.

### List Pages by Publication, Status, Collection, or Category

```ts
const { data: publishedPages, error: publishedPagesError } = await client.pages.list({
  published: true,
});

const { data: unpublishedPages, error: unpublishedPagesError } =
  await client.pages.list({ published: false });

const { data: pagesPublishedIn2026, error: publicationWindowError } =
  await client.pages.list({
    publishedAfter: "2026-01-01T00:00:00.000Z",
    publishedBefore: "2026-12-31T23:59:59.999Z",
  });

const { data: pagesWithPublishedStatus, error: statusError } =
  await client.pages.list({ statusType: "published" });

const { data: collectionPages, error: collectionPagesError } =
  await client.pages.list({
  collection: "Blog",
});

const { data: collectionPagesById, error: collectionPagesByIdError } =
  await client.pages.list({
  collectionId: "collection-id",
});

const { data: guidePages, error: guidePagesError } = await client.pages.list({
  collectionId: "collection-id",
  category: "Guides",
});

const { data: pagesWithSlugs, error: pagesWithSlugsError } =
  await client.pages.list({
  requiredSlug: true,
});

if (
  publishedPagesError ||
  unpublishedPagesError ||
  publicationWindowError ||
  statusError ||
  collectionPagesError ||
  collectionPagesByIdError ||
  guidePagesError ||
  pagesWithSlugsError
) {
  console.error("Request failed.");
  return;
}

console.log(publishedPages.length);
console.log(publishedPages.map((page) => page.title));
console.log(unpublishedPages.map((page) => page.title));
console.log(pagesPublishedIn2026.map((page) => page.publishedAt));
console.log(pagesWithPublishedStatus.map((page) => page.status?.name));
console.log(collectionPages.map((page) => page.title));
console.log(collectionPagesById.map((page) => page.title));
console.log(guidePages.map((page) => page.title));
console.log(pagesWithSlugs.map((page) => page.slug.toUpperCase()));
```

Every page exposes `publishedAt`. Page lists support `published`, `publishedAfter`, and `publishedBefore`; the legacy SDK alias `hasPublished` is also accepted and mapped to `published`. `client.pages.list()` defaults to `published: true`, while `published: false` returns pages without a publication date. Status filtering remains independently available through `statusType: "published"`.
When neither `page` nor `limit` is passed, `client.pages.list()` fetches every matching API page and returns the pages array directly. Pass `page` or `limit` to receive a paginated response with `data` and `meta`.
Passing `requiredSlug: true` also narrows `page.slug` to `string` in TypeScript.

### Manage Collection Categories

Categories belong to a collection and can then be assigned to its pages.

```ts
const created = await client.collections.create({
  name: "Knowledge Base",
  categories: ["Guides", "Release notes"],
});

if (created.error) {
  console.error(created.error.message);
  return;
}

await client.collections.categories.add(created.data.collection.id, "News");
await client.collections.categories.set(created.data.collection.id, ["Guides", "News"]);
await client.collections.categories.remove(created.data.collection.id, "News");
```

### Get a Page by Slug

```ts
const { data: page, error } = await client.page.getBySlug("pricing");

if (error) {
  console.error(error.message);
  return;
}

console.log(page.id);
console.log(page.title);
console.log(page.slug.toUpperCase());
```

### Run Common Page Workflows

```ts
const translation = await client.pages.translate("page-id", {
  language: "pl",
  model: "openai/gpt-5",
});

const statusChange = await client.pages.setStatus("page-id", "status-id");
const collectionChange = await client.pages.setCollection("page-id", null);

const rewritten = await client.pages.generateContent("page-id", {
  model: "openai/gpt-5",
  prompt: "Rewrite the intro for enterprise buyers.",
});

if (
  translation.error ||
  statusChange.error ||
  collectionChange.error ||
  rewritten.error
) {
  console.error("Request failed.");
  return;
}

console.log(translation.data.page.language);
console.log(statusChange.data.page.statusId);
console.log(collectionChange.data.page.collectionId);
console.log(rewritten.data.title);
```

### Generate SEO and Hero Metadata

```ts
const metaName = await client.ai.generateMetaName({
  model: "openai/gpt-5",
  title: "Enterprise Pricing",
  content: [],
});

const metaDescription = await client.ai.generateMetaDescription({
  model: "openai/gpt-5",
  title: "Enterprise Pricing",
  content: [],
});

const heroSlug = await client.ai.generateImageSlug({
  model: "openai/gpt-5",
  caption: "Team presenting the dashboard.",
});

const heroCaption = await client.ai.generateImageCaption({
  model: "openai/gpt-5",
  slug: "team-dashboard-hero",
});

const heroAlt = await client.ai.generateImageAlt({
  model: "openai/gpt-5",
  caption: "Team presenting the dashboard.",
});

const pageSlug = await client.ai.generatePageSlug({
  title: "Enterprise Pricing",
});
```

### Get All Supported Languages

```ts
const { data: locales, error } = await client.locales.list();

if (error) {
  console.error(error.message);
  return;
}

console.log(locales.map((locale) => locale.code));
```

### Upload Media

```ts
const { data: uploadedMedia, error: uploadError } = await client.media.upload({
  file: imageBuffer,
  fileName: "hero.png",
  contentType: "image/png",
  pageId: "page-id",
  slug: "hero-image",
  alt: "Team presenting the product dashboard",
  caption: "The Paragraph dashboard during a team presentation.",
});

if (uploadError) {
  console.error(uploadError.message);
  return;
}

console.log(uploadedMedia.editorNode.attrs.slug);
console.log(uploadedMedia.editorNode.attrs.alt);
console.log(uploadedMedia.editorNode.attrs.caption);
```

Image `slug`, `alt`, and `caption` belong to the returned Tiptap node and page content, not to the media resource itself.

## Framework Guides

Build with:

- [Next.js](https://paragraphcms.com)
- [Nuxt](https://paragraphcms.com)
- [Astro](https://paragraphcms.com)
- [SvelteKit](https://paragraphcms.com)
- [Remix](https://paragraphcms.com)

## Documentation

For full guides and API reference, see [paragraphcms.com](https://paragraphcms.com).

## License

MIT
