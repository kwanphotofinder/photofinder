"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { SearchResultGrid } from "@/components/search-result-grid"
import { AlertCircle, Loader2, Search } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

interface Photo {
  id: string
  storageUrl: string
  createdAt: string
  event?: { name: string; date: string }
}

export default function SearchPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadPhotos = async () => {
      const authToken = localStorage.getItem("auth_token")
      const userRole = localStorage.getItem("user_role")

      if (!authToken) {
        router.push("/login")
        return
      }

      if (userRole === "photographer") {
        router.push("/photographer")
        return
      }

      if (userRole === "admin" || userRole === "super_admin") {
        router.push("/admin/dashboard")
        return
      }

      try {
        const response = await fetch("/api/photos", {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (!response.ok) throw new Error("Failed to load photos")
        const data: Photo[] = await response.json()
        setPhotos(data)
      } catch {
        setError(true)
      } finally {
        setIsLoading(false)
      }
    }

    loadPhotos()
  }, [router])

  return (
    <>
      <Header showLogout />
      <main className="min-h-screen bg-[#faf9f7] text-slate-950">
        <div className="border-b border-[#d8d2ca] bg-[#f5f3ef]">
          <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
            <div className="border-t-4 border-[#82181a] bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-7">
              <div className="flex items-end justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#82181a]"><Search className="h-4 w-4" /> {t("search.space")}</div>
                  <h1 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#421012] sm:text-4xl">{t("search.title")}</h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{t("search.description")}</p>
                </div>
                <div className="hidden text-right sm:block"><p className="text-4xl font-black tracking-[-0.04em] text-[#82181a]">{photos.length}</p><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{t("search.count")}</p></div>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t("search.loading")}</div>
          ) : error ? (
            <div className="flex min-h-48 items-center justify-center text-sm font-medium text-red-600"><AlertCircle className="mr-2 h-5 w-5" />{t("search.error")}</div>
          ) : photos.length > 0 ? (
            <SearchResultGrid photos={photos.map((photo) => ({ id: photo.id, url: photo.storageUrl, eventName: photo.event?.name || "Campus event", eventDate: photo.event?.date || photo.createdAt, uploadDate: photo.createdAt, confidence: 1 }))} />
          ) : (
            <div className="relative flex min-h-48 items-center justify-center overflow-hidden"><Search className="absolute h-28 w-28 text-[#82181a] opacity-[0.035]" /><p className="select-none text-center text-3xl font-black uppercase tracking-[0.12em] text-[#82181a] opacity-[0.08] sm:text-4xl">{t("search.empty")}</p></div>
          )}
        </div>
      </main>
    </>
  )
}
