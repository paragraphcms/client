import assert from "node:assert/strict";
import test from "node:test";

import {
  Client,
  ParagraphApiError,
  ParagraphClientError,
} from "../dist/index.js";
import { expectError, expectOk } from "./_helpers.mjs";

function toRequest(input, init) {
  return input instanceof Request ? input : new Request(input, init);
}

async function readJsonBody(request) {
  const text = await request.clone().text();
  return text ? JSON.parse(text) : null;
}

test("Client requires an API key", () => {
  assert.throws(() => new Client({ apiKey: "   " }), ParagraphClientError);
});

test("Client preserves publication and category filters", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      calls.push(toRequest(input, init));
      return Response.json({
        data: [],
        meta: {
          page: 1,
          limit: 20,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    },
  });

  await expectOk(
    client.pages.list({
      includeContent: true,
      labelIds: ["label-a", "label-b"],
      deleted: "include",
      published: false,
      publishedAfter: "2026-01-01T00:00:00.000Z",
      publishedBefore: "2026-12-31T23:59:59.999Z",
      category: "Guides",
    }),
  );

  assert.equal(calls.length, 1);
  const [request] = calls;
  const url = new URL(request.url);

  assert.equal(
    url.origin + url.pathname,
    "https://api.paragraphcms.com/v1/pages",
  );
  assert.equal(url.searchParams.get("includeContent"), "true");
  assert.equal(url.searchParams.get("labelIds"), "label-a,label-b");
  assert.equal(url.searchParams.get("deleted"), "include");
  assert.equal(url.searchParams.get("category"), "Guides");
  assert.equal(url.searchParams.get("published"), "false");
  assert.equal(
    url.searchParams.get("publishedAfter"),
    "2026-01-01T00:00:00.000Z",
  );
  assert.equal(
    url.searchParams.get("publishedBefore"),
    "2026-12-31T23:59:59.999Z",
  );
  assert.equal(url.searchParams.get("page"), null);
  assert.equal(url.searchParams.get("limit"), null);
  assert.equal(request.method, "GET");
  assert.equal(request.headers.get("x-api-key"), "test-key");
  assert.equal(request.headers.get("accept"), "application/json");
});

test("Client maps the legacy hasPublished filter to published", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      calls.push(new URL(toRequest(input, init).url));
      return Response.json({
        data: [],
        meta: {
          page: 1,
          limit: 20,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    },
  });

  await expectOk(client.pages.list({ hasPublished: false }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get("published"), "false");
  assert.equal(calls[0].searchParams.get("hasPublished"), null);
});

test("Client rejects baseUrl and apiUrl overrides", () => {
  assert.throws(
    () =>
      new Client({
        apiKey: "test-key",
        baseUrl: "https://example.com",
      }),
    (error) => {
      assert.equal(error instanceof ParagraphClientError, true);
      assert.equal(
        error.message,
        "`baseUrl` and `apiUrl` are not supported. The client always uses the official Paragraph CMS API endpoint.",
      );
      return true;
    },
  );

  assert.throws(
    () =>
      new Client({
        apiKey: "test-key",
        apiUrl: "https://example.com",
      }),
    ParagraphClientError,
  );
});

test("pages.list preserves collection and collectionId query params", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      const url = new URL(toRequest(input, init).url);
      calls.push(url);

      return Response.json({
        data: [],
        meta: {
          page: 1,
          limit: 20,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    },
  });

  await expectOk(
    client.pages.list({
      collection: "Blog",
      collectionId: "collection-123",
      category: "Guides",
    }),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get("collection"), "Blog");
  assert.equal(calls[0].searchParams.get("collectionId"), "collection-123");
  assert.equal(calls[0].searchParams.get("category"), "Guides");
  assert.equal(calls[0].searchParams.get("published"), "true");
  assert.equal(calls[0].searchParams.get("requiredSlug"), null);
  assert.equal(
    Array.from(calls[0].searchParams.keys()).some((key) => key.includes("_")),
    false,
  );
});

test("pages.list without explicit pagination aggregates every API page", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      const url = new URL(toRequest(input, init).url);
      calls.push(url);

      const page = Number(url.searchParams.get("page") ?? "1");

      return Response.json({
        data:
          page === 1
            ? [
                { id: "page-1", title: "Page 1", slug: "page-1" },
                { id: "page-2", title: "Page 2", slug: "page-2" },
              ]
            : [{ id: "page-3", title: "Page 3", slug: "page-3" }],
        meta: {
          page,
          limit: 2,
          totalItems: 3,
          totalPages: 2,
          hasNextPage: page === 1,
          hasPrevPage: page > 1,
        },
      });
    },
  });

  const listed = await expectOk(client.pages.list({ deleted: "include" }));

  assert.equal(calls.length, 2);
  assert.equal(Array.isArray(listed), true);
  assert.equal(calls[0].searchParams.get("includeContent"), "false");
  assert.equal(calls[0].searchParams.get("deleted"), "include");
  assert.equal(calls[0].searchParams.get("published"), "true");
  assert.equal(calls[0].searchParams.get("page"), null);
  assert.equal(calls[0].searchParams.get("limit"), null);
  assert.equal(calls[1].searchParams.get("includeContent"), "false");
  assert.equal(calls[1].searchParams.get("deleted"), "include");
  assert.equal(calls[1].searchParams.get("published"), "true");
  assert.equal(calls[1].searchParams.get("page"), "2");
  assert.equal(calls[1].searchParams.get("limit"), "2");
  assert.deepEqual(
    listed.map((page) => page.id),
    ["page-1", "page-2", "page-3"],
  );
  assert.equal(listed.meta, undefined);
});

test("pages.list with explicit pagination preserves the list response meta", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      const url = new URL(toRequest(input, init).url);
      calls.push(url);

      return Response.json({
        data: [
          { id: "page-1", title: "Page 1", slug: "page-1" },
          { id: "page-2", title: "Page 2", slug: "page-2" },
        ],
        meta: {
          page: 1,
          limit: 2,
          totalItems: 3,
          totalPages: 2,
          hasNextPage: true,
          hasPrevPage: false,
        },
      });
    },
  });

  const listed = await expectOk(client.pages.list({ limit: 2 }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get("includeContent"), "false");
  assert.equal(calls[0].searchParams.get("published"), "true");
  assert.equal(calls[0].searchParams.get("limit"), "2");
  assert.equal(Array.isArray(listed.data), true);
  assert.equal(listed.data.length, 2);
  assert.equal(listed.meta.totalItems, 3);
  assert.equal(listed.meta.hasNextPage, true);
});

test("collection category helpers use the collection category API", async () => {
  const calls = [];
  const collection = {
    id: "collection-1",
    name: "Docs",
    description: null,
    defaultDataModelId: null,
    categories: ["Guides"],
    teamIds: [],
    pageCount: 0,
    lastModifiedAt: null,
    defaultDataModel: null,
  };
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      const request = toRequest(input, init);
      calls.push({
        request,
        body: await readJsonBody(request),
      });
      const url = new URL(request.url);

      if (request.method === "GET") {
        return Response.json({ data: collection });
      }

      return Response.json({
        data: {
          message: "Collection updated.",
          collection,
        },
      });
    },
  });

  const listed = await expectOk(client.collections.categories.list("collection-1"));
  await expectOk(client.collections.categories.set("collection-1", ["Guides", "News"]));
  await expectOk(client.collections.categories.add("collection-1", "News"));
  await expectOk(client.collections.categories.remove("collection-1", "Release notes"));

  assert.deepEqual(listed, ["Guides"]);
  assert.equal(calls.length, 4);
  assert.equal(calls[0].request.method, "GET");
  assert.equal(
    new URL(calls[0].request.url).pathname,
    "/v1/collections/collection-1",
  );
  assert.equal(calls[1].request.method, "PATCH");
  assert.deepEqual(calls[1].body, {
    categories: ["Guides", "News"],
  });
  assert.equal(calls[2].request.method, "POST");
  assert.equal(
    new URL(calls[2].request.url).pathname,
    "/v1/collections/collection-1/categories",
  );
  assert.deepEqual(calls[2].body, { category: "News" });
  assert.equal(calls[3].request.method, "DELETE");
  assert.equal(
    new URL(calls[3].request.url).pathname,
    "/v1/collections/collection-1/categories/Release%20notes",
  );
});

test("media.upload builds multipart form data for binary buffers", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      const request = toRequest(input, init);
      const formData = await request.clone().formData();
      calls.push({ request, formData });
      return Response.json({
        data: {
          message: "uploaded",
          media: {
            id: "media-id",
            pageId: "page-id",
            fileName: "hero.png",
            mimeType: "image/png",
            size: 68,
            width: 1,
            height: 1,
            url: "https://example.com/hero.png",
            createdAt: null,
            updatedAt: null,
          },
          editorNode: {},
        },
      });
    },
  });

  await expectOk(
    client.media.upload({
      file: Buffer.from([1, 2, 3]),
      fileName: "hero.png",
      contentType: "image/png",
      pageId: "page-id",
      slug: "hero",
      alt: "Hero alt text",
      caption: "Hero caption",
    }),
  );

  const [{ request, formData }] = calls;
  assert.equal(request.method, "POST");
  assert.equal(
    request.headers
      .get("content-type")
      ?.startsWith("multipart/form-data; boundary="),
    true,
  );
  assert.equal(formData.get("pageId"), "page-id");
  assert.equal(formData.get("slug"), "hero");
  assert.equal(formData.get("alt"), "Hero alt text");
  assert.equal(formData.get("caption"), "Hero caption");

  const file = formData.get("file");
  assert.equal(file instanceof File, true);
  assert.equal(file.name, "hero.png");
  assert.equal(file.type, "image/png");
  assert.equal(file.size, 3);
  assert.equal(client.media.update, undefined);
});

test("Client converts API errors into ParagraphApiError", async () => {
  const client = new Client({
    apiKey: "test-key",
    fetch: async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "pageNotFound",
            message: "Page not found.",
            details: { pageId: "missing" },
          },
        }),
        {
          status: 404,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
  });

  const error = await expectError(client.pages.get("missing"));

  assert.equal(error instanceof ParagraphApiError, true);
  assert.equal(error.status, 404);
  assert.equal(error.code, "pageNotFound");
  assert.deepEqual(error.details, { pageId: "missing" });
});

test("Client retries 429 responses using Retry-After", async () => {
  let calls = 0;
  const client = new Client({
    apiKey: "test-key",
    maxRateLimitRetries: 0,
    fetch: async () => {
      calls += 1;

      if (calls === 1) {
        return new Response(
          JSON.stringify({
            error: {
              code: "rateLimited",
              message: "Too many requests.",
            },
          }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": "0",
            },
          },
        );
      }

      return Response.json({
        data: {
          version: "v1",
          openapiUrl: "/v1/openapi.json",
          authentication: {
            type: "apiKey",
            supportedHeaders: ["x-api-key", "authorization"],
            authorizationFormat: "Bearer <api-key>",
          },
          resources: [],
        },
      });
    },
  });

  const info = await expectOk(
    client.getInfo({
      maxRateLimitRetries: 1,
    }),
  );

  assert.equal(info.version, "v1");
  assert.equal(info.openapiUrl, "/v1/openapi.json");
  assert.equal(calls, 2);
});

test("Client respects Retry-After delays for 429 responses", async () => {
  let calls = 0;
  const callTimes = [];
  const client = new Client({
    apiKey: "test-key",
    maxRateLimitRetries: 0,
    fetch: async () => {
      calls += 1;
      callTimes.push(Date.now());

      if (calls === 1) {
        return new Response(
          JSON.stringify({
            error: {
              code: "rateLimited",
              message: "Too many requests.",
            },
          }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": "1",
            },
          },
        );
      }

      return Response.json({
        data: {
          version: "v1",
          openapiUrl: "/v1/openapi.json",
          authentication: {
            type: "apiKey",
            supportedHeaders: ["x-api-key", "authorization"],
            authorizationFormat: "Bearer <api-key>",
          },
          resources: [],
        },
      });
    },
  });

  const info = await expectOk(
    client.getInfo({
      maxRateLimitRetries: 1,
      timeoutMs: 3000,
    }),
  );

  assert.equal(info.version, "v1");
  assert.equal(info.openapiUrl, "/v1/openapi.json");
  assert.equal(calls, 2);
  assert.equal(callTimes.length, 2);
  assert.equal(callTimes[1] - callTimes[0] >= 900, true);
});

test("Client stops retrying 429 responses after maxRateLimitRetries", async () => {
  let calls = 0;
  const client = new Client({
    apiKey: "test-key",
    maxRateLimitRetries: 1,
    fetch: async () => {
      calls += 1;

      return new Response(
        JSON.stringify({
          error: {
            code: "rateLimited",
            message: "Too many requests.",
          },
        }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "0",
          },
        },
      );
    },
  });

  const error = await expectError(client.getInfo());

  assert.equal(error instanceof ParagraphApiError, true);
  assert.equal(error.status, 429);
  assert.equal(error.code, "rateLimited");
  assert.equal(calls, 2);
});

test("page.getBySlug resolves the page through slug lookup and returns full details", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      const url = new URL(toRequest(input, init).url);
      calls.push(url);

      if (url.pathname === "/v1/pages") {
        return Response.json({
          data: [
            {
              id: "page-1",
              slug: "pricing",
            },
          ],
          meta: {
            page: 1,
            limit: 100,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }

      if (url.pathname === "/v1/pages/page-1") {
        return Response.json({
          data: {
            id: "page-1",
            title: "Pricing",
            slug: "pricing",
            content: [],
            translations: [],
          },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    },
  });

  const page = await expectOk(client.page.getBySlug("pricing"));

  assert.equal(page.id, "page-1");
  assert.equal(page.slug, "pricing");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].pathname, "/v1/pages");
  assert.equal(calls[0].searchParams.get("includeContent"), "false");
  assert.equal(calls[0].searchParams.get("slug"), "pricing");
  assert.equal(calls[0].searchParams.get("requiredSlug"), "true");
  assert.equal(calls[0].searchParams.get("published"), null);
  assert.equal(calls[0].searchParams.get("page"), "1");
  assert.equal(calls[0].searchParams.get("limit"), "100");
  assert.equal(calls[1].pathname, "/v1/pages/page-1");
});

test("page.getBySlug rejects inconsistent slug data from the page details endpoint", async () => {
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      const url = new URL(toRequest(input, init).url);

      if (url.pathname === "/v1/pages") {
        return Response.json({
          data: [
            {
              id: "page-1",
              slug: "pricing",
            },
          ],
          meta: {
            page: 1,
            limit: 100,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }

      if (url.pathname === "/v1/pages/page-1") {
        return Response.json({
          data: {
            id: "page-1",
            title: "Pricing",
            slug: null,
            content: [],
            translations: [],
          },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    },
  });

  const error = await expectError(client.page.getBySlug("pricing"));

  assert.equal(error instanceof ParagraphClientError, true);
  assert.equal(
    error.message,
    'Page fetched by slug returned inconsistent slug data for "pricing".',
  );
});

test("page.get is a short alias for pages.get", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      const url = new URL(toRequest(input, init).url);
      calls.push(url);

      if (url.pathname === "/v1/pages/page-1") {
        return Response.json({
          data: {
            id: "page-1",
            title: "Pricing",
            slug: "pricing",
            content: [],
            translations: [],
          },
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    },
  });

  const page = await expectOk(client.page.get("page-1"));

  assert.equal(page.id, "page-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pathname, "/v1/pages/page-1");
});

test("pages workflow helpers target the expected endpoints", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      const request = toRequest(input, init);
      const body = await readJsonBody(request);
      calls.push({ request, body });

      return Response.json({
        data: {
          message: "ok",
          page: {
            id: "page-1",
            title: "Pricing",
            slug: "pricing",
            language: "en",
            content: [],
            translations: [],
          },
        },
      });
    },
  });

  await expectOk(
    client.pages.translate("page-1", {
      language: "pl",
      model: "openai/gpt-5",
    }),
  );
  await expectOk(client.pages.setStatus("page-1", "status-1"));
  await expectOk(client.pages.setCollection("page-1", null));
  await expectOk(
    client.pages.update("page-1", {
      publishedAt: "2026-08-05T12:00:00.000Z",
    }),
  );

  assert.equal(calls.length, 4);

  assert.equal(calls[0].request.method, "POST");
  assert.equal(
    new URL(calls[0].request.url).pathname,
    "/v1/pages/page-1/translations",
  );
  assert.deepEqual(calls[0].body, {
    language: "pl",
    model: "openai/gpt-5",
    mode: "translate",
  });

  assert.equal(calls[1].request.method, "PATCH");
  assert.equal(new URL(calls[1].request.url).pathname, "/v1/pages/page-1");
  assert.deepEqual(calls[1].body, {
    statusId: "status-1",
  });

  assert.equal(calls[2].request.method, "PATCH");
  assert.equal(new URL(calls[2].request.url).pathname, "/v1/pages/page-1");
  assert.deepEqual(calls[2].body, {
    collectionId: null,
  });

  assert.equal(calls[3].request.method, "PATCH");
  assert.equal(new URL(calls[3].request.url).pathname, "/v1/pages/page-1");
  assert.deepEqual(calls[3].body, {
    publishedAt: "2026-08-05T12:00:00.000Z",
  });
});

test("pages.generateContent uses the stored page as prompt context", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      const request = toRequest(input, init);
      const body = await readJsonBody(request);
      calls.push({ request, body });

      return Response.json({
        data: {
          message: "generated",
          title: "Pricing refresh",
          content: [],
        },
      });
    },
  });

  const generated = await expectOk(
    client.pages.generateContent("page-1", {
      model: "openai/gpt-5",
      prompt: "Rewrite the intro for enterprise buyers.",
    }),
  );

  assert.equal(generated.title, "Pricing refresh");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].request.method, "POST");
  assert.equal(
    new URL(calls[0].request.url).pathname,
    "/v1/pages/page-1/ai/content",
  );
  assert.deepEqual(calls[0].body, {
    model: "openai/gpt-5",
    prompt: "Rewrite the intro for enterprise buyers.",
  });
});

test("ai image and slug helpers target the expected endpoints", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      const request = toRequest(input, init);
      const body = await readJsonBody(request);
      calls.push({ request, body });

      const pathname = new URL(request.url).pathname;

      if (pathname === "/v1/ai/image-slug") {
        return Response.json({
          data: {
            message: "generated",
            slug: "team-dashboard-hero",
          },
        });
      }

      if (pathname === "/v1/ai/image-caption") {
        return Response.json({
          data: {
            message: "generated",
            caption: "Team presenting the dashboard.",
          },
        });
      }

      if (pathname === "/v1/ai/image-alt") {
        return Response.json({
          data: {
            message: "generated",
            alt: "Team presenting a product dashboard.",
          },
        });
      }

      if (pathname === "/v1/ai/page-slug") {
        return Response.json({
          data: {
            message: "generated",
            slug: "enterprise-pricing",
          },
        });
      }

      throw new Error(`Unexpected request: ${request.url}`);
    },
  });

  const imageSlug = await expectOk(
    client.ai.generateImageSlug({
      model: "openai/gpt-5",
      caption: "Team presenting the dashboard.",
    }),
  );
  const imageCaption = await expectOk(
    client.ai.generateImageCaption({
      model: "openai/gpt-5",
      slug: "team-dashboard-hero",
    }),
  );
  const imageAlt = await expectOk(
    client.ai.generateImageAlt({
      model: "openai/gpt-5",
      caption: "Team presenting the dashboard.",
    }),
  );
  const pageSlug = await expectOk(
    client.ai.generatePageSlug({
      title: "Enterprise Pricing",
      pageId: "3c4f4ca7-bf06-4f59-ad60-e872c406b16d",
    }),
  );

  assert.equal(imageSlug.slug, "team-dashboard-hero");
  assert.equal(imageCaption.caption, "Team presenting the dashboard.");
  assert.equal(imageAlt.alt, "Team presenting a product dashboard.");
  assert.equal(pageSlug.slug, "enterprise-pricing");
  assert.equal(calls.length, 4);

  assert.equal(
    new URL(calls[0].request.url).pathname,
    "/v1/ai/image-slug",
  );
  assert.deepEqual(calls[0].body, {
    model: "openai/gpt-5",
    caption: "Team presenting the dashboard.",
  });

  assert.equal(
    new URL(calls[1].request.url).pathname,
    "/v1/ai/image-caption",
  );
  assert.deepEqual(calls[1].body, {
    model: "openai/gpt-5",
    slug: "team-dashboard-hero",
  });

  assert.equal(new URL(calls[2].request.url).pathname, "/v1/ai/image-alt");
  assert.deepEqual(calls[2].body, {
    model: "openai/gpt-5",
    caption: "Team presenting the dashboard.",
  });

  assert.equal(new URL(calls[3].request.url).pathname, "/v1/ai/page-slug");
  assert.deepEqual(calls[3].body, {
    title: "Enterprise Pricing",
    pageId: "3c4f4ca7-bf06-4f59-ad60-e872c406b16d",
  });
});

test("members.get paginates list responses until the member is found", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input, init) => {
      const url = new URL(toRequest(input, init).url);
      calls.push(url);

      const page = Number(url.searchParams.get("page"));

      return Response.json({
        data:
          page === 1
            ? [
                {
                  id: "member-1",
                  userId: "user-1",
                  role: "editor",
                  name: "Editor One",
                  email: "editor-1@example.com",
                  imageUrl: null,
                  createdAt: null,
                },
              ]
            : [
                {
                  id: "member-2",
                  userId: "user-2",
                  role: "editor",
                  name: "Editor Two",
                  email: "editor-2@example.com",
                  imageUrl: null,
                  createdAt: null,
                },
              ],
        meta: {
          page,
          limit: 100,
          totalItems: 2,
          totalPages: 2,
          hasNextPage: page === 1,
          hasPrevPage: page > 1,
        },
      });
    },
  });

  const member = await expectOk(client.members.get("member-2"));

  assert.equal(member.id, "member-2");
  assert.equal(member.userId, "user-2");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].pathname, "/v1/members");
  assert.equal(calls[0].searchParams.get("page"), "1");
  assert.equal(calls[0].searchParams.get("limit"), "100");
  assert.equal(calls[1].searchParams.get("page"), "2");
});

test("locales.get returns a locale from the locale list", async () => {
  let calls = 0;
  const client = new Client({
    apiKey: "test-key",
    fetch: async () => {
      calls += 1;

      return Response.json({
        data: [
          {
            id: "locale-en",
            code: "en",
            name: "English",
          },
          {
            id: "locale-pl",
            code: "pl",
            name: "Polski",
          },
        ],
      });
    },
  });

  const locale = await expectOk(client.locales.get("pl"));

  assert.equal(locale.id, "locale-pl");
  assert.equal(locale.code, "pl");
  assert.equal(calls, 1);
});

test("locales.getDefaultLocale returns the default locale code", async () => {
  let calls = 0;
  const client = new Client({
    apiKey: "test-key",
    fetch: async () => {
      calls += 1;

      return Response.json({
        data: {
          defaultLocale: "en",
        },
      });
    },
  });

  const defaultLocale = await expectOk(client.locales.getDefaultLocale());

  assert.equal(defaultLocale, "en");
  assert.equal(calls, 1);
});

test("SDK lookup helpers return ParagraphApiError when the resource is missing", async () => {
  const client = new Client({
    apiKey: "test-key",
    fetch: async () =>
      Response.json({
        data: [],
        meta: {
          page: 1,
          limit: 100,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
  });

  const missingMemberError = await expectError(client.members.get("missing-member"));

  assert.equal(missingMemberError instanceof ParagraphApiError, true);
  assert.equal(missingMemberError.status, 404);
  assert.equal(missingMemberError.code, "memberNotFound");
  assert.deepEqual(missingMemberError.details, { memberId: "missing-member" });
  assert.equal(
    missingMemberError.request.url,
    "https://api.paragraphcms.com/v1/members?page=1&limit=100",
  );

  const missingPageError = await expectError(client.pages.getBySlug("missing-page"));

  assert.equal(missingPageError instanceof ParagraphApiError, true);
  assert.equal(missingPageError.status, 404);
  assert.equal(missingPageError.code, "pageNotFound");
  assert.deepEqual(missingPageError.details, { slug: "missing-page" });
  assert.equal(
    missingPageError.request.url,
    "https://api.paragraphcms.com/v1/pages?slug=missing-page&includeContent=false&requiredSlug=true&page=1&limit=100",
  );
});

test("Client rate-limits request starts per instance", async () => {
  const starts = [];
  const client = new Client({
    apiKey: "test-key",
    maxRequestsPerSecond: 5,
    fetch: async () => {
      starts.push(Date.now());
      return Response.json({
        data: {
          version: "v1",
          openapiUrl: "/v1/openapi.json",
          authentication: {
            type: "apiKey",
            supportedHeaders: ["x-api-key", "authorization"],
            authorizationFormat: "Bearer <api-key>",
          },
          resources: [],
        },
      });
    },
  });

  await Promise.all([
    expectOk(client.getInfo()),
    expectOk(client.getInfo()),
    expectOk(client.getInfo()),
  ]);

  assert.equal(starts.length, 3);
  assert.equal(starts[1] - starts[0] >= 150, true);
  assert.equal(starts[2] - starts[1] >= 150, true);
});

test("Client binds the global fetch implementation to globalThis", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function (input, init) {
    const request = toRequest(input, init);

    assert.equal(this, globalThis);
    assert.equal(
      request.url.replace(/\/$/, ""),
      "https://api.paragraphcms.com/v1",
    );
    assert.equal(request.method, "GET");

    return Response.json({
      data: {
        version: "v1",
        openapiUrl: "/v1/openapi.json",
        authentication: {
          type: "apiKey",
          supportedHeaders: ["x-api-key", "authorization"],
          authorizationFormat: "Bearer <api-key>",
        },
        resources: [],
      },
    });
  };

  try {
    const client = new Client({ apiKey: "test-key" });
    await expectOk(client.getInfo());
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Client retries transient 503 responses", async () => {
  let calls = 0;
  const client = new Client({
    apiKey: "test-key",
    maxRateLimitRetries: 1,
    fetch: async () => {
      calls += 1;

      if (calls === 1) {
        return new Response(
          JSON.stringify({
            error: {
              code: "serviceUnavailable",
              message: "Service unavailable.",
            },
          }),
          {
            status: 503,
            headers: {
              "content-type": "application/json",
              "retry-after": "0",
            },
          },
        );
      }

      return Response.json({
        data: {
          version: "v1",
          openapiUrl: "/v1/openapi.json",
          authentication: {
            type: "apiKey",
            supportedHeaders: ["x-api-key", "authorization"],
            authorizationFormat: "Bearer <api-key>",
          },
          resources: [],
        },
      });
    },
  });

  const info = await expectOk(client.getInfo());

  assert.equal(info.version, "v1");
  assert.equal(calls, 2);
});
