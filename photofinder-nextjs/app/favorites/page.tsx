"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PhotoGrid } from "@/components/photo-grid"
import { Heart, Loader2, AlertCircle } from "lucide-react"

interface Photo {
  id: string
  url: string
  eventName: string
  eventDate: string
  confidence: number
}

interface SavedPhotoResponse {
  photo: {
    id: string
    storageUrl: string
    createdAt: string
    event?: {
      name: string
      date: string
    }
  }
}

export default function FavoritesPage() {
  const router = useRouter()
  const [savedPhotos, setSavedPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthChecking, setIsAuthChecking] = useState(true)

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const authToken = localStorage.getItem("auth_token")
      const userId = localStorage.getItem("user_id")
      const userRole = localStorage.getItem("user_role")
      
      if (!authToken || !userId) {
        router.push("/login")
        return // Do not clear isAuthChecking so the page stays blank while redirecting
      }

      if (userRole === "photographer") {
        router.push("/photographer")
        return
      } else if (userRole === "admin" || userRole === "super_admin") {
        router.push("/admin/dashboard")
        return
      }

      setIsAuthChecking(false)

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
        const response = await fetch(`${apiUrl}/saved-photos/${userId}`)

        if (!response.ok) {
          throw new Error("Failed to fetch favorites")
        }

        const data: SavedPhotoResponse[] = await response.json()
        const photos = data.map((item) => ({
          id: item.photo.id,
          url: item.photo.storageUrl,
          eventName: item.photo.event?.name || "Unknown Event",
          eventDate: item.photo.event?.date || item.photo.createdAt,
          confidence: 0.95,
        }))
        setSavedPhotos(photos)
      } catch (err) {
        console.error("Failed to load saved photos:", err)
        setError("Unable to load your favorites at this time. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    checkAuthAndLoad()
  }, [router])

  const handleRemoveFromFavorites = async (photoId: string) => {
    // Optimistic UI update
    const previousPhotos = [...savedPhotos]
    setSavedPhotos((prev) => prev.filter((photo) => photo.id !== photoId))

    try {
      const userId = localStorage.getItem("user_id")
      if (!userId) return

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
      const response = await fetch(`${apiUrl}/saved-photos/${userId}/${photoId}`, {
        method: "DELETE",
        headers: {
          "user-id": userId,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to delete favorite")
      }
    } catch (err) {
      console.error("Error removing favorite:", err)
      alert("Unable to remove this photo from Favorites right now.")
      // Revert the optimistic update if API fails
      setSavedPhotos(previousPhotos)
    }
  }

  // Prevent UI flash while checking auth
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(130,24,26,0.14),transparent_36%),radial-gradient(circle_at_top_right,rgba(130,24,26,0.10),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.96),rgba(248,250,252,1))]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      <Header showLogout />
      <main className="min-h-screen relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(130,24,26,0.14),transparent_36%),radial-gradient(circle_at_top_right,rgba(130,24,26,0.10),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.96),rgba(248,250,252,1))]">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent pointer-events-none" />
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-[#82181a]/12 blur-3xl pointer-events-none" />
        <div className="absolute top-48 left-0 h-64 w-64 rounded-full bg-[#82181a]/10 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-8">
          <section className="relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-card/80 shadow-[0_12px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(130,24,26,0.12),rgba(255,255,255,0)_42%,rgba(130,24,26,0.08))]" />
            <div className="relative space-y-6 p-4 sm:p-6 lg:p-7">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                    Your collection
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium">
                    {savedPhotos.length} favorites
                  </Badge>
                </div>

                <div className="space-y-3 max-w-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Heart className="h-6 w-6 text-primary fill-primary" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Favorites</h1>
                      <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                        All the photos you've saved in one place
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-8 space-y-8">
            <section className="space-y-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Your saved photos</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">Saved collection</h2>
                </div>
              </div>

              {isLoading ? (
                <Card className="border-dashed border-border/70 bg-card/70">
                  <CardContent className="flex items-center justify-center p-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading your favorites...</span>
                  </CardContent>
                </Card>
              ) : error ? (
                <Card className="border-dashed border-red-200 bg-red-50/50">
                  <CardContent className="flex items-center justify-center p-10 text-red-600">
                    <AlertCircle className="h-6 w-6 mr-2" />
                    <span className="text-sm font-medium">{error}</span>
                  </CardContent>
                </Card>
              ) : savedPhotos.length > 0 ? (
                <PhotoGrid photos={savedPhotos} onRemove={handleRemoveFromFavorites} showConfidence={false} />
              ) : (
                <Card className="border-dashed border-border/70 bg-card/70">
                  <CardContent className="p-10 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Heart className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold">No favorites yet</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Start saving photos by clicking the heart icon on any photo you love.
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
