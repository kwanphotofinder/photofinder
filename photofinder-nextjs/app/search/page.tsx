"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Header } from "@/components/header"
import { PhotoGrid } from "@/components/photo-grid"
import { AlertCircle, Loader2, Search } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

interface Photo {
  id: string
  url: string
  uploadDate: string
  eventName: string
  eventDate: string
  confidence: number
  views?: number
  downloads?: number
  shares?: number
}

export default function SearchPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadPhotos = useCallback(async () => {
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

    setIsLoading(true)
    setError(false)

    try {
      const response = await fetch(`/api/me/matches?limit=80`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const data = await response.json()
      if (response.status === 404 && data.error?.includes("reference face")) {
        setPhotos([])
        return
      }
      if (!response.ok) throw new Error(data.error || "Failed to load matched photos")
      setPhotos(data.results || [])
    } catch {
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  return (
    <>
      <Header showLogout />
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="rounded border border-slate-200 bg-white p-6 sm:p-8 shadow-none">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
                <div>
                  <div className="inline-flex items-center gap-2 rounded bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/15">
                    <Search className="h-3.5 w-3.5" /> {t("search.space")}
                  </div>
                  <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    {t("search.title")}
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {t("search.description")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden text-right sm:block">
                    <p className="text-4xl font-bold tracking-tight text-primary">{photos.length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("search.count")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("search.loading")}
            </div>
          ) : error ? (
            <div className="flex min-h-48 items-center justify-center text-sm font-medium text-red-600">
              <AlertCircle className="mr-2 h-5 w-5" />
              {t("search.error")}
            </div>
          ) : photos.length > 0 ? (
            <PhotoGrid
              photos={photos}
              showRank={true}
              compact={true}
              showShare={true}
              showEngagement={true}
              enableBatchDownload={true}
            />
          ) : (
            <div className="relative flex min-h-48 flex-col items-center justify-center overflow-hidden py-12">
              <Search className="h-16 w-16 text-primary/20 mb-3" />
              <p className="text-xl font-bold text-foreground">
                {t("search.empty")}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md text-center">
                {t("search.empty_description")}
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
