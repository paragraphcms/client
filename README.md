# @paragraphcms/client

Official TypeScript client for the Paragraph CMS API.

<!--
Replace this block with the README image.

<p align="center">
  <img src="./assets/paragraph-client.png" alt="@paragraphcms/client" />
</p>
-->

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

### Get Published Pages or Pages From a Collection

```ts
const { data: publishedPages, meta } = await client.pages.list();

const { data: allPages } = await client.pages.list({
  hasPublished: false,
});

const { data: collectionPages } = await client.pages.list({
  collection: "Blog",
});

const { data: collectionPagesById } = await client.pages.list({
  collectionId: "collection-id",
});

const { data: pagesWithSlugs } = await client.page.list({
  requiredSlug: true,
});

console.log(meta.totalItems);
console.log(publishedPages.map((page) => page.title));
console.log(allPages.map((page) => page.title));
console.log(collectionPages.map((page) => page.title));
console.log(collectionPagesById.map((page) => page.title));
console.log(pagesWithSlugs.map((page) => page.slug));
```

`client.pages.list()` now returns only published pages by default. To include unpublished pages, pass `hasPublished: false`.

### Get a Page by Slug

```ts
const page = await client.pages.getBySlug("pricing");

console.log(page.id);
console.log(page.title);
```

### Get All Supported Languages

```ts
const locales = await client.locales.list();

console.log(locales.map((locale) => locale.code));
```

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
