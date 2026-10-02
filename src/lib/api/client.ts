/**
 * VectorMind Express API Client
 * Centralized HTTP client connecting the Next.js frontend to the Express backend.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(message: string, status: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vectormind_token');
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('vectormind_token', token);
  } else {
    localStorage.removeItem('vectormind_token');
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Do not set Content-Type for FormData (browser sets boundary automatically)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${API_BASE_URL}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new ApiError(
      `Cannot connect to Express backend at ${API_BASE_URL}. Please ensure the backend server is running (run 'pnpm dev:backend' in terminal).`,
      0,
      'NETWORK_ERROR'
    );
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMsg =
      (isJson && data?.error?.message) ||
      (isJson && data?.error) ||
      (isJson && data?.message) ||
      `Request failed with status ${response.status}`;

    const code = isJson ? data?.error?.code : undefined;
    const details = isJson ? data?.error?.details : undefined;

    throw new ApiError(errorMsg, response.status, code, details);
  }

  return data as T;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  sourceType: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  metadata?: Record<string, any>;
  _count?: {
    chunks: number;
  };
}

export interface CitationItem {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  fileName: string;
  chunkIndex: number;
  pageNumber: number | null;
  similarity: number;
  contentSnippet: string;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  citations?: CitationItem[];
  createdAt: string;
}

export interface ConversationItem {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: MessageItem[];
  _count?: {
    messages: number;
  };
}

export interface SearchResultItem {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  fileName: string;
  chunkIndex: number;
  pageNumber: number | null;
  similarity: number;
  content: string;
}

export const api = {
  auth: {
    register: (body: { email: string; password: string; name?: string }) =>
      request<{ success: boolean; data: { user: UserProfile; token: string } }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify(body) }
      ),
    login: (body: { email: string; password: string }) =>
      request<{ success: boolean; data: { user: UserProfile; token: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(body) }
      ),
    me: () =>
      request<{ success: boolean; data: { user: UserProfile } }>('/auth/me'),
  },

  documents: {
    list: () =>
      request<{ success: boolean; count: number; documents: DocumentItem[] }>(
        '/documents'
      ),
    get: (id: string) =>
      request<{ success: boolean; document: DocumentItem }>(`/documents/${id}`),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/documents/${id}`, {
        method: 'DELETE',
      }),
    upload: (formData: FormData, sync: boolean = true) =>
      request<{
        success: boolean;
        message: string;
        document: DocumentItem;
        stats?: { totalChunks: number; totalPages: number };
      }>(`/documents/upload?sync=${sync}`, {
        method: 'POST',
        body: formData,
      }),
  },

  conversations: {
    list: () =>
      request<{ success: boolean; data: ConversationItem[] }>('/conversations'),
    create: (body: { title?: string; documentId?: string }) =>
      request<{ success: boolean; data: ConversationItem }>('/conversations', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    get: (id: string) =>
      request<{ success: boolean; data: ConversationItem }>(
        `/conversations/${id}`
      ),
    updateTitle: (id: string, title: string) =>
      request<{ success: boolean; data: ConversationItem }>(
        `/conversations/${id}`,
        { method: 'PATCH', body: JSON.stringify({ title }) }
      ),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/conversations/${id}`, {
        method: 'DELETE',
      }),
  },

  search: (body: {
    query: string;
    documentId?: string;
    limit?: number;
    minSimilarity?: number;
  }) =>
    request<{
      success: boolean;
      query: string;
      count: number;
      results: SearchResultItem[];
    }>('/search', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  chat: (body: {
    query: string;
    conversationId?: string;
    documentId?: string;
    topK?: number;
    minSimilarity?: number;
  }) =>
    request<{
      success: boolean;
      data: {
        answer: string;
        query: string;
        sources: CitationItem[];
        citations: CitationItem[];
        contextCount: number;
        model: string;
        conversationId: string;
        userMessageId?: string;
        assistantMessageId?: string;
      };
    }>('/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
