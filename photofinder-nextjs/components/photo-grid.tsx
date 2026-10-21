"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Trash2, Heart, Download, Share2, Check, X, Loader2, CheckSquare } from "lucide-react"
import { PhotoDetailModal } from "./photo-detail-modal"
import { downloadPhoto, downloadPhotosAsZip } from "@/lib/download"
import { sharePhotoOriginal } from "@/lib/share"
import { trackPhotoEngagement } from "@/lib/engagement-client"
import { apiClient } from "@/lib/api-client"
import { useLanguage } from "@/lib/language-context"

type PhotoStats = {
  views: number
  shares: number
  likes: number
  downloads: number
}

interface Photo {
  id: string
  url: string
  eventName: string
  eventDate: string
  uploadDate?: string
  confidence?: number
  x?: number
  y?: number
  w?: number
  h?: number
  stats?: PhotoStats
}

interface PhotoGridProps {
  photos: Photo[]
  onRemove?: (photoId: string) => void
  showRank?: boolean
  compact?: boolean
  showConfidence?: boolean
  showShare?: boolean
}

function formatDayMonthYear(dateValue?: string) {
  if (!dateValue) return "-"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-GB").format(date)
}

export function PhotoGrid({ photos, onRemove, showRank = false, compact = false, showConfidence = true, showShare = true }: PhotoGridProps) {
  const { t } = useLanguage()
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [openShareSheet, setOpenShareSheet] = useState(false)
  const [savedPhotoIds, setSavedPhotoIds] = useState<string[]>([])
  const [savingPhotoIds, setSavingPhotoIds] = useState<string[]>([])
  const [photoStats, setPhotoStats] = useState<Record<string, PhotoStats>>({})
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([])
  const [isBatchDownloading, setIsBatchDownloading] = useState(false)
  const [batchDownloadStatus, setBatchDownloadStatus] = useState<string>("")

  useEffect(() => {
    setPhotoStats(Object.fromEntries(photos.map((photo) => [photo.id, photo.stats ?? {
      views: 0,
      shares: 0,
      likes: 0,
      downloads: 0,
    }])))
  }, [photos])

  useEffect(() => {
    const loadSavedPhotos = async () => {
      try {
        const userId = localStorage.getItem('user_id') || 'guest'
        const response = await apiClient.getSavedPhotos(userId)
        if (response.status === 200 && response.data) {
          setSavedPhotoIds((response.data as any[]).map((item) => item.photo.id))
        }
      } catch (err) {
        console.error('Failed to load saved photos:', err)
      }
    }
    loadSavedPhotos()
  }, [])

  const openPhoto = (photo: Photo) => {
    if (isSelectionMode) {
      togglePhotoSelection(photo.id)
      return
    }
    void trackPhotoEngagement(photo.id, "VIEW")
    setSelectedPhoto(photo)
    setShowDetail(true)
    setPhotoStats((current) => ({
      ...current,
      [photo.id]: {
        ...(current[photo.id] ?? { views: 0, shares: 0, likes: 0, downloads: 0 }),
        views: (current[photo.id]?.views ?? 0) + 1,
      },
    }))
  }

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds((current) => current.includes(photoId)
      ? current.filter((id) => id !== photoId)
      : [...current, photoId])
  }

  const handleSelectAll = () => {
    setSelectedPhotoIds(photos.map((p) => p.id))
  }

  const handleClearSelection = () => {
    setSelectedPhotoIds([])
  }

  const handleBatchDownload = async () => {
    const selectedPhotos = photos.filter((photo) => selectedPhotoIds.includes(photo.id))
    if (selectedPhotos.length === 0 || isBatchDownloading) return

    setIsBatchDownloading(true)
    setBatchDownloadStatus(
      t("photo.zipping_progress")
        .replace("{current}", "1")
        .replace("{total}", String(selectedPhotos.length))
    )

    try {
      // 1. Track download engagement for each selected photo
      await Promise.allSettled(
        selectedPhotos.map(async (photo) => {
          await trackPhotoEngagement(photo.id, "DOWNLOAD")
          updatePhotoStat(photo.id, "DOWNLOAD")
        })
      )

      // 2. Download all selected photos packaged as a ZIP
      await downloadPhotosAsZip(
        selectedPhotos.map((p) => ({
          id: p.id,
          url: p.url,
          eventName: p.eventName,
          eventDate: p.eventDate,
          uploadDate: p.uploadDate,
        })),
        ({ current, total, stage }) => {
          if (stage === "fetching") {
            setBatchDownloadStatus(
              t("photo.zipping_progress")
                .replace("{current}", String(current))
                .replace("{total}", String(total))
            )
          } else if (stage === "zipping") {
            setBatchDownloadStatus(t("photo.downloading_selected").replace("{count}", String(total)))
          }
        }
      )

      setSelectedPhotoIds([])
      setIsSelectionMode(false)
    } catch (err) {
      console.error("Batch download failed:", err)
      alert("Failed to package photos into ZIP. Please try again.")
    } finally {
      setIsBatchDownloading(false)
      setBatchDownloadStatus("")
    }
  }

  const updatePhotoStat = (photoId: string, action: "DOWNLOAD" | "SHARE") => {
    const statKey = action === "DOWNLOAD" ? "downloads" : "shares"
    setPhotoStats((current) => ({
      ...current,
      [photoId]: {
        ...(current[photoId] ?? { views: 0, shares: 0, likes: 0, downloads: 0 }),
        [statKey]: (current[photoId]?.[statKey] ?? 0) + 1,
      },
    }))
  }

  const handleSavePhoto = async (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (savingPhotoIds.includes(photoId)) return
    setSavingPhotoIds((current) => [...current, photoId])
    try {
      const userId = localStorage.getItem('user_id') || 'guest'

      if (savedPhotoIds.includes(photoId)) {
        const response = await apiClient.removeSavedPhoto(userId, photoId)
        if (response.status === 200) {
          setSavedPhotoIds((current) => current.filter(id => id !== photoId))
          setPhotoStats((current) => ({
            ...current,
            [photoId]: { ...current[photoId], likes: Math.max(0, (current[photoId]?.likes ?? 0) - 1) },
          }))
        }
      } else {
        const response = await apiClient.savePhoto(userId, photoId)
        if (response.status === 201) {
          setSavedPhotoIds((current) => [...current, photoId])
          setPhotoStats((current) => ({
            ...current,
            [photoId]: { ...current[photoId], likes: (current[photoId]?.likes ?? 0) + 1 },
          }))
        }
      }
    } catch (err) {
      console.error('Failed to save/unsave photo:', err)
      alert('Failed to update saved photos. Please try again.')
    } finally {
      setSavingPhotoIds((current) => current.filter(id => id !== photoId))
    }
  }

  const handleDownload = async (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation()
    await trackPhotoEngagement(photo.id, "DOWNLOAD")
    updatePhotoStat(photo.id, "DOWNLOAD")
    await downloadPhoto(photo.url, photo.eventName, photo.uploadDate || photo.eventDate, photo.id)
  }

  const handleShare = async (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation()
    await trackPhotoEngagement(photo.id, "SHARE")
    updatePhotoStat(photo.id, "SHARE")

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await sharePhotoOriginal(photo)
        return
      }
    } catch {
      // Fall through to modal
    }

    openPhoto(photo)
    setOpenShareSheet(true)
  }

  const getConfidenceColor = (confidence: number) => {
    const pct = confidence * 100
    if (pct >= 80) return 'bg-emerald-500 text-white'
    if (pct >= 60) return 'bg-amber-500 text-white'
    return 'bg-rose-500 text-white'
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-border/70 bg-card/75 p-3 shadow-xs backdrop-blur-sm">
        {isSelectionMode ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {t("photo.selected_count").replace("{count}", String(selectedPhotoIds.length))}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-xl text-xs font-medium"
              onClick={selectedPhotoIds.length === photos.length ? handleClearSelection : handleSelectAll}
            >
              {selectedPhotoIds.length === photos.length ? t("photo.deselect_all") : t("photo.select_all")}
            </Button>
            {selectedPhotoIds.length > 0 && selectedPhotoIds.length < photos.length && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                onClick={handleClearSelection}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                {t("photo.clear_selection")}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {photos.length} {t("search.count") || "photos"}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {isSelectionMode ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setIsSelectionMode(false)
                  setSelectedPhotoIds([])
                }}
                disabled={isBatchDownloading}
              >
                {t("photo.cancel_selection")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-xl bg-[#82181a] px-3.5 text-xs font-bold text-white shadow-sm hover:bg-[#641416] disabled:opacity-50"
                onClick={handleBatchDownload}
                disabled={selectedPhotoIds.length === 0 || isBatchDownloading}
              >
                {isBatchDownloading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    <span>{batchDownloadStatus || t("photo.downloading_selected").replace("{count}", String(selectedPhotoIds.length))}</span>
                  </>
                ) : (
                  <>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    <span>
                      {selectedPhotoIds.length > 0
                        ? t("photo.download_zip_selected").replace("{count}", String(selectedPhotoIds.length))
                        : t("photo.download_selected")}
                    </span>
                  </>
                )}
              </Button>
            </>
          ) : (
            photos.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-xl border-[#e2d9d0] bg-white text-xs font-semibold text-foreground hover:border-[#82181a] hover:bg-[#fbf9f8]"
                onClick={() => setIsSelectionMode(true)}
              >
                <CheckSquare className="mr-1.5 h-3.5 w-3.5 text-[#82181a]" />
                {t("photo.select")}
              </Button>
            )
          )}
        </div>
      </div>
      <div className={`grid gap-4 ${compact ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {photos.map((photo) => {
          const stats = photoStats[photo.id] ?? { views: 0, shares: 0, likes: 0, downloads: 0 }

          const isSelected = selectedPhotoIds.includes(photo.id)

          return (
          <Card
            key={photo.id}
            className={`overflow-hidden border bg-card shadow-none transition-all duration-200 group ${
              isSelected
                ? "border-[#82181a] ring-2 ring-[#82181a]/25 shadow-md"
                : "border-border hover:border-primary/40 hover:shadow-xs"
            }`}
          >
            <div 
              className={`relative bg-muted overflow-hidden cursor-pointer ${compact ? "aspect-4/5" : "aspect-square"}`}
              onClick={() => openPhoto(photo)}
            >
              <Image
                src={photo.url || "/placeholder.svg"}
                alt={photo.eventName}
                fill
                className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                sizes={compact ? "(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
              />

              {isSelectionMode && (
                <button
                  type="button"
                  aria-label={`${t("photo.select")} ${photo.eventName}`}
                  aria-pressed={isSelected}
                  onClick={(event) => {
                    event.stopPropagation()
                    togglePhotoSelection(photo.id)
                  }}
                  className={`absolute left-2.5 top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-lg border-2 shadow-md backdrop-blur-sm transition-all duration-150 ${
                    isSelected
                      ? "border-[#82181a] bg-[#82181a] text-white scale-105"
                      : "border-white/90 bg-black/40 text-transparent hover:border-white hover:bg-black/50"
                  }`}
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                </button>
              )}

              {showRank && (
                <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-sm text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-lg ring-1 ring-white/10 z-10">
                  #{photos.indexOf(photo) + 1}
                </div>
              )}

              {showConfidence && photo.confidence !== undefined && photo.confidence > 0 && (
                <div className={`absolute top-2.5 right-2.5 text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg ring-1 ring-white/10 z-10 ${getConfidenceColor(photo.confidence)}`}>
                  {Math.round(photo.confidence * 100)}%
                </div>
              )}

              {savedPhotoIds.includes(photo.id) && (
                <div className="absolute bottom-2.5 right-2.5 z-10">
                  <div className="bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg ring-1 ring-white/20">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                  </div>
                </div>
              )}

              <div className="hidden lg:flex absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 items-center justify-center gap-2">
                <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    className={`shadow-lg backdrop-blur-sm ${savedPhotoIds.includes(photo.id) ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'bg-white/90 hover:bg-white text-foreground'}`}
                    onClick={(e) => handleSavePhoto(photo.id, e)}
                  >
                    <Heart className={`w-4 h-4 ${savedPhotoIds.includes(photo.id) ? 'fill-current' : ''} ${savingPhotoIds.includes(photo.id) ? 'animate-pulse' : ''}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-white/90 hover:bg-white text-foreground shadow-lg backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      openPhoto(photo)
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-white/90 hover:bg-white text-foreground shadow-lg backdrop-blur-sm"
                    onClick={(e) => handleDownload(photo, e)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {showShare && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-white/90 hover:bg-white text-foreground shadow-lg backdrop-blur-sm"
                      onClick={(e) => handleShare(photo, e)}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  )}
                  {onRemove && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="shadow-lg backdrop-blur-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm("Remove this photo from My Photos?")) {
                          onRemove(photo.id)
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3.5 space-y-1">
              <p className={`font-semibold text-foreground truncate ${compact ? "text-xs" : "text-sm"}`}>{photo.eventName}</p>
              <p className="text-xs text-muted-foreground">{formatDayMonthYear(photo.uploadDate || photo.eventDate)}</p>
              <div
                className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 px-0.5 text-[11px] text-muted-foreground"
                aria-label={`${t("photo.stats.views")}: ${stats.views}, ${t("photo.stats.downloads")}: ${stats.downloads}, ${t("photo.stats.shares")}: ${stats.shares}, ${t("photo.stats.likes")}: ${stats.likes}`}
              >
                <span className="inline-flex items-center gap-1" title={`${stats.views} ${t("photo.stats.people_viewed")}`}>
                  <Eye className="h-3.5 w-3.5 text-slate-400" />
                  <strong className="font-semibold text-foreground/80">{stats.views}</strong>
                  <span className="text-[10px] text-muted-foreground/70">{t("photo.stats.unit")}</span>
                </span>
                <span className="inline-flex items-center gap-1" title={`${stats.downloads} ${t("photo.stats.people_downloaded")}`}>
                  <Download className="h-3.5 w-3.5 text-slate-400" />
                  <strong className="font-semibold text-foreground/80">{stats.downloads}</strong>
                  <span className="text-[10px] text-muted-foreground/70">{t("photo.stats.unit")}</span>
                </span>
                <span className="inline-flex items-center gap-1" title={`${stats.shares} ${t("photo.stats.people_shared")}`}>
                  <Share2 className="h-3.5 w-3.5 text-slate-400" />
                  <strong className="font-semibold text-foreground/80">{stats.shares}</strong>
                  <span className="text-[10px] text-muted-foreground/70">{t("photo.stats.unit")}</span>
                </span>
                <span className={`inline-flex items-center gap-1 ${stats.likes > 0 ? "text-primary" : ""}`} title={`${stats.likes} ${t("photo.stats.likes")}`}>
                  <Heart className={`h-3.5 w-3.5 ${stats.likes > 0 ? "fill-current text-primary" : "text-slate-400"}`} />
                  <strong className="font-semibold">{stats.likes}</strong>
                </span>
              </div>
            </div>

            <div className="px-3.5 pb-3.5 lg:hidden">
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className={`flex-1 h-8 ${savedPhotoIds.includes(photo.id) ? 'bg-primary/5 text-primary border-primary/30 hover:bg-primary/10' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSavePhoto(photo.id, e)
                  }}
                >
                  <Heart className={`w-3.5 h-3.5 ${savedPhotoIds.includes(photo.id) ? 'fill-current' : ''} ${savingPhotoIds.includes(photo.id) ? 'animate-pulse' : ''}`} />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    openPhoto(photo)
                  }}
                >
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8"
                  onClick={(e) => handleDownload(photo, e)}
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
                {showShare && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8"
                    onClick={(e) => handleShare(photo, e)}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                {onRemove && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm("Remove this photo from My Photos?")) {
                        onRemove(photo.id)
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
          )
        })}
      </div>

      {selectedPhoto && (
        <PhotoDetailModal
          photo={selectedPhoto}
          isOpen={showDetail}
          onClose={() => {
            setShowDetail(false)
            setOpenShareSheet(false)
          }}
          initialShareOpen={openShareSheet}
          onEngagement={(action) => {
            if (action === "DOWNLOAD" || action === "SHARE") {
              updatePhotoStat(selectedPhoto.id, action)
            }
          }}
        />
      )}
    </>
  )
}
