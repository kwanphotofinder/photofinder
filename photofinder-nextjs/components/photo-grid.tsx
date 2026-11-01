"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, Trash2, Heart, Download, Share2, CheckSquare, Square, Archive, Loader2, Sparkles } from "lucide-react"
import { PhotoDetailModal } from "./photo-detail-modal"
import { downloadPhoto, downloadPhotosAsZip } from "@/lib/download"
import { trackPhotoEngagement } from "@/lib/engagement-client"

interface Photo {
  id: string
  url: string
  eventName: string
  eventDate: string
  uploadDate?: string
  confidence?: number
  views?: number
  downloads?: number
  shares?: number
  x?: number
  y?: number
  w?: number
  h?: number
}

interface PhotoGridProps {
  photos: Photo[]
  onRemove?: (photoId: string) => void
  showRank?: boolean
  compact?: boolean
  showConfidence?: boolean
  showShare?: boolean
  showEngagement?: boolean
  enableBatchDownload?: boolean
}

function formatDayMonthYear(dateValue?: string) {
  if (!dateValue) return "-"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-GB").format(date)
}

export function PhotoGrid({
  photos,
  onRemove,
  showRank = false,
  compact = false,
  showConfidence = true,
  showShare = true,
  showEngagement = true,
  enableBatchDownload = true,
}: PhotoGridProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [openShareSheet, setOpenShareSheet] = useState(false)
  const [savedPhotoIds, setSavedPhotoIds] = useState<string[]>([])
  
  // Batch selection state
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set())
  const [isZipping, setIsZipping] = useState(false)
  const [zipProgress, setZipProgress] = useState<{ percent: number; current: number; total: number } | null>(null)
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(new Set())

  // Local engagement cache if not provided in props
  const [engagements, setEngagements] = useState<Record<string, { views: number; downloads: number; shares: number }>>({})

  useEffect(() => {
    // Load saved photos from API
    const loadSavedPhotos = async () => {
      try {
        const userId = localStorage.getItem("user_id") || "guest"
        const authToken = localStorage.getItem("auth_token")
        const response = await fetch(`/api/saved-photos/${userId}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        })
        if (response.ok) {
          const savedPhotos = await response.json()
          setSavedPhotoIds(savedPhotos.map((item: any) => item.photo.id))
        }
      } catch (err) {
        console.error("Failed to load saved photos:", err)
      }
    }
    loadSavedPhotos()
  }, [])

  // Fetch engagement stats if missing
  useEffect(() => {
    if (!showEngagement || !photos.length) return
    const missingIds = photos.filter((p) => p.views === undefined).map((p) => p.id)
    if (!missingIds.length) return

    const loadEngagements = async () => {
      try {
        const res = await fetch("/api/photos/engagements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoIds: missingIds }),
        })
        if (res.ok) {
          const data = await res.json()
          setEngagements((prev) => ({ ...prev, ...data }))
        }
      } catch (e) {
        console.warn("Could not fetch photo engagements", e)
      }
    }
    loadEngagements()
  }, [photos, showEngagement])

  const toggleSelectPhoto = (photoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) {
        next.delete(photoId)
      } else {
        next.add(photoId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedPhotoIds.size === photos.length) {
      setSelectedPhotoIds(new Set())
    } else {
      setSelectedPhotoIds(new Set(photos.map((p) => p.id)))
    }
  }

  const handleBatchZipDownload = async () => {
    const selectedPhotos = photos.filter((p) => selectedPhotoIds.has(p.id))
    if (!selectedPhotos.length) return

    setIsZipping(true)
    setZipProgress({ percent: 0, current: 0, total: selectedPhotos.length })

    try {
      // Record download engagement for each selected photo
      selectedPhotos.forEach((p) => trackPhotoEngagement(p.id, "DOWNLOAD"))

      await downloadPhotosAsZip(
        selectedPhotos.map((p) => ({
          url: p.url,
          eventName: p.eventName,
          uploadDate: p.uploadDate,
          eventDate: p.eventDate,
          id: p.id,
        })),
        `photofinder_${selectedPhotos.length}_photos.zip`,
        (percent, current, total) => {
          setZipProgress({ percent, current, total })
        }
      )
    } catch (err) {
      console.error("Batch zip download failed:", err)
      alert("Failed to create ZIP file. Please try downloading individually.")
    } finally {
      setIsZipping(false)
      setZipProgress(null)
    }
  }

  const handleSavePhoto = async (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const userId = localStorage.getItem("user_id") || "guest"
      const authToken = localStorage.getItem("auth_token")
      const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {}

      if (savedPhotoIds.includes(photoId)) {
        const response = await fetch(`/api/saved-photos/${userId}/${photoId}`, {
          method: "DELETE",
          headers: { "user-id": userId, ...authHeaders },
        })
        if (response.ok) {
          setSavedPhotoIds(savedPhotoIds.filter((id) => id !== photoId))
        }
      } else {
        const response = await fetch(`/api/saved-photos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "user-id": userId,
            ...authHeaders,
          },
          body: JSON.stringify({ photoId }),
        })
        if (response.ok) {
          setSavedPhotoIds([...savedPhotoIds, photoId])
        }
      }
    } catch (err) {
      console.error("Failed to save/unsave photo:", err)
      alert("Failed to update saved photos. Please try again.")
    }
  }

  const handleDownload = async (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation()
    trackPhotoEngagement(photo.id, "DOWNLOAD")
    await downloadPhoto(photo.url, photo.eventName, photo.uploadDate || photo.eventDate)
  }

  const handleShare = async (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation()
    trackPhotoEngagement(photo.id, "SHARE")
    setSelectedPhoto(photo)
    setOpenShareSheet(true)
    setShowDetail(true)
  }

  return (
    <>
      {/* Batch Selection Bar */}
      {enableBatchDownload && photos.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-card p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isSelectMode ? "secondary" : "outline"}
              onClick={() => {
                if (isSelectMode) {
                  setSelectedPhotoIds(new Set())
                  setIsSelectMode(false)
                } else {
                  setIsSelectMode(true)
                }
              }}
              className="font-medium text-xs sm:text-sm"
            >
              {isSelectMode ? (
                <>
                  <Square className="mr-1.5 h-3.5 w-3.5" />
                  ยกเลิกเลือกหลายภาพ (Cancel)
                </>
              ) : (
                <>
                  <CheckSquare className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  เลือกหลายภาพ (Select Photos)
                </>
              )}
            </Button>

            {isSelectMode && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSelectAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {selectedPhotoIds.size === photos.length ? "ล้างที่เลือก (Deselect All)" : "เลือกทั้งหมด (Select All)"}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isSelectMode && (
              <span className="text-xs font-semibold text-muted-foreground">
                เลือกแล้ว <strong className="text-foreground">{selectedPhotoIds.size}</strong> จาก {photos.length} รูป
              </span>
            )}

            {isSelectMode && selectedPhotoIds.size > 0 && (
              <Button
                size="sm"
                variant="default"
                disabled={isZipping}
                onClick={handleBatchZipDownload}
                className="bg-primary text-primary-foreground font-semibold shadow-xs"
              >
                {isZipping ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    กำลังสร้าง ZIP ({zipProgress?.percent || 0}%)...
                  </>
                ) : (
                  <>
                    <Archive className="mr-1.5 h-4 w-4" />
                    ดาวน์โหลด ZIP ({selectedPhotoIds.size} รูป)
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Photos Grid */}
      <div className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {photos.map((photo) => {
          const isSelected = selectedPhotoIds.has(photo.id)
          const views = photo.views ?? engagements[photo.id]?.views ?? 0
          const downloads = photo.downloads ?? engagements[photo.id]?.downloads ?? 0
          const shares = photo.shares ?? engagements[photo.id]?.shares ?? 0

          return (
            <Card
              key={photo.id}
              className={`overflow-hidden border transition-all duration-200 group relative ${
                isSelected
                  ? "border-primary ring-2 ring-primary/40 shadow-md"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div
                className={`relative bg-muted overflow-hidden cursor-pointer ${compact ? "aspect-4/5" : "aspect-square"}`}
                onClick={() => {
                  if (isSelectMode) {
                    toggleSelectPhoto(photo.id)
                  } else {
                    setSelectedPhoto(photo)
                    setShowDetail(true)
                  }
                }}
              >
                {failedPhotoIds.has(photo.id) ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-muted/60 text-muted-foreground text-center">
                    <span className="text-2xl mb-1">🖼️</span>
                    <span className="text-[11px] font-medium text-muted-foreground/80">ภาพไม่พร้อมใช้งาน</span>
                    <span className="text-[9px] text-muted-foreground/60">(404 Not Found)</span>
                  </div>
                ) : (
                  <Image
                    src={photo.url || "/placeholder.svg"}
                    alt={photo.eventName}
                    fill
                    onError={() => {
                      setFailedPhotoIds((prev) => new Set(prev).add(photo.id))
                    }}
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}

                {/* Checkbox overlay when in select mode */}
                {isSelectMode && (
                  <div
                    className="absolute top-2 left-2 z-20 bg-background/80 backdrop-blur-xs p-1.5 rounded-md shadow-md cursor-pointer"
                    onClick={(e) => toggleSelectPhoto(photo.id, e)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelectPhoto(photo.id)}
                      className="h-5 w-5"
                    />
                  </div>
                )}

                {/* Rank Badge - Top Left (if not in select mode) */}
                {showRank && !isSelectMode && (
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md z-10">
                    #{photos.indexOf(photo) + 1}
                  </div>
                )}

                {/* Confidence Percentage Badge - Top Right */}
                {showConfidence && photo.confidence !== undefined && photo.confidence > 0 && (
                  <div
                    className={`absolute top-2 right-2 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-md z-10 ${
                      photo.confidence * 100 >= 80
                        ? "bg-emerald-600"
                        : photo.confidence * 100 >= 60
                        ? "bg-amber-600"
                        : "bg-rose-600"
                    }`}
                  >
                    {Math.round(photo.confidence * 100)}%
                  </div>
                )}

                {/* Desktop: Overlay on hover - Only works with mouse */}
                {!isSelectMode && (
                  <div className="hidden 2xl:flex absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className={`${savedPhotoIds.includes(photo.id) ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-white/90 hover:bg-white text-black"} shadow-lg`}
                      onClick={(e) => handleSavePhoto(photo.id, e)}
                    >
                      <Heart className={`w-4 h-4 ${savedPhotoIds.includes(photo.id) ? "fill-current" : ""}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-white/90 hover:bg-white text-black shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPhoto(photo)
                        setShowDetail(true)
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-white/90 hover:bg-white text-black shadow-lg"
                      onClick={(e) => handleDownload(photo, e)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    {showShare && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-white/90 hover:bg-white text-black shadow-lg"
                        onClick={(e) => handleShare(photo, e)}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    )}
                    {onRemove && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="shadow-lg"
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
                )}
              </div>

              {/* Photo Info & Engagement Stats */}
              <div className="p-3 space-y-1.5">
                <p className={`font-semibold text-foreground truncate ${compact ? "text-xs" : "text-sm"}`}>{photo.eventName}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDayMonthYear(photo.uploadDate || photo.eventDate)}</span>
                  
                  {/* Real-time Engagement Counters */}
                  {showEngagement && (
                    <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground/90 font-medium">
                      <span className="flex items-center gap-0.5" title={`${views} คนดู`}>
                        <Eye className="w-3 h-3 text-muted-foreground" />
                        {views}
                      </span>
                      <span className="flex items-center gap-0.5" title={`${downloads} ดาวน์โหลด`}>
                        <Download className="w-3 h-3 text-muted-foreground" />
                        {downloads}
                      </span>
                      <span className="flex items-center gap-0.5" title={`${shares} แชร์`}>
                        <Share2 className="w-3 h-3 text-muted-foreground" />
                        {shares}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons - Mobile / Small screen visible below the image */}
              <div className="p-3 pt-0 2xl:hidden">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className={`shrink-0 ${savedPhotoIds.includes(photo.id) ? "bg-primary hover:bg-primary/90 text-primary-foreground border-primary" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSavePhoto(photo.id, e)
                    }}
                  >
                    <Heart className={`w-4 h-4 ${savedPhotoIds.includes(photo.id) ? "fill-current" : ""}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPhoto(photo)
                      setShowDetail(true)
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={(e) => handleDownload(photo, e)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {showShare && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={(e) => handleShare(photo, e)}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  )}
                  {onRemove && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="shrink-0"
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
        />
      )}
    </>
  )
}

