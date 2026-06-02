export type PageContentFormat = "tiptap";

export type StatusType =
  | "draft"
  | "in-progress"
  | "in-review"
  | "published";

export type DeletedFilter = "exclude" | "include" | "only";

export type DataModelFieldType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "multi-select"
  | "currency"
  | "link";

export type PageTranslationMode = "copy" | "translate";

export type RichTextNode = Record<string, unknown>;

export type RichTextContent = RichTextNode[];

export type PageContent = RichTextContent;

export type Uploadable = File | Blob | ArrayBuffer | ArrayBufferView;

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export type ClientResult<T, E = unknown> =
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      error: E;
    };

export interface ApiInfo {
  version: string;
  openapiUrl: string;
  authentication: {
    type: "apiKey";
    supportedHeaders: ["x-api-key", "authorization"];
    authorizationFormat: "Bearer <api-key>";
  };
  resources: string[];
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
    [key: string]: unknown;
  };
}

export interface RequestDescriptor {
  method: string;
  url: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
  headers?: HeadersInit;
  timeoutMs?: number;
  maxRateLimitRetries?: number;
}

export interface ClientOptions {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  headers?: HeadersInit;
  timeoutMs?: number;
  maxRequestsPerSecond?: number;
  maxRateLimitRetries?: number;
}

export interface ListQuery {
  limit?: number;
  page?: number;
  q?: string;
  sort?: string;
}

export interface Member {
  id: string;
  userId: string;
  role: string;
  name: string | null;
  email: string | null;
  imageUrl: string | null;
  createdAt: string | null;
}

export interface Status {
  id: string;
  name: string;
  color: string;
  type: StatusType;
  description: string | null;
  order: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  description: string | null;
  order: number;
  createdAt: string | null;
  lastAppliedAt: string | null;
}

export interface DataModelField {
  id: string;
  label: string;
  type: DataModelFieldType;
  description?: string;
  [key: string]: unknown;
}

export interface DataModelSummary {
  id: string;
  name: string;
  description: string | null;
}

export interface DataModel extends DataModelSummary {
  fields: DataModelField[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  defaultDataModelId: string | null;
  teamIds: string[];
  pageCount: number;
  lastModifiedAt: string | null;
}

export interface Collection extends CollectionSummary {
  defaultDataModel: DataModel | null;
}

export interface PageTranslation {
  id: string;
  title: string;
  language: string;
  deletedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  isCurrent: boolean;
}

export interface PageSummary {
  id: string;
  title: string;
  slug: string | null;
  language: string;
  contentFormat?: PageContentFormat;
  heroUrl: string | null;
  collectionId: string | null;
  collection: Collection | null;
  translationGroupId: string;
  dataModelId: string | null;
  dataModel: DataModel | null;
  statusId: string | null;
  status: Status | null;
  authorId: string | null;
  author: Member | null;
  reviewerId: string | null;
  reviewer: Member | null;
  labels: Label[];
  fields: Record<string, unknown>;
  content?: PageContent;
  metaName: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  deletedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Page extends PageSummary {
  content: PageContent;
  translations: PageTranslation[];
}

export type PageSummaryWithSlug = Omit<PageSummary, "slug"> & {
  slug: string;
};

export type PageWithSlug = Omit<Page, "slug"> & {
  slug: string;
};

export interface Media {
  id: string;
  pageId: string | null;
  fileName: string;
  alt: string | null;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MediaReferencePage {
  id: string;
  title: string;
  slug: string | null;
  language: string | null;
  translationGroupId: string | null;
  updatedAt: string | null;
  isUnassigned: boolean;
}

export interface MediaDetail extends Media {
  referencePageCount: number;
  lastModifiedAt: string | null;
  referencePages: MediaReferencePage[];
}

export interface Locale {
  id: string;
  code: string;
  name: string;
}

export interface EditorNode {
  [key: string]: unknown;
}

export interface PageMutationResult {
  message: string;
  page: Page;
}

export interface CollectionMutationResult {
  message: string;
  collection: Collection;
}

export interface MediaUploadResult {
  message: string;
  media: Media;
  editorNode: EditorNode;
}

export interface MediaMutationResult {
  message: string;
  media: MediaDetail;
}

export interface MediaDeleteResult {
  id: string;
  deleted: boolean;
  deletedCount: number;
  message: string;
}

export interface StatusMutationResult {
  message: string;
  status: Status;
}

export interface LabelMutationResult {
  message: string;
  label: Label;
}

export interface DataModelMutationResult {
  message: string;
  dataModel: DataModel;
}

export interface LocaleMutationResult {
  message: string;
  locale: {
    id: string | null;
    code: string;
    name: string;
  };
}

export interface AiMetaNameResult {
  message: string;
  metaName: string;
}

export interface AiMetaDescriptionResult {
  message: string;
  metaDescription: string;
}

export interface AiContentResult {
  message: string;
  title: string;
  content: RichTextContent;
}

export interface DeleteResult {
  id: string;
  deleted: boolean;
  message: string;
}

export interface DeleteByCodeResult {
  code: string;
  deleted: boolean;
  message: string;
}

export interface PageRestoreResult {
  id: string;
  restored: boolean;
  message: string;
  page: Page;
}

export interface PermanentDeleteResult {
  id: string;
  permanentlyDeleted: boolean;
  message: string;
}

export interface ReorderResult {
  reordered: boolean;
  message: string;
}

export interface PageListQuery extends ListQuery {
  includeContent?: boolean;
  collection?: string;
  collectionId?: string;
  deleted?: DeletedFilter;
  withoutCollection?: boolean;
  dataModelId?: string;
  statusId?: string;
  statusType?: StatusType;
  authorId?: string;
  reviewerId?: string;
  language?: string;
  translationGroupId?: string;
  slug?: string;
  requiredSlug?: boolean;
  labelIds?: string[];
  updatedAfter?: string;
  updatedBefore?: string;
  publishedAfter?: string;
  publishedBefore?: string;
  hasPublished?: boolean;
  published?: boolean;
}

export type PageListItem<
  TQuery extends PageListQuery | undefined = undefined,
> = TQuery extends { requiredSlug: true }
  ? PageSummaryWithSlug
  : PageSummary;

type DefinedPropertyValue<T, TKey extends PropertyKey> = T extends undefined
  ? never
  : TKey extends keyof T
    ? Exclude<T[TKey], undefined>
    : never;

type HasDefinedProperty<T, TKey extends PropertyKey> = [
  DefinedPropertyValue<T, TKey>,
] extends [never]
  ? false
  : true;

type HasExplicitPagination<T> = HasDefinedProperty<T, "page"> extends true
  ? true
  : HasDefinedProperty<T, "limit">;

export type PageListResult<
  TQuery extends PageListQuery | undefined = undefined,
> = HasExplicitPagination<TQuery> extends true
  ? ListResponse<PageListItem<TQuery>>
  : PageListItem<TQuery>[];

export interface GetPageQuery {
  includeDeleted?: boolean;
}

export interface CreatePageRequest {
  title?: string;
  heroUrl?: string | null;
  collectionId?: string | null;
  dataModelId?: string | null;
  language?: string;
  statusId?: string | null;
  authorId?: string | null;
  reviewerId?: string | null;
  publishedAt?: string | null;
  contentFormat?: PageContentFormat;
  content?: PageContent;
  fields?: Record<string, unknown>;
  slug?: string | null;
  metaName?: string | null;
  metaDescription?: string | null;
  labelIds?: string[];
}

export type UpdatePageRequest = CreatePageRequest;

export interface CreatePageTranslationRequest {
  language: string;
  mode?: PageTranslationMode;
  model?: string;
}

export interface CollectionListQuery extends ListQuery {
  defaultDataModelId?: string;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string | null;
  defaultDataModelId?: string | null;
  teamIds?: string[];
}

export type UpdateCollectionRequest = Partial<CreateCollectionRequest>;

export interface MediaListQuery extends ListQuery {
  pageId?: string;
  mimeType?: string;
}

export interface UploadMediaRequest {
  file: Uploadable;
  fileName?: string;
  contentType?: string;
  pageId: string;
  alt?: string | null;
}

export interface UpdateMediaRequest {
  fileName?: string;
  alt?: string | null;
}

export interface MemberListQuery extends ListQuery {
  role?: string;
}

export interface StatusListQuery extends ListQuery {
  type?: StatusType;
}

export interface CreateStatusRequest {
  name: string;
  color: string;
  type: StatusType;
  description?: string;
}

export type UpdateStatusRequest = Partial<CreateStatusRequest>;

export interface ReorderStatusesRequest {
  type: StatusType;
  statusIds: string[];
}

export interface CreateLabelRequest {
  name: string;
  color: string;
  description?: string;
}

export type UpdateLabelRequest = Partial<CreateLabelRequest>;

export interface LabelListQuery extends ListQuery {}

export interface ReorderLabelsRequest {
  labelIds: string[];
}

export interface DataModelListQuery extends ListQuery {}

export interface CreateDataModelRequest {
  name: string;
  description?: string;
  fields?: DataModelField[];
}

export type UpdateDataModelRequest = Partial<CreateDataModelRequest>;

export interface CreateLocaleRequest {
  code: string;
  name: string;
}

export interface GenerateMetaRequest {
  model: string;
  title?: string;
  content?: RichTextContent;
}

export interface GenerateContentRequest extends GenerateMetaRequest {
  prompt: string;
}
