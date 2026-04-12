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
  assert.equal(init.method, "GET");
  assert.equal(init.headers.get("x-api-key"), "test-key");
  assert.equal(init.headers.get("accept"), "application/json");
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
