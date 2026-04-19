type EngagementAction = "VIEW" | "DOWNLOAD" | "SHARE"

export async function trackPhotoEngagement(photoId: string, action: EngagementAction) {
  if (!photoId) return

  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

    await fetch(`${apiUrl}/photos/${photoId}/engagement`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action }),
    })
  } catch (error) {
    // Tracking should never block user actions.
    console.error("Failed to track photo engagement:", error)
  }
}
