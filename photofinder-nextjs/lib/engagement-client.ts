type EngagementAction = "VIEW" | "DOWNLOAD" | "SHARE"

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
