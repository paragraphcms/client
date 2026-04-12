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
  total_items: number;
  total_pages: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

export interface ListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiInfo {
  version: string;
  openapi_url: string;
  authentication: {
    type: "api_key";
    supported_headers: ["x-api-key", "authorization"];
    authorization_format: "Bearer <api-key>";
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
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  headers?: HeadersInit;
  timeoutMs?: number;
  maxRequestsPerSecond?: number;
}

export interface ListQuery {
  limit?: number;
  page?: number;
  q?: string;
  sort?: string;
}

export interface Member {
  id: string;
  user_id: string;
  role: string;
  name: string | null;
  email: string | null;
  image_url: string | null;
  created_at: string | null;
}

export interface Status {
  id: string;
  name: string;
  color: string;
  type: StatusType;
  description: string | null;
  order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  description: string | null;
  order: number;
  created_at: string | null;
  last_applied_at: string | null;
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
  created_at: string | null;
  updated_at: string | null;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  default_data_model_id: string | null;
  team_ids: string[];
  page_count: number;
  last_modified_at: string | null;
}

export interface Collection extends CollectionSummary {
  default_data_model: DataModel | null;
}

export interface PageTranslation {
  id: string;
  title: string;
  language: string;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_current: boolean;
}

export interface PageSummary {
  id: string;
  title: string;
  slug: string | null;
  language: string;
  content_format?: PageContentFormat;
  hero_url: string | null;
  collection_id: string | null;
  collection: Collection | null;
  translation_group_id: string;
  data_model_id: string | null;
  data_model: DataModel | null;
  status_id: string | null;
  status: Status | null;
  author_id: string | null;
  author: Member | null;
  reviewer_id: string | null;
  reviewer: Member | null;
  labels: Label[];
  fields: Record<string, unknown>;
  content?: PageContent;
  meta_name: string | null;
  meta_description: string | null;
  published_at: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Page extends PageSummary {
  content: PageContent;
  translations: PageTranslation[];
}

export interface Media {
  id: string;
  page_id: string | null;
  file_name: string;
  alt: string | null;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface MediaReferencePage {
  id: string;
  title: string;
  slug: string | null;
  language: string | null;
  translation_group_id: string | null;
  updated_at: string | null;
  is_unassigned: boolean;
}

export interface MediaDetail extends Media {
  reference_page_count: number;
  last_modified_at: string | null;
  reference_pages: MediaReferencePage[];
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
  editor_node: EditorNode;
}

export interface MediaMutationResult {
  message: string;
  media: MediaDetail;
}

export interface MediaDeleteResult {
  id: string;
  deleted: boolean;
  deleted_count: number;
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
  data_model: DataModel;
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
  meta_name: string;
}

export interface AiMetaDescriptionResult {
  message: string;
  meta_description: string;
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
  permanently_deleted: boolean;
  message: string;
}

export interface ReorderResult {
  reordered: boolean;
  message: string;
}

export interface PageListQuery extends ListQuery {
  include_content?: boolean;
  deleted?: DeletedFilter;
  collection_id?: string;
  without_collection?: boolean;
  data_model_id?: string;
  status_id?: string;
  status_type?: StatusType;
  author_id?: string;
  reviewer_id?: string;
  language?: string;
  translation_group_id?: string;
  slug?: string;
  label_id?: string[];
  updated_after?: string;
  updated_before?: string;
  published_after?: string;
  published_before?: string;
  published?: boolean;
}

export interface GetPageQuery {
  include_deleted?: boolean;
}

export interface CreatePageRequest {
  title?: string;
  hero_url?: string | null;
  collection_id?: string | null;
  data_model_id?: string | null;
  language?: string;
  status_id?: string | null;
  author_id?: string | null;
  reviewer_id?: string | null;
  published_at?: string | null;
  content_format?: PageContentFormat;
  content?: PageContent;
  fields?: Record<string, unknown>;
  slug?: string | null;
  meta_name?: string | null;
  meta_description?: string | null;
  label_ids?: string[];
}

export type UpdatePageRequest = CreatePageRequest;

export interface CreatePageTranslationRequest {
  language: string;
  mode?: PageTranslationMode;
  model?: string;
}

export interface CollectionListQuery extends ListQuery {
  default_data_model_id?: string;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string | null;
  default_data_model_id?: string | null;
  team_ids?: string[];
}

export type UpdateCollectionRequest = Partial<CreateCollectionRequest>;

export interface MediaListQuery extends ListQuery {
  page_id?: string;
  mime_type?: string;
}

export interface UploadMediaRequest {
  file: Uploadable;
  file_name?: string;
  content_type?: string;
  page_id: string;
  alt?: string | null;
}

export interface UpdateMediaRequest {
  file_name?: string;
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
  status_ids: string[];
}

export interface CreateLabelRequest {
  name: string;
  color: string;
  description?: string;
}

export type UpdateLabelRequest = Partial<CreateLabelRequest>;

export interface LabelListQuery extends ListQuery {}

export interface ReorderLabelsRequest {
  label_ids: string[];
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
