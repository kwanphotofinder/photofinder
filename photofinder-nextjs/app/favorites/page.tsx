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
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(130,24,26,0.14),transparent_36%),radial-gradient(circle_at_top_right,rgba(130,24,26,0.10),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.96),rgba(248,250,252,1))]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      <Header showLogout />
      <main className="min-h-screen bg-[#faf9f7] text-slate-950">
        <div className="border-b border-[#d8d2ca] bg-[#f5f3ef]">
          <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
            <div className="border-t-4 border-[#82181a] bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-7">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#82181a]"><Heart className="h-4 w-4 fill-current" /> {t("favorites.space")}</div>
                  <h1 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#421012] sm:text-4xl">{t("favorites.title")}</h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{t("favorites.description")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 border-l-2 border-[#f4c66a] pl-4 sm:min-w-40">
                  <p className="text-4xl font-black tracking-[-0.04em] text-[#82181a]">{savedPhotos.length}</p>
                  <p className="max-w-20 text-[10px] font-bold uppercase leading-4 tracking-[0.12em] text-slate-500">{t("favorites.count")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <section>
            <div className="mb-7 flex items-end justify-between gap-4 border-b border-[#d8d2ca] pb-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#82181a]">{t("favorites.collection")}</p><h2 className="mt-2 text-2xl font-black tracking-[-0.02em] sm:text-3xl">{t("favorites.saved_collection")}</h2></div><span className="hidden text-xs font-semibold text-slate-500 sm:block">{savedPhotos.length} / {t("favorites.count")}</span></div>
            {isLoading ? (
              <div className="flex min-h-36 items-center justify-center py-10 text-sm text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t("favorites.loading")}</div>
            ) : error ? (
              <div className="flex min-h-36 items-center justify-center py-10 text-sm font-medium text-red-600"><AlertCircle className="mr-2 h-5 w-5" />{error}</div>
            ) : savedPhotos.length > 0 ? (
              <PhotoGrid photos={savedPhotos} compact={true} showConfidence={false} showShare={false} />
            ) : (
              <div className="relative flex min-h-36 items-center justify-center overflow-hidden py-10"><Sparkles className="absolute h-28 w-28 text-[#82181a] opacity-[0.035]" /><p className="select-none text-center text-3xl font-black uppercase tracking-[0.12em] text-[#82181a] opacity-[0.08] sm:text-4xl">{t("favorites.empty")}</p></div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
