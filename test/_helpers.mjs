import assert from "node:assert/strict";

export function makePrefix() {
  return `sdk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeTinyPngBytes() {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0xc9, 0xfe, 0x92,
    0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

export function assertPaginationMeta(meta) {
  assert.equal(typeof meta, "object");
  assert.equal(typeof meta.page, "number");
  assert.equal(typeof meta.limit, "number");
  assert.equal(typeof meta.total_items, "number");
  assert.equal(typeof meta.total_pages, "number");
  assert.equal(typeof meta.has_next_page, "boolean");
  assert.equal(typeof meta.has_prev_page, "boolean");
}

export function assertListResponse(list, itemAssert) {
  assert.equal(Array.isArray(list.data), true);
  assertPaginationMeta(list.meta);

  if (list.data[0] !== undefined && itemAssert) {
    itemAssert(list.data[0]);
  }
}

export function assertMember(member) {
  assert.equal(typeof member.id, "string");
  assert.equal(typeof member.user_id, "string");
  assert.equal(typeof member.role, "string");
  assertNullableString(member.name);
  assertNullableString(member.email);
  assertNullableString(member.image_url);
  assertNullableString(member.created_at);
}

export function assertStatus(status) {
  assert.equal(typeof status.id, "string");
  assert.equal(typeof status.name, "string");
  assert.equal(typeof status.color, "string");
  assert.equal(typeof status.type, "string");
  assertNullableString(status.description);
  assert.equal(typeof status.order, "number");
  assertNullableString(status.created_at);
  assertNullableString(status.updated_at);
}

export function assertLabel(label) {
  assert.equal(typeof label.id, "string");
  assert.equal(typeof label.name, "string");
  assert.equal(typeof label.color, "string");
  assertNullableString(label.description);
  assert.equal(typeof label.order, "number");
  assertNullableString(label.created_at);
  assertNullableString(label.last_applied_at);
}

export function assertDataModelField(field) {
  assert.equal(typeof field.id, "string");
  assert.equal(typeof field.label, "string");
  assert.equal(typeof field.type, "string");
}

export function assertDataModel(dataModel) {
  assert.equal(typeof dataModel.id, "string");
  assert.equal(typeof dataModel.name, "string");
  assertNullableString(dataModel.description);
  assert.equal(Array.isArray(dataModel.fields), true);
  for (const field of dataModel.fields) {
    assertDataModelField(field);
  }
  assertNullableString(dataModel.created_at);
  assertNullableString(dataModel.updated_at);
}

export function assertCollection(collection) {
  assert.equal(typeof collection.id, "string");
  assert.equal(typeof collection.name, "string");
  assertNullableString(collection.description);
  assertNullableString(collection.default_data_model_id);
  assert.equal(Array.isArray(collection.team_ids), true);
  assert.equal(typeof collection.page_count, "number");
  assertNullableString(collection.last_modified_at);

  if (collection.default_data_model !== null) {
    assertDataModel(collection.default_data_model);
  }
}

export function assertPageSummary(page, { expectContent = false } = {}) {
  assert.equal(typeof page.id, "string");
  assert.equal(typeof page.title, "string");
  assertNullableString(page.slug);
  assert.equal(typeof page.language, "string");
  assert.equal(
    page.content_format === undefined || page.content_format === "tiptap",
    true,
  );
  assertNullableString(page.hero_url);
  assertNullableString(page.collection_id);
  if (page.collection !== null) {
    assertCollection(page.collection);
  }
  assert.equal(typeof page.translation_group_id, "string");
  assertNullableString(page.data_model_id);
  if (page.data_model !== null) {
    assertDataModel(page.data_model);
  }
  assertNullableString(page.status_id);
  if (page.status !== null) {
    assertStatus(page.status);
  }
  assertNullableString(page.author_id);
  if (page.author !== null) {
    assertMember(page.author);
  }
  assertNullableString(page.reviewer_id);
  if (page.reviewer !== null) {
    assertMember(page.reviewer);
  }
  assert.equal(Array.isArray(page.labels), true);
  for (const label of page.labels) {
    assertLabel(label);
  }
  assert.equal(typeof page.fields, "object");
  assertNullableString(page.meta_name);
  assertNullableString(page.meta_description);
  assertNullableString(page.published_at);
  assertNullableString(page.deleted_at);
  assertNullableString(page.created_at);
  assertNullableString(page.updated_at);

  if (expectContent) {
    assertPageContent(page.content);
  }
}

export function assertPage(page) {
  assertPageSummary(page, { expectContent: true });
  assert.equal(Array.isArray(page.translations), true);
  for (const translation of page.translations) {
    assert.equal(typeof translation.id, "string");
    assert.equal(typeof translation.title, "string");
    assert.equal(typeof translation.language, "string");
    assertNullableString(translation.deleted_at);
    assertNullableString(translation.created_at);
    assertNullableString(translation.updated_at);
    assert.equal(typeof translation.is_current, "boolean");
  }
}

export function assertMedia(media) {
  assert.equal(typeof media.id, "string");
  assertNullableString(media.page_id);
  assert.equal(typeof media.file_name, "string");
  assertNullableString(media.alt);
  assert.equal(typeof media.mime_type, "string");
  assert.equal(typeof media.size, "number");
  assertNullableNumber(media.width);
  assertNullableNumber(media.height);
  assert.equal(typeof media.url, "string");
  assertNullableString(media.created_at);
  assertNullableString(media.updated_at);
}

export function assertMediaDetail(media) {
  assertMedia(media);
  assert.equal(typeof media.reference_page_count, "number");
  assertNullableString(media.last_modified_at);
  assert.equal(Array.isArray(media.reference_pages), true);

  for (const page of media.reference_pages) {
    assert.equal(typeof page.id, "string");
    assert.equal(typeof page.title, "string");
    assertNullableString(page.slug);
    assertNullableString(page.language);
    assertNullableString(page.translation_group_id);
    assertNullableString(page.updated_at);
    assert.equal(typeof page.is_unassigned, "boolean");
  }
}

export function assertLocale(locale) {
  assertNullableString(locale.id);
  assert.equal(typeof locale.code, "string");
  assert.equal(typeof locale.name, "string");
}

export function assertApiInfo(info) {
  assert.equal(info.version, "v1");
  assert.equal(typeof info.openapi_url, "string");
  assert.equal(typeof info.authentication, "object");
  assert.equal(Array.isArray(info.resources), true);
}

export async function cleanupIgnoringNotFound(run) {
  try {
    await run();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
      return;
    }

    throw error;
  }
}

function assertPageContent(content) {
  const isArray = Array.isArray(content);

  assert.equal(isArray, true);
}

function assertNullableString(value) {
  assert.equal(
    value === null || typeof value === "string",
    true,
    "expected a string or null",
  );
}

function assertNullableNumber(value) {
  assert.equal(
    value === null || typeof value === "number",
    true,
    "expected a number or null",
  );
}
