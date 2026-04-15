const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

function handleUnauthorized(status: number) {
  if (status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_data");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_role");
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login?expired=true";
    }
  }
}

async function apiCall<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE}${endpoint}`;
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });

    handleUnauthorized(response.status);

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = {};
    }

    return {
      data: response.ok ? data : undefined,
      error: response.ok ? undefined : data.error || "An error occurred",
      status: response.status,
    };
  } catch (error) {
    return {
      error: "Network error",
      status: 0,
    };
  }
}

export const apiClient = {
  // Auth
  loginWithGoogle: (token: string) =>
    apiCall<any>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  exchangeOIDC: (code: string, state: string) =>
    apiCall("/auth/oidc/exchange", {
      method: "POST",
      body: JSON.stringify({ code, state }),
    }),

  // Events
  getEvents: () => apiCall("/events"),
  getEvent: (id: string) => apiCall(`/events/${id}`),
  createEvent: (data: any) =>
    apiCall("/events", { method: "POST", body: JSON.stringify(data) }),
  updateEvent: (id: string, data: any) =>
    apiCall(`/events/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteEvent: (id: string) => apiCall(`/events/${id}`, { method: "DELETE" }),
  uploadPhotos: async (eventId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const response = await fetch(`${API_BASE}/events/${eventId}/upload`, {
      method: "POST",
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    handleUnauthorized(response.status);
    return response.json();
  },

  // Search
  searchByFace: async (imageData: string, eventId?: string) => {
    try {
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();

      // Create FormData
      const formData = new FormData();
      formData.append("file", blob, "search-image.jpg");
      if (eventId) {
        formData.append("eventId", eventId);
      }

      // Send as multipart/form-data
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch(`${API_BASE}/search/face`, {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      handleUnauthorized(res.status);

      const data = await res.json();
      console.log("Backend response:", data);

      return { data, error: null };
    } catch (error) {
      console.error("searchByFace error:", error);
      return {
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  // Photos
  getAllPhotos: () => apiCall("/photos"),
  getMyPhotos: () => apiCall("/me/my-photos"),
  deletePhoto: (photoId: string) =>
    apiCall(`/photos/${photoId}`, {
      method: "DELETE",
    }),
  requestPhotoRemoval: (
    photoId: string,
    requestType: string,
    userName: string,
    userEmail: string,
    reason?: string,
  ) =>
    apiCall("/removal-requests", {
      method: "POST",
      body: JSON.stringify({
        photoId,
        requestType,
        userName,
        userEmail,
        reason,
      }),
    }),
  getRemovalRequests: () => apiCall("/removal-requests"),
  deleteRemovalRequest: (requestId: string) =>
    apiCall(`/removal-requests/${requestId}`, {
      method: "DELETE",
    }),

  // Deliveries
  triggerDelivery: (userId: string, eventId: string, deliveryMethod: string) =>
    apiCall("/delivery/trigger", {
      method: "POST",
      body: JSON.stringify({ userId, eventId, deliveryMethod }),
    }),

  // Privacy
  optOut: (userId: string, optOutType: string, reason?: string) =>
    apiCall(`/persons/${userId}/opt-out`, {
      method: "POST",
      body: JSON.stringify({ optOutType, reason }),
    }),
  getMyConsent: () =>
    apiCall<{ status: string; pdpaConsent: boolean }>("/me/consent", {
      method: "GET",
    }),
  updateMyConsent: (accepted: boolean) =>
    apiCall<{ status: string; pdpaConsent: boolean }>("/me/consent", {
      method: "POST",
      body: JSON.stringify({ accepted }),
    }),
  exportMyPrivacyData: () =>
    apiCall<{ status: string; data: any }>("/me/privacy/export", {
      method: "GET",
    }),
  fullDeleteMyPrivacyData: () =>
    apiCall<{ status: string; message?: string; deletedAt?: string; details?: any }>("/me/privacy/full-delete", {
      method: "POST",
    }),

  // Analytics
  getAnalytics: () => apiCall("/analytics"),

  // Admin User Management
  getAdminUsers: () => apiCall<any>("/admin/users"),
  setUserRole: (email: string, role: string) =>
    apiCall<any>("/admin/users/set-role", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  removeUserRole: (userId: string) =>
    apiCall<any>(`/admin/users/${userId}/role`, {
      method: "DELETE",
    }),
  removeAdmin: (userId: string) =>
    apiCall<any>(`/admin/admins/${userId}`, {
      method: "DELETE",
    }),
};
