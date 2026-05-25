import assert from "node:assert/strict";
import test from "node:test";

import {
  Client,
  ParagraphApiError,
  ParagraphClientError,
} from "../dist/index.js";

function toRequest(input, init) {
  return input instanceof Request ? input : new Request(input, init);
}

test("Client requires an API key", () => {
  assert.throws(() => new Client({ apiKey: "   " }), ParagraphClientError);
});

test("Client uses the official API endpoint and maps hasPublished to published", async () => {
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

  await client.pages.list({
    includeContent: true,
    labelIds: ["label-a", "label-b"],
    deleted: "include",
    published: false,
  });

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
  assert.equal(url.searchParams.get("published"), "false");
  assert.equal(url.searchParams.get("page"), null);
  assert.equal(url.searchParams.get("limit"), null);
  assert.equal(request.method, "GET");
  assert.equal(request.headers.get("x-api-key"), "test-key");
  assert.equal(request.headers.get("accept"), "application/json");
});

test("Client still accepts the legacy published filter", async () => {
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

  await client.pages.list({ published: false });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get("published"), "false");
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

  await client.pages.list({
    collection: "Blog",
    collectionId: "collection-123",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get("collection"), "Blog");
  assert.equal(calls[0].searchParams.get("collectionId"), "collection-123");
  assert.equal(calls[0].searchParams.get("published"), "true");
  assert.equal(calls[0].searchParams.get("requiredSlug"), null);
  assert.equal(
    Array.from(calls[0].searchParams.keys()).some((key) => key.includes("_")),
    false,
  );
});

test("page.list aliases pages.list and keeps requiredSlug camel-cased in the API query", async () => {
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

  await client.page.list({ requiredSlug: true });
  await client.page.list({ requiredSlug: false });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].searchParams.get("requiredSlug"), "true");
  assert.equal(calls[0].searchParams.get("includeContent"), "false");
  assert.equal(calls[0].searchParams.get("published"), "true");
  assert.equal(calls[1].searchParams.get("requiredSlug"), null);
  assert.equal(calls[1].searchParams.get("includeContent"), "false");
  assert.equal(calls[1].searchParams.get("published"), "true");
  assert.equal(
    Array.from(calls[0].searchParams.keys()).some((key) => key.includes("_")),
    false,
  );
  assert.equal(
    Array.from(calls[1].searchParams.keys()).some((key) => key.includes("_")),
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

  const listed = await client.pages.list({ deleted: "include" });

  assert.equal(calls.length, 2);
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
  assert.equal(listed.data.length, 3);
  assert.equal(listed.meta.page, 1);
  assert.equal(listed.meta.limit, 3);
  assert.equal(listed.meta.totalItems, 3);
  assert.equal(listed.meta.totalPages, 1);
  assert.equal(listed.meta.hasNextPage, false);
  assert.equal(listed.meta.hasPrevPage, false);
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
            alt: "Hero",
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

  await client.media.upload({
    file: Buffer.from([1, 2, 3]),
    fileName: "hero.png",
    contentType: "image/png",
    pageId: "page-id",
    alt: "Hero",
  });

  const [{ request, formData }] = calls;
  assert.equal(request.method, "POST");
  assert.equal(
    request.headers
      .get("content-type")
      ?.startsWith("multipart/form-data; boundary="),
    true,
  );
  assert.equal(formData.get("pageId"), "page-id");
  assert.equal(formData.get("alt"), "Hero");

  const file = formData.get("file");
  assert.equal(file instanceof File, true);
  assert.equal(file.name, "hero.png");
  assert.equal(file.type, "image/png");
  assert.equal(file.size, 3);
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

  await assert.rejects(
    () => client.pages.get("missing"),
    (error) => {
      assert.equal(error instanceof ParagraphApiError, true);
      assert.equal(error.status, 404);
      assert.equal(error.code, "pageNotFound");
      assert.deepEqual(error.details, { pageId: "missing" });
      return true;
    },
  );
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

  const info = await client.getInfo({
    maxRateLimitRetries: 1,
  });

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

  const info = await client.getInfo({
    maxRateLimitRetries: 1,
    timeoutMs: 3000,
  });

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

  await assert.rejects(
    () => client.getInfo(),
    (error) => {
      assert.equal(error instanceof ParagraphApiError, true);
      assert.equal(error.status, 429);
      assert.equal(error.code, "rateLimited");
      assert.equal(calls, 2);
      return true;
    },
  );
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

  const page = await client.page.getBySlug("pricing");

  assert.equal(page.id, "page-1");
  assert.equal(page.slug, "pricing");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].pathname, "/v1/pages");
  assert.equal(calls[0].searchParams.get("includeContent"), "false");
  assert.equal(calls[0].searchParams.get("slug"), "pricing");
  assert.equal(calls[0].searchParams.get("published"), null);
  assert.equal(calls[0].searchParams.get("page"), "1");
  assert.equal(calls[0].searchParams.get("limit"), "100");
  assert.equal(calls[1].pathname, "/v1/pages/page-1");
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

  const page = await client.page.get("page-1");

  assert.equal(page.id, "page-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pathname, "/v1/pages/page-1");
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

  const member = await client.members.get("member-2");

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

  const locale = await client.locales.get("pl");

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

  const defaultLocale = await client.locales.getDefaultLocale();

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

  await assert.rejects(
    () => client.members.get("missing-member"),
    (error) => {
      assert.equal(error instanceof ParagraphApiError, true);
      assert.equal(error.status, 404);
      assert.equal(error.code, "memberNotFound");
      assert.deepEqual(error.details, { memberId: "missing-member" });
      assert.equal(
        error.request.url,
        "https://api.paragraphcms.com/v1/members?page=1&limit=100",
      );
      return true;
    },
  );

  await assert.rejects(
    () => client.pages.getBySlug("missing-page"),
    (error) => {
      assert.equal(error instanceof ParagraphApiError, true);
      assert.equal(error.status, 404);
      assert.equal(error.code, "pageNotFound");
      assert.deepEqual(error.details, { slug: "missing-page" });
      assert.equal(
        error.request.url,
        "https://api.paragraphcms.com/v1/pages?slug=missing-page&includeContent=false&page=1&limit=100",
      );
      return true;
    },
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

  await Promise.all([client.getInfo(), client.getInfo(), client.getInfo()]);

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
    await client.getInfo();
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

  const info = await client.getInfo();

  assert.equal(info.version, "v1");
  assert.equal(calls, 2);
});
