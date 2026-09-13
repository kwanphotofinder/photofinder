"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Trash2, Heart, Download, Share2 } from "lucide-react"
import { PhotoDetailModal } from "./photo-detail-modal"
import { downloadPhoto } from "@/lib/download"
import { trackPhotoEngagement } from "@/lib/engagement-client"
import { apiClient } from "@/lib/api-client"

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
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [openShareSheet, setOpenShareSheet] = useState(false)
  const [savedPhotoIds, setSavedPhotoIds] = useState<string[]>([])
  const [savingPhotoIds, setSavingPhotoIds] = useState<string[]>([])

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
        }
      } else {
        const response = await apiClient.savePhoto(userId, photoId)
        if (response.status === 201) {
          setSavedPhotoIds((current) => [...current, photoId])
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

  const getConfidenceColor = (confidence: number) => {
    const pct = confidence * 100
    if (pct >= 80) return 'bg-emerald-500 text-white'
    if (pct >= 60) return 'bg-amber-500 text-white'
    return 'bg-rose-500 text-white'
  }

  return (
    <>
      <div className={`grid gap-4 ${compact ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {photos.map((photo) => (
          <Card
            key={photo.id}
            className="overflow-hidden border border-border bg-card shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 group"
          >
            <div 
              className={`relative bg-muted overflow-hidden cursor-pointer ${compact ? "aspect-4/5" : "aspect-square"}`}
              onClick={() => {
                setSelectedPhoto(photo)
                setShowDetail(true)
              }}
            >
              <Image
                src={photo.url || "/placeholder.svg"}
                alt={photo.eventName}
                fill
                className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                sizes={compact ? "(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
              />

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
                      setSelectedPhoto(photo)
                      setShowDetail(true)
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
                    setSelectedPhoto(photo)
                    setShowDetail(true)
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
        ))}
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
