export interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
  status?: number;
}
