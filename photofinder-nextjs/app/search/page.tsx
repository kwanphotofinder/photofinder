"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Header } from "@/components/header"
import { PhotoGrid } from "@/components/photo-grid"
import { AlertCircle, Loader2, Search, SlidersHorizontal, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/language-context"

const DEFAULT_THRESHOLD = 50 // percent (more inclusive by default)
const ABSOLUTE_MIN = 30      // hard floor on client too

interface PhotoStats {
  views: number
  shares: number
  likes: number
  downloads: number
}

interface Photo {
  id: string
  url: string
  uploadDate: string
  eventName: string
  eventDate: string
  confidence: number
  stats?: PhotoStats
}

export default function SearchPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [pendingThreshold, setPendingThreshold] = useState(DEFAULT_THRESHOLD)
  const [showFilter, setShowFilter] = useState(false)

  const loadPhotos = useCallback(async (confidencePct: number) => {
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
      const response = await fetch(`/api/me/matches?threshold=${(confidencePct / 100).toFixed(2)}`, {
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
    loadPhotos(DEFAULT_THRESHOLD)
  }, [loadPhotos])

  const handleApply = () => {
    const clamped = Math.max(ABSOLUTE_MIN, Math.min(100, pendingThreshold))
    setPendingThreshold(clamped)
    setThreshold(clamped)
    setShowFilter(false)
    void loadPhotos(clamped)
  }

  const handleReset = () => {
    setPendingThreshold(DEFAULT_THRESHOLD)
    setThreshold(DEFAULT_THRESHOLD)
    setShowFilter(false)
    void loadPhotos(DEFAULT_THRESHOLD)
  }

  const handleSelectPreset = (value: number) => {
    setPendingThreshold(value)
  }

  const confidenceColor =
    threshold >= 75
      ? "text-emerald-600"
      : threshold >= 50
        ? "text-amber-600"
        : "text-rose-600"

  return (
    <>
      <Header showLogout />
      <main className="min-h-screen bg-[#faf9f7] text-slate-950">
        <div className="border-b border-[#d8d2ca] bg-[#f5f3ef]">
          <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
            <div className="border-t-4 border-[#82181a] bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-7">
              <div className="flex items-end justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#82181a]">
                    <Search className="h-4 w-4" /> {t("search.space")}
                  </div>
                  <h1 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#421012] sm:text-4xl">{t("search.title")}</h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{t("search.description")}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-4xl font-black tracking-[-0.04em] text-[#82181a]">{photos.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{t("search.count")}</p>
                </div>
              </div>

              {/* Confidence filter panel */}
              <div className="mt-5 border-t border-[#ece6df] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={showFilter ? "default" : "outline"}
                      className={`gap-1.5 rounded-lg text-xs font-semibold ${showFilter ? "bg-[#82181a] hover:bg-[#641416]" : "border-[#e2d9d0] text-[#421012] hover:bg-[#f2e8e3]"}`}
                      onClick={() => setShowFilter((p) => !p)}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {t("search.filter.label")}
                    </Button>
                    <span className={`text-sm font-bold ${confidenceColor}`}>
                      {threshold}% {t("detail.match")}
                    </span>
                  </div>
                  {threshold !== DEFAULT_THRESHOLD && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 rounded-lg text-xs text-slate-500 hover:text-[#82181a]"
                      onClick={handleReset}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t("search.filter.reset")}
                    </Button>
                  )}
                </div>

                {showFilter && (
                  <div className="mt-4 rounded-xl border border-[#ece6df] bg-[#faf9f7] p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-700">{t("search.filter.confidence")}</p>
                        <p className="text-[11px] text-slate-500">{t("search.filter.confidence_desc")}</p>
                      </div>
                      <span className="text-xs font-semibold text-[#82181a] bg-[#82181a]/10 px-2.5 py-1 rounded-full self-start sm:self-auto">
                        {t("search.filter.tip")}
                      </span>
                    </div>

                    {/* Quick Presets */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-500">{t("search.filter.presets")}</span>
                      <button
                        type="button"
                        onClick={() => handleSelectPreset(35)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                          pendingThreshold === 35
                            ? "bg-[#82181a] text-white shadow-xs"
                            : "bg-white border border-[#e2d9d0] text-slate-700 hover:border-[#82181a]"
                        }`}
                      >
                        {t("search.filter.preset_broad")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectPreset(50)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                          pendingThreshold === 50
                            ? "bg-[#82181a] text-white shadow-xs"
                            : "bg-white border border-[#e2d9d0] text-slate-700 hover:border-[#82181a]"
                        }`}
                      >
                        ⭐ {t("search.filter.preset_balanced")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectPreset(70)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                          pendingThreshold === 70
                            ? "bg-[#82181a] text-white shadow-xs"
                            : "bg-white border border-[#e2d9d0] text-slate-700 hover:border-[#82181a]"
                        }`}
                      >
                        {t("search.filter.preset_precise")}
                      </button>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <span className="w-8 text-right text-[10px] font-semibold text-slate-500">{ABSOLUTE_MIN}%</span>
                      <input
                        id="confidence-slider"
                        type="range"
                        min={ABSOLUTE_MIN}
                        max={100}
                        step={5}
                        value={pendingThreshold}
                        onChange={(e) => setPendingThreshold(Number(e.target.value))}
                        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[#e2d9d0] accent-[#82181a]"
                      />
                      <span className="w-8 text-[10px] font-semibold text-slate-500">100%</span>
                    </div>
                    <p className="mt-2 text-center text-2xl font-black tracking-tight text-[#82181a]">
                      {pendingThreshold}%
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 rounded-xl bg-[#82181a] text-white hover:bg-[#641416]"
                        onClick={handleApply}
                        disabled={isLoading}
                      >
                        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {t("search.filter.apply")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-xl border-[#e2d9d0] text-[#421012] hover:bg-[#f2e8e3]"
                        onClick={handleReset}
                      >
                        {t("search.filter.reset")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />{t("search.loading")}
            </div>
          ) : error ? (
            <div className="flex min-h-48 items-center justify-center text-sm font-medium text-red-600">
              <AlertCircle className="mr-2 h-5 w-5" />{t("search.error")}
            </div>
          ) : photos.length > 0 ? (
            <PhotoGrid photos={photos} showRank={true} compact={true} showShare={true} />
          ) : (
            <div className="relative flex min-h-48 items-center justify-center overflow-hidden">
              <Search className="absolute h-28 w-28 text-[#82181a] opacity-[0.035]" />
              <p className="select-none text-center text-3xl font-black uppercase tracking-[0.12em] text-[#82181a] opacity-[0.08] sm:text-4xl">{t("search.empty")}</p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}

