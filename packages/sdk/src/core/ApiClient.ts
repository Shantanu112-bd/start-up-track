import { ApiErrorResponse, ApiSuccessResponse } from "@cryptopay/types";
import { ApiError } from "./ApiError";

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  getToken?: () => string | null | Promise<string | null>;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private getToken: (() => string | null | Promise<string | null>) | undefined;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 10000;
    this.getToken = config.getToken;
  }

  private async fetchWithTimeout(resource: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(resource, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    if (this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url, config);
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new ApiError(408, "TIMEOUT", "Request timed out");
      }
      throw new ApiError(0, "NETWORK_ERROR", error.message || "Network Error");
    }

    if (!response.ok) {
      let errorBody: ApiErrorResponse | any;
      try {
        errorBody = await response.json();
      } catch {
        throw new ApiError(response.status, "UNKNOWN_ERROR", response.statusText);
      }
      
      const code = errorBody?.error?.code || "API_ERROR";
      const message = errorBody?.error?.message || response.statusText;
      const details = errorBody?.error?.details;
      throw new ApiError(response.status, code, message, details);
    }

    // Handles 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    const data: ApiSuccessResponse<T> | any = await response.json();
    return data?.data !== undefined ? data.data : data;
  }

  get<T>(endpoint: string, options?: Omit<RequestInit, "method">) {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  post<T>(endpoint: string, body?: any, options?: Omit<RequestInit, "method" | "body">) {
    const init: RequestInit = { ...options, method: "POST" };
    if (body) init.body = JSON.stringify(body);
    return this.request<T>(endpoint, init);
  }

  patch<T>(endpoint: string, body?: any, options?: Omit<RequestInit, "method" | "body">) {
    const init: RequestInit = { ...options, method: "PATCH" };
    if (body) init.body = JSON.stringify(body);
    return this.request<T>(endpoint, init);
  }

  delete<T>(endpoint: string, options?: Omit<RequestInit, "method">) {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}
