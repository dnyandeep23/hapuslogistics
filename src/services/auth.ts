// src/services/auth.ts

import { LoginCredentials, RegisterCredentials, ResetPasswordCredentials } from '@/types';
import { extractErrorMessageFromPayload } from "@/lib/authError";
import {
  GENERIC_AUTH_ERROR_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
} from "@/lib/authFlow";

type ApiResponse = {
  message?: string;
  success?: boolean;
  error?: string;
  [key: string]: unknown;
};

const getStatusFallbackMessage = (status: number) => {
  if (status === 400) return "Invalid request. Please check your details and try again.";
  if (status === 401) return INVALID_CREDENTIALS_MESSAGE;
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "Requested resource was not found.";
  if (status === 409) return "This record already exists.";
  if (status === 429) return "Too many attempts. Please wait and try again.";
  if (status >= 500) return GENERIC_AUTH_ERROR_MESSAGE;
  return GENERIC_AUTH_ERROR_MESSAGE;
};

const NETWORK_ERROR_MESSAGE = GENERIC_AUTH_ERROR_MESSAGE;
const ABORT_ERROR_MESSAGE = GENERIC_AUTH_ERROR_MESSAGE;

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } catch {
    return null;
  }
};

const safeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    return await fetch(input, init);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(ABORT_ERROR_MESSAGE);
    }

    throw new Error(NETWORK_ERROR_MESSAGE);
  }
};

const handleResponse = async <T = ApiResponse>(response: Response): Promise<T> => {
  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(
      extractErrorMessageFromPayload(payload) ??
        getStatusFallbackMessage(response.status),
    );
  }

  return (payload ?? {}) as T;
};

export const registerUser = async (credentials: RegisterCredentials): Promise<ApiResponse> => {
  const response = await safeFetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });
  return handleResponse(response);
};

export const loginUser = async (credentials: LoginCredentials): Promise<ApiResponse> => {
  const response = await safeFetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });
  return handleResponse(response);
};

export const verifyAdminOtp = async (code: string): Promise<ApiResponse> => {
  const response = await safeFetch('/api/auth/admin/verify-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });
  return handleResponse(response);
};

export const resendAdminOtp = async (): Promise<ApiResponse> => {
  const response = await safeFetch('/api/auth/admin/resend-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return handleResponse(response);
};

export const resendVerificationEmail = async (email: string): Promise<ApiResponse> => {
  const response = await safeFetch('/api/auth/resend-verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  return handleResponse(response);
};

export const forgotPassword = async (email: string): Promise<ApiResponse> => {
  const response = await safeFetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  return handleResponse(response);
};

export const resetPassword = async (credentials: ResetPasswordCredentials): Promise<ApiResponse> => {
  const response = await safeFetch('/api/auth/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });
  return handleResponse(response);
};

export const logoutUser = async (): Promise<ApiResponse> => {
  const response = await safeFetch('/api/auth/logout', {
    method: 'GET',
  });
  return handleResponse(response);
};
