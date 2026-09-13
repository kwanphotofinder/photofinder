"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, AlertCircle, Share2, Loader2, Heart, ZoomIn, ZoomOut, Maximize2, Minimize2, Facebook, MessageCircle, Info, Download, CalendarDays, X } from "lucide-react"
import { downloadOriginalPhoto } from "@/lib/download"
import { apiClient } from "@/lib/api-client"
import { sharePhotoOriginal, sharePhotoToChannel, type ShareChannel } from "@/lib/share"
import { trackPhotoEngagement } from "@/lib/engagement-client"

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

interface PhotoDetailModalProps {
  photo: Photo | null
  isOpen: boolean
  onClose: () => void
  initialShareOpen?: boolean
}

function formatDayMonthYear(dateValue?: string) {
  if (!dateValue) return "-"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-GB").format(date)
}

export function PhotoDetailModal({ photo, isOpen, onClose }: PhotoDetailModalProps) {
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const trackedViewPhotoIdRef = useRef<string | null>(null)
  const [showRemovalRequest, setShowRemovalRequest] = useState(false)
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false)
  const [activeShareChannel, setActiveShareChannel] = useState<ShareChannel | null>(null)
  const [isZoomed, setIsZoomed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowRemovalRequest(false)
      setReason("")
      setIsFavorite(false)
      setIsFavoriteLoading(false)
      setActiveShareChannel(null)
      setIsZoomed(false)
      setIsFullscreen(false)
      trackedViewPhotoIdRef.current = null
    }
  }, [isOpen])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === imageContainerRef.current)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !photo) return

    const loadFavoriteState = async () => {
      try {
        setIsFavoriteLoading(true)
        const userId = localStorage.getItem("user_id") || "guest"
        const response = await apiClient.getSavedPhotos(userId)

        if (response.status === 200 && response.data) {
          setIsFavorite((response.data as any[]).some((item) => item.photo.id === photo.id))
        }
      } catch (error) {
        console.error("Failed to load favorite state:", error)
      } finally {
        setIsFavoriteLoading(false)
      }
    }

    loadFavoriteState()
  }, [isOpen, photo])

  useEffect(() => {
    if (!isOpen || !photo) return
    if (trackedViewPhotoIdRef.current === photo.id) return

    trackedViewPhotoIdRef.current = photo.id
    trackPhotoEngagement(photo.id, "VIEW")
  }, [isOpen, photo])

  if (!photo) return null

  const photoDate = formatDayMonthYear(photo.uploadDate || photo.eventDate)
  const matchPercent = photo.confidence !== undefined && photo.confidence > 0
    ? Math.round(photo.confidence * 100)
    : null

  const handleDownload = async () => {
    trackPhotoEngagement(photo.id, "DOWNLOAD")
    await downloadOriginalPhoto(photo.url, photo.eventName, photo.uploadDate || photo.eventDate)
  }

  const handleNativeShare = async () => {
    try {
      await sharePhotoOriginal(photo)
      trackPhotoEngagement(photo.id, "SHARE")
    } catch (error) {
      console.error("Failed to share photo:", error)
      alert("Unable to open share right now. Please try again.")
    }
  }

  const handleQuickShare = async (channel: "line" | "facebook") => {
    try {
      setActiveShareChannel(channel)
      await sharePhotoToChannel(photo, "original", channel)
      trackPhotoEngagement(photo.id, "SHARE")
    } catch (error) {
      console.error(`Failed to share photo to ${channel}:`, error)
      alert("Unable to open share right now. Please try again.")
    } finally {
      setActiveShareChannel(null)
    }
  }

  const handleToggleFavorite = async () => {
    try {
      setIsFavoriteLoading(true)
      const userId = localStorage.getItem("user_id") || "guest"
      if (isFavorite) {
        const response = await apiClient.removeSavedPhoto(userId, photo.id)

        if (response.status === 200) {
          setIsFavorite(false)
        } else {
          alert("Unable to remove this photo from Favorites right now.")
        }
      } else {
        const response = await apiClient.savePhoto(userId, photo.id)

        if (response.status === 201) {
          setIsFavorite(true)
        } else {
          alert("Unable to add this photo to Favorites right now.")
        }
      }
    } catch (error) {
      console.error("Failed to update favorite state:", error)
      alert("Unable to update Favorites right now.")
    } finally {
      setIsFavoriteLoading(false)
    }
  }

  const handleToggleZoom = () => {
    setIsZoomed((prev) => !prev)
  }

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && imageContainerRef.current) {
        await imageContainerRef.current.requestFullscreen()
      } else if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch (error) {
      console.error("Failed to toggle fullscreen:", error)
      alert("Fullscreen is not available on this browser.")
    }
  }

  const handleSubmitRemovalRequest = async () => {
    if (!reason.trim()) {
      alert("Please provide a reason for removal")
      return
    }

    setIsSubmitting(true)
    try {
      const faceCoordinates = (photo.x !== undefined && photo.y !== undefined && photo.w !== undefined && photo.h !== undefined)
        ? `${Math.round(photo.x)},${Math.round(photo.y)},${Math.round(photo.w)},${Math.round(photo.h)}`
        : undefined

      const response = await apiClient.requestPhotoRemoval(photo.id, "DELETE", reason, faceCoordinates)

      if (response.error) {
        alert("Failed to submit removal request. Please try again.")
      } else {
        alert("Removal request submitted successfully. Our team will review it within 24 hours.")
        setShowRemovalRequest(false)
        setReason("")
        onClose()
      }
    } catch (error) {
      alert("An error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const viewerButtonClass =
    "h-9 w-9 rounded-full border-0 bg-black/45 text-white shadow-none backdrop-blur-md hover:bg-black/70"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        overlayClassName="bg-black/70 backdrop-blur-[2px]"
        className="max-h-[92vh] gap-0 overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-950 shadow-[0_24px_80px_rgba(66,16,18,0.28)] sm:max-w-5xl lg:overflow-hidden"
      >
        <div className="grid lg:max-h-[92vh] lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,340px)]">
          <div
            ref={imageContainerRef}
            className={`relative flex items-center justify-center overflow-hidden bg-[#171514] ${
              isFullscreen ? "h-screen w-screen p-4 sm:p-10" : "h-[min(52vh,440px)] min-h-[260px] lg:h-auto lg:min-h-[72vh]"
            }`}
          >
            <Image
              src={photo.url || "/placeholder.svg"}
              alt={photo.eventName}
              width={1200}
              height={900}
              onClick={handleToggleZoom}
              className={`h-auto max-h-full max-w-full object-contain transition-transform duration-300 ${
                isZoomed ? "scale-[1.55] cursor-zoom-out" : "scale-100 cursor-zoom-in"
              }`}
            />

            {!isFullscreen && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-28 bg-gradient-to-t from-black/55 to-transparent lg:block" />
            )}

            <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
              {matchPercent !== null && (
                <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                  {matchPercent}% match
                </span>
              )}
            </div>

            <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
              <Button size="icon" variant="secondary" className={viewerButtonClass} onClick={handleDownload} title="Download original photo without watermark">
                <Download className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" className={viewerButtonClass} onClick={handleToggleZoom} title={isZoomed ? "Zoom out" : "Zoom in"}>
                {isZoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="secondary" className={viewerButtonClass} onClick={handleToggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <DialogClose className={`${viewerButtonClass} inline-flex items-center justify-center`} aria-label="Close">
                <X className="h-4 w-4" />
              </DialogClose>
            </div>
          </div>

          <div className="flex flex-col bg-[#faf9f7] lg:max-h-[92vh] lg:overflow-y-auto">
            <DialogHeader className="gap-0 border-b border-[#ece6df] bg-white px-5 py-5 text-left sm:px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#82181a]">Photo moment</p>
              <DialogTitle className="mt-1.5 text-xl font-black tracking-[-0.03em] text-[#421012]">
                {photo.eventName}
              </DialogTitle>
              <DialogDescription className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                {photoDate}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
              <div className="flex gap-2">
                <Button
                  onClick={handleToggleFavorite}
                  disabled={isFavoriteLoading}
                  variant="outline"
                  className={`h-11 flex-1 rounded-xl font-semibold ${
                    isFavorite
                      ? "border-[#82181a] bg-[#82181a] text-white hover:bg-[#641416]"
                      : "border-[#e2d9d0] bg-white text-[#82181a] hover:bg-[#f2e8e3]"
                  }`}
                >
                  {isFavoriteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />}
                  {isFavorite ? "Saved" : "Favorite"}
                </Button>
                <Button
                  onClick={handleNativeShare}
                  disabled={isSubmitting || activeShareChannel !== null}
                  variant="outline"
                  className="h-11 flex-1 rounded-xl border-[#e2d9d0] bg-white font-semibold text-[#421012] hover:bg-[#f2e8e3]"
                >
                  {activeShareChannel === "native" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  Share
                </Button>
              </div>

              <Button
                onClick={handleDownload}
                className="h-12 rounded-xl bg-[#82181a] text-sm font-bold text-white hover:bg-[#641416]"
              >
                <Download className="h-4 w-4" />
                Download original
              </Button>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Share to</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleQuickShare("line")}
                    disabled={isSubmitting || activeShareChannel !== null}
                    variant="outline"
                    className="h-11 rounded-xl border-[#d8efe0] bg-[#f3fbf6] font-semibold text-[#0d8a45] hover:bg-[#e5f6ec]"
                  >
                    {activeShareChannel === "line" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                    LINE
                  </Button>
                  <Button
                    onClick={() => handleQuickShare("facebook")}
                    disabled={isSubmitting || activeShareChannel !== null}
                    variant="outline"
                    className="h-11 rounded-xl border-[#d7e4f6] bg-[#f4f8fd] font-semibold text-[#1877F2] hover:bg-[#e8f1fb]"
                  >
                    {activeShareChannel === "facebook" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Facebook className="h-4 w-4" />}
                    Facebook
                  </Button>
                </div>
              </div>

              {!showRemovalRequest ? (
                <Button
                  variant="ghost"
                  className="mt-auto h-10 w-full text-xs font-medium text-muted-foreground/70 hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => setShowRemovalRequest(true)}
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Request Removal
                </Button>
              ) : (
                <div className="space-y-3 rounded-2xl border border-destructive/20 bg-destructive/8 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold text-foreground">Request Photo Removal</p>
                      <p className="text-muted-foreground">
                        Our team will review your request within 24 hours. You'll receive an email confirmation.
                      </p>
                      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/5 p-3">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="text-xs leading-relaxed text-foreground/80">
                          <strong className="font-semibold text-primary">Group Photos:</strong> If this photo contains multiple people, our team may choose to apply a mosaic pixelation to your face instead of deleting the entire photo. This ensures your privacy is protected while preserving the memory for others.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Reason for Removal <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      placeholder="Please explain why you want this photo removed"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="min-h-[80px] rounded-xl"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={handleSubmitRemovalRequest}
                      disabled={isSubmitting}
                      className="flex-1 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Request"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowRemovalRequest(false)
                        setReason("")
                      }}
                      disabled={isSubmitting}
                      className="flex-1 rounded-xl border-border"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
