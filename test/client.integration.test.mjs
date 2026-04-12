import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "../dist/index.js";
import {
  assertApiInfo,
  assertCollection,
  assertDataModel,
  assertLabel,
  assertListResponse,
  assertLocale,
  assertMedia,
  assertMediaDetail,
  assertMember,
  assertPage,
  assertPageSummary,
  assertStatus,
  cleanupIgnoringNotFound,
  makePrefix,
  makeTinyPngBytes,
} from "./_helpers.mjs";

const apiKey = process.env.PARAGRAPH_API_KEY;
const baseUrl = process.env.PARAGRAPH_API_BASE_URL;
const aiModel = process.env.PARAGRAPH_AI_MODEL;

test(
  "Paragraph API integration",
  {
    skip: !apiKey
      ? "Set PARAGRAPH_API_KEY to run live integration tests."
      : false,
    concurrency: false,
    timeout: 180_000,
  },
  async (t) => {
    const client = new Client({
      apiKey,
      ...(baseUrl ? { baseUrl } : {}),
    });

    const prefix = makePrefix();
    const created = {
      localeCode: null,
      draftStatusIds: [],
      labelIds: [],
      dataModelId: null,
      collectionId: null,
      pageIds: [],
      mediaId: null,
    };

    t.after(async () => {
      for (const mediaId of [created.mediaId].filter(Boolean)) {
        await cleanupIgnoringNotFound(() => client.media.delete(mediaId));
      }

      for (const pageId of [...created.pageIds].reverse()) {
        await cleanupIgnoringNotFound(async () => {
          await client.pages.delete(pageId);
        });
        await cleanupIgnoringNotFound(async () => {
          await client.pages.permanentlyDelete(pageId);
        });
      }

      if (created.collectionId) {
        await cleanupIgnoringNotFound(() =>
          client.collections.delete(created.collectionId),
        );
      }

      if (created.dataModelId) {
        await cleanupIgnoringNotFound(() =>
          client.dataModels.delete(created.dataModelId),
        );
      }

      for (const labelId of [...created.labelIds].reverse()) {
        await cleanupIgnoringNotFound(() => client.labels.delete(labelId));
      }

      for (const statusId of [...created.draftStatusIds].reverse()) {
        await cleanupIgnoringNotFound(() => client.statuses.delete(statusId));
      }

      if (created.localeCode) {
        await cleanupIgnoringNotFound(() =>
          client.locales.delete(created.localeCode),
        );
      }
    });

    await t.test("root info and member aliases return valid envelopes", async () => {
      const info = await client.getInfo();
      assertApiInfo(info);

      const members = await client.members.list({ limit: 5 });
      const authors = await client.authors.list({ limit: 5 });
      const reviewers = await client.reviewers.list({ limit: 5 });

      assertListResponse(members, assertMember);
      assertListResponse(authors, assertMember);
      assertListResponse(reviewers, assertMember);
    });

    await t.test("statuses CRUD and reorder works", async () => {
      const first = await client.statuses.create({
        name: `${prefix}-draft-a`,
        color: "#111111",
        type: "draft",
        description: "integration test status A",
      });
      const second = await client.statuses.create({
        name: `${prefix}-draft-b`,
        color: "#222222",
        type: "draft",
        description: "integration test status B",
      });

      created.draftStatusIds.push(first.status.id, second.status.id);

      assertStatus(first.status);
      assertStatus(second.status);

      const updated = await client.statuses.update(first.status.id, {
        name: `${prefix}-draft-a-updated`,
        description: "updated description",
      });

      assert.equal(updated.status.name, `${prefix}-draft-a-updated`);

      const reordered = await client.statuses.reorder({
        type: "draft",
        status_ids: [second.status.id, first.status.id],
      });

      assert.equal(reordered.reordered, true);

      const listed = await client.statuses.list({
        type: "draft",
        q: prefix,
        limit: 10,
      });

      assertListResponse(listed, assertStatus);
      const orderedIds = listed.data
        .filter((item) => item.name.includes(prefix))
        .map((item) => item.id);

      assert.deepEqual(
        orderedIds.slice(0, 2),
        [second.status.id, first.status.id],
      );
    });

    await t.test("labels CRUD and reorder works", async () => {
      const first = await client.labels.create({
        name: `${prefix}-label-a`,
        color: "#aa0000",
        description: "integration test label A",
      });
      const second = await client.labels.create({
        name: `${prefix}-label-b`,
        color: "#00aa00",
        description: "integration test label B",
      });

      created.labelIds.push(first.label.id, second.label.id);

      assertLabel(first.label);
      assertLabel(second.label);

      const updated = await client.labels.update(first.label.id, {
        name: `${prefix}-label-a-updated`,
      });
      assert.equal(updated.label.name, `${prefix}-label-a-updated`);

      const reordered = await client.labels.reorder({
        label_ids: [second.label.id, first.label.id],
      });
      assert.equal(reordered.reordered, true);

      const listed = await client.labels.list({
        q: prefix,
        limit: 10,
      });

      assertListResponse(listed, assertLabel);
      const orderedIds = listed.data
        .filter((item) => item.name.includes(prefix))
        .map((item) => item.id);

      assert.deepEqual(
        orderedIds.slice(0, 2),
        [second.label.id, first.label.id],
      );
    });

    await t.test("data models and collections CRUD works", async () => {
      const createdDataModel = await client.dataModels.create({
        name: `${prefix}-model`,
        description: "integration test data model",
        fields: [
          {
            id: `${prefix}-field-text`,
            label: "SEO Title",
            type: "text",
          },
          {
            id: `${prefix}-field-bool`,
            label: "Featured",
            type: "boolean",
          },
        ],
      });

      created.dataModelId = createdDataModel.data_model.id;
      assertDataModel(createdDataModel.data_model);

      const updatedDataModel = await client.dataModels.update(
        createdDataModel.data_model.id,
        {
          description: "updated integration test data model",
          fields: [
            {
              id: `${prefix}-field-text`,
              label: "SEO Title Updated",
              type: "text",
            },
          ],
        },
      );
      assert.equal(
        updatedDataModel.data_model.description,
        "updated integration test data model",
      );

      const dataModels = await client.dataModels.list({
        q: prefix,
        limit: 10,
      });
      assertListResponse(dataModels, assertDataModel);

      const createdCollection = await client.collections.create({
        name: `${prefix}-collection`,
        description: "integration test collection",
        default_data_model_id: createdDataModel.data_model.id,
        team_ids: [`${prefix}-team`],
      });

      created.collectionId = createdCollection.collection.id;
      assertCollection(createdCollection.collection);

      const updatedCollection = await client.collections.update(
        createdCollection.collection.id,
        {
          name: `${prefix}-collection-updated`,
          description: "updated integration test collection",
        },
      );

      assert.equal(
        updatedCollection.collection.name,
        `${prefix}-collection-updated`,
      );

      const collections = await client.collections.list({
        q: prefix,
        limit: 10,
      });
      assertListResponse(collections, assertCollection);
    });

    await t.test("pages CRUD, duplication, translation, trash flow and media work", async () => {
      const localeCode = `${prefix.replace(/[^a-z0-9]/g, "").slice(0, 7)}x`;
      const locale = await client.locales.create({
        code: localeCode,
        name: `${prefix} locale`,
      });
      created.localeCode = locale.locale.code;
      assertLocale(locale.locale);

      const locales = await client.locales.list();
      assert.equal(Array.isArray(locales), true);
      assert.equal(locales.some((item) => item.code === localeCode), true);

      const pageResult = await client.pages.create({
        title: `${prefix} page`,
        language: "en",
        collection_id: created.collectionId,
        data_model_id: created.dataModelId,
        label_ids: created.labelIds,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Integration page",
              },
            ],
          },
        ],
        fields: {
          [`${prefix}-field-text`]: "hello",
        },
        slug: `${prefix}-page`,
        meta_name: `${prefix} meta`,
        meta_description: `${prefix} description`,
      });

      const pageId = pageResult.page.id;
      created.pageIds.push(pageId);
      assertPage(pageResult.page);

      const listed = await client.pages.list({
        q: prefix,
        include_content: true,
        label_id: created.labelIds,
        slug: `${prefix}-page`,
        limit: 10,
      });

      assertListResponse(listed, (page) =>
        assertPageSummary(page, { expectContent: true }),
      );
      assert.equal(listed.data.some((item) => item.id === pageId), true);

      const fetched = await client.pages.get(pageId);
      assertPage(fetched);

      const updated = await client.pages.update(pageId, {
        title: `${prefix} page updated`,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Updated",
              },
            ],
          },
        ],
        meta_name: `${prefix} meta updated`,
      });

      assert.equal(updated.page.title, `${prefix} page updated`);
      assert.equal(Array.isArray(updated.page.content), true);

      const duplicate = await client.pages.duplicate(pageId);
      created.pageIds.push(duplicate.page.id);
      assertPage(duplicate.page);
      assert.notEqual(duplicate.page.id, pageId);

      const translation = await client.pages.createTranslation(pageId, {
        language: localeCode,
        mode: "copy",
      });
      created.pageIds.push(translation.page.id);
      assertPage(translation.page);
      assert.equal(translation.page.language, localeCode);

      const upload = await client.media.upload({
        file: makeTinyPngBytes(),
        file_name: `${prefix}.png`,
        content_type: "image/png",
        page_id: pageId,
        alt: `${prefix} image`,
      });

      created.mediaId = upload.media.id;
      assertMedia(upload.media);
      assert.equal(typeof upload.editor_node, "object");

      const mediaList = await client.media.list({
        page_id: pageId,
        limit: 10,
      });
      assertListResponse(mediaList, assertMedia);
      assert.equal(mediaList.data.some((item) => item.id === upload.media.id), true);

      const mediaDetail = await client.media.get(upload.media.id);
      assertMediaDetail(mediaDetail);

      const mediaUpdated = await client.media.update(upload.media.id, {
        file_name: `${prefix}-updated.png`,
        alt: `${prefix} image updated`,
      });
      assert.equal(mediaUpdated.media.file_name, `${prefix}-updated.png`);
      assert.equal(mediaUpdated.media.alt, `${prefix} image updated`);

      const mediaDeleted = await client.media.delete(upload.media.id);
      assert.equal(mediaDeleted.deleted, true);
      created.mediaId = null;

      const deleted = await client.pages.delete(pageId);
      assert.equal(deleted.deleted, true);

      const deletedPage = await client.pages.get(pageId, {
        include_deleted: true,
      });
      assertPage(deletedPage);
      assert.notEqual(deletedPage.deleted_at, null);

      const restored = await client.pages.restore(pageId);
      assert.equal(restored.restored, true);
      assert.equal(restored.page.id, pageId);

      const deletedAgain = await client.pages.delete(pageId);
      assert.equal(deletedAgain.deleted, true);

      const permanentlyDeleted = await client.pages.permanentlyDelete(pageId);
      assert.equal(permanentlyDeleted.permanently_deleted, true);
      created.pageIds = created.pageIds.filter((id) => id !== pageId);
    });

    await t.test("AI endpoints return expected format when model is provided", async (inner) => {
      if (!aiModel) {
        inner.skip("Set PARAGRAPH_AI_MODEL to run live AI endpoint tests.");
      }

      const metaName = await client.ai.generateMetaName({
        model: aiModel,
        title: `${prefix} article`,
        content: [],
      });
      assert.equal(typeof metaName.meta_name, "string");
      assert.equal(metaName.meta_name.length > 0, true);

      const metaDescription = await client.ai.generateMetaDescription({
        model: aiModel,
        title: `${prefix} article`,
        content: [],
      });
      assert.equal(typeof metaDescription.meta_description, "string");
      assert.equal(metaDescription.meta_description.length > 0, true);

      const content = await client.ai.generateContent({
        model: aiModel,
        title: `${prefix} article`,
        content: [],
        prompt: "Write a very short intro paragraph.",
      });
      assert.equal(typeof content.title, "string");
      assert.equal(Array.isArray(content.content), true);
    });
  },
);
