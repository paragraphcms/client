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
  assert.equal(typeof meta.totalItems, "number");
  assert.equal(typeof meta.totalPages, "number");
  assert.equal(typeof meta.hasNextPage, "boolean");
  assert.equal(typeof meta.hasPrevPage, "boolean");
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
  assert.equal(typeof member.userId, "string");
  assert.equal(typeof member.role, "string");
  assertNullableString(member.name);
  assertNullableString(member.email);
  assertNullableString(member.imageUrl);
  assertNullableString(member.createdAt);
}

export function assertStatus(status) {
  assert.equal(typeof status.id, "string");
  assert.equal(typeof status.name, "string");
  assert.equal(typeof status.color, "string");
  assert.equal(typeof status.type, "string");
  assertNullableString(status.description);
  assert.equal(typeof status.order, "number");
  assertNullableString(status.createdAt);
  assertNullableString(status.updatedAt);
}

export function assertLabel(label) {
  assert.equal(typeof label.id, "string");
  assert.equal(typeof label.name, "string");
  assert.equal(typeof label.color, "string");
  assertNullableString(label.description);
  assert.equal(typeof label.order, "number");
  assertNullableString(label.createdAt);
  assertNullableString(label.lastAppliedAt);
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
  assertNullableString(dataModel.createdAt);
  assertNullableString(dataModel.updatedAt);
}

export function assertCollection(collection) {
  assert.equal(typeof collection.id, "string");
  assert.equal(typeof collection.name, "string");
  assertNullableString(collection.description);
  assertNullableString(collection.defaultDataModelId);
  assert.equal(Array.isArray(collection.categories), true);
  for (const category of collection.categories) {
    assert.equal(typeof category, "string");
  }
  assert.equal(Array.isArray(collection.teamIds), true);
  assert.equal(typeof collection.pageCount, "number");
  assertNullableString(collection.lastModifiedAt);

  if (collection.defaultDataModel !== null) {
    assertDataModel(collection.defaultDataModel);
  }
}

export function assertPageSummary(page, { expectContent = false } = {}) {
  assert.equal(typeof page.id, "string");
  assert.equal(typeof page.title, "string");
  assertNullableString(page.slug);
  assert.equal(typeof page.language, "string");
  assert.equal(
    page.contentFormat === undefined || page.contentFormat === "tiptap",
    true,
  );
  assertNullableString(page.heroUrl);
  assertNullableString(page.heroSlug);
  assertNullableString(page.heroCaption);
  assertNullableString(page.heroAltText);
  assertNullableString(page.collectionId);
  if (page.collection !== null) {
    assertCollection(page.collection);
  }
  assert.equal(typeof page.translationGroupId, "string");
  assertNullableString(page.dataModelId);
  if (page.dataModel !== null) {
    assertDataModel(page.dataModel);
  }
  assertNullableString(page.statusId);
  if (page.status !== null) {
    assertStatus(page.status);
  }
  assertNullableString(page.authorId);
  if (page.author !== null) {
    assertMember(page.author);
  }
  assertNullableString(page.reviewerId);
  if (page.reviewer !== null) {
    assertMember(page.reviewer);
  }
  assert.equal(Array.isArray(page.labels), true);
  for (const label of page.labels) {
    assertLabel(label);
  }
  assert.equal(typeof page.fields, "object");
  assertNullableString(page.metaName);
  assertNullableString(page.metaDescription);
  assertNullableString(page.publishedAt);
  assert.equal(Array.isArray(page.categories), true);
  for (const category of page.categories) {
    assert.equal(typeof category, "string");
  }
  assertNullableString(page.deletedAt);
  assertNullableString(page.createdAt);
  assertNullableString(page.updatedAt);

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
    assertNullableString(translation.deletedAt);
    assertNullableString(translation.createdAt);
    assertNullableString(translation.updatedAt);
    assert.equal(typeof translation.isCurrent, "boolean");
  }
}

export function assertMedia(media) {
  assert.equal(typeof media.id, "string");
  assertNullableString(media.pageId);
  assert.equal(typeof media.fileName, "string");
  assert.equal(typeof media.mimeType, "string");
  assert.equal(typeof media.size, "number");
  assertNullableNumber(media.width);
  assertNullableNumber(media.height);
  assert.equal(typeof media.url, "string");
  assertNullableString(media.createdAt);
  assertNullableString(media.updatedAt);
}

export function assertMediaDetail(media) {
  assertMedia(media);
  assert.equal(typeof media.referencePageCount, "number");
  assertNullableString(media.lastModifiedAt);
  assert.equal(Array.isArray(media.referencePages), true);

  for (const page of media.referencePages) {
    assert.equal(typeof page.id, "string");
    assert.equal(typeof page.title, "string");
    assertNullableString(page.slug);
    assertNullableString(page.language);
    assertNullableString(page.translationGroupId);
    assertNullableString(page.updatedAt);
    assert.equal(typeof page.isUnassigned, "boolean");
  }
}

export function assertLocale(locale) {
  assertNullableString(locale.id);
  assert.equal(typeof locale.code, "string");
  assert.equal(typeof locale.name, "string");
}

export function assertApiInfo(info) {
  assert.equal(info.version, "v1");
  assert.equal(typeof info.openapiUrl, "string");
  assert.equal(typeof info.authentication, "object");
  assert.equal(Array.isArray(info.resources), true);
}

export async function expectOk(run) {
  const result = await run;

  if (result.error !== null) {
    assert.fail(`expected success result, received: ${result.error.message}`);
  }

  return result.data;
}

export async function expectError(run) {
  const result = await run;

  if (result.error === null) {
    assert.fail("expected error result");
  }

  return result.error;
}

export async function cleanupIgnoringNotFound(run) {
  const result = await run();

  if (result.error === null) {
    return result.data;
  }

  if (
    result.error &&
    typeof result.error === "object" &&
    "status" in result.error &&
    result.error.status === 404
  ) {
    return;
  }

  throw result.error;
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
