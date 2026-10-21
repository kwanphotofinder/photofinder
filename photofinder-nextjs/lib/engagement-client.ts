type EngagementAction = "VIEW" | "DOWNLOAD" | "SHARE"

function getViewerSessionId(): string {
  if (typeof window === "undefined") return "server"
  try {
    let id = localStorage.getItem("pf_viewer_session")
    if (!id) {
      id = "v_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
      localStorage.setItem("pf_viewer_session", id)
    }
    return id
  } catch {
    return "guest_" + Date.now().toString(36)
  }
}

export async function trackPhotoEngagement(photoId: string, action: EngagementAction) {
  if (!photoId) return false

  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api"

    const response = await fetch(`${apiUrl}/photos/${photoId}/engagement`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "X-Viewer-Id": getViewerSessionId(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action }),
    })
    return response.ok
  } catch (error) {
    // Tracking should never block user actions.
    console.error("Failed to track photo engagement:", error)
    return false
  }
}

