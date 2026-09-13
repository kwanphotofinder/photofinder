"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { PhotoGrid } from "@/components/photo-grid"
import { Heart, Loader2, AlertCircle, Sparkles } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { apiClient } from "@/lib/api-client"

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
        const response = await apiClient.getSavedPhotos(userId)

        if (response.status !== 200 || !response.data) {
          throw new Error("Failed to fetch favorites")
        }

        const data = response.data as SavedPhotoResponse[]
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      <Header showLogout />
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
            <div className="rounded border border-slate-200 bg-white px-5 py-6 shadow-none sm:px-8 sm:py-7">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary"><Heart className="h-4 w-4 fill-current" /> {t("favorites.space")}</div>
                  <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("favorites.title")}</h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{t("favorites.description")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 border-l border-slate-200 pl-4 sm:min-w-40">
                  <p className="text-4xl font-bold tracking-tight text-primary">{savedPhotos.length}</p>
                  <p className="max-w-20 text-[10px] font-semibold uppercase leading-4 tracking-wider text-muted-foreground">{t("favorites.count")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8 lg:py-11">
          <section>
            <div className="mb-6 flex items-end justify-between gap-4 border-b border-slate-200 pb-4"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{t("favorites.collection")}</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{t("favorites.saved_collection")}</h2></div><span className="hidden text-xs font-medium text-muted-foreground sm:block">{savedPhotos.length} / {t("favorites.count")}</span></div>
            {isLoading ? (
              <div className="flex min-h-36 items-center justify-center rounded border border-dashed border-slate-300 bg-white py-10 text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />{t("favorites.loading")}</div>
            ) : error ? (
              <div className="flex min-h-36 items-center justify-center rounded border border-red-200 bg-red-50 py-10 text-sm font-medium text-red-600"><AlertCircle className="mr-2 h-5 w-5" />{error}</div>
            ) : savedPhotos.length > 0 ? (
              <PhotoGrid photos={savedPhotos} compact={true} showConfidence={false} showShare={false} />
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-white p-10 text-center"><div className="mb-3 rounded bg-primary/10 p-3 text-primary"><Heart className="h-7 w-7" /></div><p className="text-lg font-semibold text-foreground">{t("favorites.empty")}</p><p className="mt-1 text-sm text-muted-foreground">{t("favorites.empty_description")}</p></div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
