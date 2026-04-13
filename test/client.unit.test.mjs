import assert from "node:assert/strict";
import test from "node:test";

import {
  Client,
  ParagraphApiError,
  ParagraphClientError,
} from "../dist/index.js";

test("Client requires an API key", () => {
  assert.throws(
    () => new Client({ apiKey: "   " }),
    ParagraphClientError,
  );
});

test("Client normalizes baseUrl and serializes query arrays", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    baseUrl: "https://api.paragraphcms.com",
    fetch: async (input, init) => {
      calls.push({ input, init });
      return Response.json({
        data: [],
        meta: {
          page: 1,
          limit: 20,
          total_items: 0,
          total_pages: 0,
          has_next_page: false,
          has_prev_page: false,
        },
      });
    },
  });

  await client.pages.list({
    include_content: true,
    label_id: ["label-a", "label-b"],
    deleted: "include",
    published: false,
  });

  assert.equal(calls.length, 1);
  const [{ input, init }] = calls;
  const url = new URL(String(input));

  assert.equal(url.origin + url.pathname, "https://api.paragraphcms.com/v1/pages");
  assert.equal(url.searchParams.get("include_content"), "true");
  assert.equal(url.searchParams.get("label_id"), "label-a,label-b");
  assert.equal(url.searchParams.get("deleted"), "include");
  assert.equal(url.searchParams.get("published"), "false");
  assert.equal(url.searchParams.get("page"), null);
  assert.equal(url.searchParams.get("limit"), null);
  assert.equal(init.method, "GET");
  assert.equal(init.headers.get("x-api-key"), "test-key");
  assert.equal(init.headers.get("accept"), "application/json");
});

test("pages.list maps collection alias to collection_id", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input) => {
      const url = new URL(String(input));
      calls.push(url);

      return Response.json({
        data: [],
        meta: {
          page: 1,
          limit: 20,
          total_items: 0,
          total_pages: 0,
          has_next_page: false,
          has_prev_page: false,
        },
      });
    },
  });

  await client.pages.list({ collection: "collection-123" });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].searchParams.get("collection_id"),
    "collection-123",
  );
  assert.equal(calls[0].searchParams.get("collection"), null);
});

test("pages.list rejects conflicting collection aliases", async () => {
  const client = new Client({
    apiKey: "test-key",
    fetch: async () => {
      throw new Error("Request should not be sent");
    },
  });

  await assert.rejects(
    () =>
      client.pages.list({
        collection: "collection-a",
        collection_id: "collection-b",
      }),
    (error) => {
      assert.equal(error instanceof ParagraphClientError, true);
      assert.equal(
        error.message,
        "`collection` and `collection_id` must match when both are provided.",
      );
      return true;
    },
  );
});

test("pages.list without explicit pagination aggregates every API page", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input) => {
      const url = new URL(String(input));
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
          total_items: 3,
          total_pages: 2,
          has_next_page: page === 1,
          has_prev_page: page > 1,
        },
      });
    },
  });

  const listed = await client.pages.list({ deleted: "include" });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].searchParams.get("include_content"), "false");
  assert.equal(calls[0].searchParams.get("deleted"), "include");
  assert.equal(calls[0].searchParams.get("page"), null);
  assert.equal(calls[0].searchParams.get("limit"), null);
  assert.equal(calls[1].searchParams.get("include_content"), "false");
  assert.equal(calls[1].searchParams.get("deleted"), "include");
  assert.equal(calls[1].searchParams.get("page"), "2");
  assert.equal(calls[1].searchParams.get("limit"), "2");
  assert.equal(listed.data.length, 3);
  assert.equal(listed.meta.page, 1);
  assert.equal(listed.meta.limit, 3);
  assert.equal(listed.meta.total_items, 3);
  assert.equal(listed.meta.total_pages, 1);
  assert.equal(listed.meta.has_next_page, false);
  assert.equal(listed.meta.has_prev_page, false);
});

test("media.upload builds multipart form data for binary buffers", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (_input, init) => {
      calls.push(init);
      return Response.json({
        data: {
          message: "uploaded",
          media: {
            id: "media-id",
            page_id: "page-id",
            file_name: "hero.png",
            alt: "Hero",
            mime_type: "image/png",
            size: 68,
            width: 1,
            height: 1,
            url: "https://example.com/hero.png",
            created_at: null,
            updated_at: null,
          },
          editor_node: {},
        },
      });
    },
  });

  await client.media.upload({
    file: Buffer.from([1, 2, 3]),
    file_name: "hero.png",
    content_type: "image/png",
    page_id: "page-id",
    alt: "Hero",
  });

  const [init] = calls;
  assert.equal(init.method, "POST");
  assert.equal(init.headers.get("content-type"), null);
  assert.equal(init.body instanceof FormData, true);
  assert.equal(init.body.get("page_id"), "page-id");
  assert.equal(init.body.get("alt"), "Hero");

  const file = init.body.get("file");
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
            code: "page_not_found",
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
      assert.equal(error.code, "page_not_found");
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
              code: "rate_limited",
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
          openapi_url: "/v1/openapi.json",
          authentication: {
            type: "api_key",
            supported_headers: ["x-api-key", "authorization"],
            authorization_format: "Bearer <api-key>",
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
  assert.equal(calls, 2);
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
            code: "rate_limited",
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
      assert.equal(error.code, "rate_limited");
      assert.equal(calls, 2);
      return true;
    },
  );
});

test("page.getBySlug resolves the page through slug lookup and returns full details", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input) => {
      const url = new URL(String(input));
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
            total_items: 1,
            total_pages: 1,
            has_next_page: false,
            has_prev_page: false,
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
  assert.equal(calls[0].searchParams.get("include_content"), "false");
  assert.equal(calls[0].searchParams.get("slug"), "pricing");
  assert.equal(calls[0].searchParams.get("page"), "1");
  assert.equal(calls[0].searchParams.get("limit"), "100");
  assert.equal(calls[1].pathname, "/v1/pages/page-1");
});

test("page.get is a short alias for pages.get", async () => {
  const calls = [];
  const client = new Client({
    apiKey: "test-key",
    fetch: async (input) => {
      const url = new URL(String(input));
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
    fetch: async (input) => {
      const url = new URL(String(input));
      calls.push(url);

      const page = Number(url.searchParams.get("page"));

      return Response.json({
        data:
          page === 1
            ? [
                {
                  id: "member-1",
                  user_id: "user-1",
                  role: "editor",
                  name: "Editor One",
                  email: "editor-1@example.com",
                  image_url: null,
                  created_at: null,
                },
              ]
            : [
                {
                  id: "member-2",
                  user_id: "user-2",
                  role: "editor",
                  name: "Editor Two",
                  email: "editor-2@example.com",
                  image_url: null,
                  created_at: null,
                },
              ],
        meta: {
          page,
          limit: 100,
          total_items: 2,
          total_pages: 2,
          has_next_page: page === 1,
          has_prev_page: page > 1,
        },
      });
    },
  });

  const member = await client.members.get("member-2");

  assert.equal(member.id, "member-2");
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

test("SDK lookup helpers return ParagraphApiError when the resource is missing", async () => {
  const client = new Client({
    apiKey: "test-key",
    fetch: async () =>
      Response.json({
        data: [],
        meta: {
          page: 1,
          limit: 100,
          total_items: 0,
          total_pages: 0,
          has_next_page: false,
          has_prev_page: false,
        },
      }),
  });

  await assert.rejects(
    () => client.members.get("missing-member"),
    (error) => {
      assert.equal(error instanceof ParagraphApiError, true);
      assert.equal(error.status, 404);
      assert.equal(error.code, "member_not_found");
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
      assert.equal(error.code, "page_not_found");
      assert.deepEqual(error.details, { slug: "missing-page" });
      assert.equal(
        error.request.url,
        "https://api.paragraphcms.com/v1/pages?slug=missing-page&include_content=false&page=1&limit=100",
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
          openapi_url: "/v1/openapi.json",
          authentication: {
            type: "api_key",
            supported_headers: ["x-api-key", "authorization"],
            authorization_format: "Bearer <api-key>",
          },
          resources: [],
        },
      });
    },
  });

  await Promise.all([
    client.getInfo(),
    client.getInfo(),
    client.getInfo(),
  ]);

  assert.equal(starts.length, 3);
  assert.equal(starts[1] - starts[0] >= 150, true);
  assert.equal(starts[2] - starts[1] >= 150, true);
});

test("Client binds the global fetch implementation to globalThis", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function (input, init) {
    assert.equal(this, globalThis);
    assert.equal(String(input), "https://api.paragraphcms.com/v1");
    assert.equal(init.method, "GET");

    return Response.json({
      data: {
        version: "v1",
        openapi_url: "/v1/openapi.json",
        authentication: {
          type: "api_key",
          supported_headers: ["x-api-key", "authorization"],
          authorization_format: "Bearer <api-key>",
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
