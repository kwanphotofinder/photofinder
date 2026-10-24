"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Header } from "@/components/header"
import { PhotoGrid } from "@/components/photo-grid"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2, Search, SlidersHorizontal, Sparkles, HelpCircle } from "lucide-react"
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
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.60)
  const [showSensitivityControl, setShowSensitivityControl] = useState(true)

  const loadPhotos = useCallback(async (threshold: number) => {
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
      const response = await fetch(`/api/me/matches?threshold=${threshold}&limit=80`, {
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
    loadPhotos(confidenceThreshold)
  }, [confidenceThreshold, loadPhotos])

  const handlePreset = (val: number) => {
    setConfidenceThreshold(val)
  }

  return (
    <>
      <Header showLogout />
      <main className="min-h-screen bg-[#faf9f7] text-slate-950">
        <div className="border-b border-[#d8d2ca] bg-[#f5f3ef]">
          <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
            <div className="border-t-4 border-[#82181a] bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-7">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#82181a]">
                    <Search className="h-4 w-4" /> {t("search.space")}
                  </div>
                  <h1 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#421012] sm:text-4xl">
                    {t("search.title")}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                    {t("search.description")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden text-right sm:block">
                    <p className="text-4xl font-black tracking-[-0.04em] text-[#82181a]">{photos.length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {t("search.count")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Match Sensitivity / Confidence Threshold Slider */}
              <div className="mt-6 pt-5 border-t border-[#e8e4dc]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#82181a]" />
                    <span className="text-sm font-bold text-foreground">
                      เกณฑ์ความแม่นยำในการจับคู่ (Match Sensitivity):
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#82181a]/10 text-[#82181a]">
                      {Math.round(confidenceThreshold * 100)}% Match
                    </span>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant={confidenceThreshold === 0.45 ? "default" : "outline"}
                      className={`h-7 px-2.5 text-xs ${
                        confidenceThreshold === 0.45 ? "bg-[#82181a] text-white" : ""
                      }`}
                      onClick={() => handlePreset(0.45)}
                    >
                      กว้าง (45%) ได้ภาพเยอะ
                    </Button>
                    <Button
                      size="sm"
                      variant={confidenceThreshold === 0.60 ? "default" : "outline"}
                      className={`h-7 px-2.5 text-xs ${
                        confidenceThreshold === 0.60 ? "bg-[#82181a] text-white" : ""
                      }`}
                      onClick={() => handlePreset(0.60)}
                    >
                      มาตรฐาน (60%)
                    </Button>
                    <Button
                      size="sm"
                      variant={confidenceThreshold === 0.75 ? "default" : "outline"}
                      className={`h-7 px-2.5 text-xs ${
                        confidenceThreshold === 0.75 ? "bg-[#82181a] text-white" : ""
                      }`}
                      onClick={() => handlePreset(0.75)}
                    >
                      แม่นยำสูง (75%)
                    </Button>
                  </div>
                </div>

                {/* Slider */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center gap-4">
                  <Slider
                    value={[Math.round(confidenceThreshold * 100)]}
                    min={35}
                    max={85}
                    step={5}
                    onValueChange={(val) => {
                      const next = val[0] / 100
                      setConfidenceThreshold(next)
                    }}
                    className="w-full"
                  />
                  <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap hidden sm:inline">
                    {confidenceThreshold <= 0.50 ? "🟢 ได้ภาพมากขึ้น" : confidenceThreshold >= 0.70 ? "🎯 เน้นความแม่นยำ" : "⚖️ สมดุล"}
                  </span>
                </div>

                <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                  <span>
                    <strong>คำแนะนำ:</strong> ปรับค่าความแม่นยำน้อยลง (เช่น 45%–50%) จะทำให้ระบบดึงภาพที่ตรวจพบใบหน้าคุณมากขึ้น เหมาะสำหรับภาพมุมไกลหรือหันข้าง
                  </span>
                </p>
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
              <Search className="h-16 w-16 text-[#82181a] opacity-20 mb-3" />
              <p className="text-xl font-bold text-foreground">
                {t("search.empty")}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md text-center">
                ลองปรับเกณฑ์ความแม่นยำด้านบนให้ต่ำลง (เช่น 45%–50%) เพื่อค้นหาภาพเพิ่มเติม
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
