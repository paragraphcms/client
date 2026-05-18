# @paragraphcms/client

Official TypeScript client for the Paragraph CMS v1 API.

<!--
Replace this block with the README image.

<p align="center">
  <img src="./assets/paragraph-client.png" alt="@paragraphcms/client" />
</p>
-->

`@paragraphcms/client` is a small, typed SDK built on top of the standard Fetch API. It runs in Node.js 18+ and other server-side runtimes that expose `fetch`.

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

### Get All Pages or Pages From a Collection

```ts
const { data: allPages, meta } = await client.pages.list();

const { data: collectionPages } = await client.pages.list({
  collection_id: "collection-id",
});

console.log(meta.total_items);
console.log(collectionPages.map((page) => page.title));
```

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
