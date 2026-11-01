"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { PhotoGrid } from "@/components/photo-grid"
import { Heart, Loader2, AlertCircle, Sparkles } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

interface Photo {
  id: string
  url: string
  eventName: string
  eventDate: string
  uploadDate?: string
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
  const { t } = useLanguage()
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
        const response = await fetch(`/api/saved-photos/${userId}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch favorites")
        }

        const data: SavedPhotoResponse[] = await response.json()
        const photos = data.map((item) => ({
          id: item.photo.id,
          url: item.photo.storageUrl,
          eventName: item.photo.event?.name || "Unknown Event",
          eventDate: item.photo.event?.date || item.photo.createdAt,
          uploadDate: item.photo.createdAt,
          confidence: 0.95,
        }))
        setSavedPhotos(photos)
      } catch (err) {
        console.error("Failed to load saved photos:", err)
          setError(t("favorites.error"))
      } finally {
        setIsLoading(false)
      }
    }

    checkAuthAndLoad()
  }, [router])

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
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="rounded border border-slate-200 bg-white p-6 sm:p-8 shadow-none">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/15">
                    <Heart className="h-3.5 w-3.5 fill-current" /> {t("favorites.space")}
                  </div>
                  <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("favorites.title")}</h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{t("favorites.description")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 border-l-2 border-primary/20 pl-4 sm:min-w-40">
                  <p className="text-4xl font-bold tracking-tight text-primary">{savedPhotos.length}</p>
                  <p className="max-w-20 text-[10px] font-bold uppercase leading-4 tracking-wider text-muted-foreground">{t("favorites.count")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8 lg:py-11">
          <section>
            <div className="mb-6 flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("favorites.saved_collection")}</h2>
              </div>
              <span className="hidden text-xs font-semibold text-muted-foreground sm:block">{savedPhotos.length} / {t("favorites.count")}</span>
            </div>
            {isLoading ? (
              <div className="flex min-h-36 items-center justify-center py-10 text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />{t("favorites.loading")}</div>
            ) : error ? (
              <div className="flex min-h-36 items-center justify-center py-10 text-sm font-medium text-destructive"><AlertCircle className="mr-2 h-5 w-5" />{error}</div>
            ) : savedPhotos.length > 0 ? (
              <PhotoGrid photos={savedPhotos} compact={true} showConfidence={false} showShare={true} enableBatchDownload={true} showEngagement={true} />
            ) : (
              <div className="relative flex flex-col items-center justify-center rounded border border-slate-200 bg-white overflow-hidden p-14 text-center">
                <div className="rounded-2xl bg-primary/10 p-4 ring-1 ring-inset ring-primary/10 mb-4">
                  <Heart className="h-10 w-10 text-primary" strokeWidth={1.8} />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{t("favorites.empty")}</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">คุณยังไม่มีภาพที่บันทึกไว้ สามารถกดรูปหัวใจบนรูปภาพที่คุณชื่นชอบเพื่อเก็บไว้ที่นี่ได้</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
