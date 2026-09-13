"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, AlertCircle, Share2, Loader2, Heart, ZoomIn, ZoomOut, Maximize2, Minimize2, Facebook, MessageCircle, Info, Download } from "lucide-react"
import { format } from 'date-fns'
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

export function PhotoDetailModal({ photo, isOpen, onClose, initialShareOpen = false }: PhotoDetailModalProps) {
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
    // Validate required fields
    if (!reason.trim()) {
      alert("Please provide a reason for removal")
      return
    }

    setIsSubmitting(true)
    try {
      // Create a bounding box string if coordinates exist
      const faceCoordinates = (photo.x !== undefined && photo.y !== undefined && photo.w !== undefined && photo.h !== undefined)
        ? `${Math.round(photo.x)},${Math.round(photo.y)},${Math.round(photo.w)},${Math.round(photo.h)}`
        : undefined;

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-h-[92vh] max-w-3xl overflow-y-auto border-[#d8d2ca] bg-[#faf9f7] p-0 text-slate-950 shadow-2xl">
        <DialogHeader className="border-b border-[#e5dfd8] bg-white px-5 py-5 pr-14 sm:px-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#82181a]">Photo moment</p>
          <DialogTitle className="mt-1 text-xl font-black tracking-[-0.02em] text-[#421012] sm:text-2xl">{photo.eventName}</DialogTitle>
          <p className="mt-1 text-sm text-slate-500">{formatDayMonthYear(photo.uploadDate || photo.eventDate)}</p>
        </DialogHeader>

        <div className="space-y-5 p-4 sm:p-7">
          {/* Photo Display */}
          <div
            ref={imageContainerRef}
            className={`relative flex w-full items-center justify-center overflow-hidden border border-[#d8d2ca] bg-[#eee9e3] shadow-sm ${
              isFullscreen ? "h-screen w-screen border-0 bg-[#171514] p-4 sm:p-10" : "h-[min(62vh,500px)] min-h-[300px] p-3 sm:p-6"
            }`}
          >
            <Image
              src={photo.url || "/placeholder.svg"}
              alt={photo.eventName}
              width={800}
              height={600}
              onClick={handleToggleZoom}
              className={`h-auto max-w-full object-contain transition-transform duration-300 ${
                isFullscreen ? "max-h-full" : "max-h-full"
              } ${isZoomed ? "scale-[1.55] cursor-zoom-out" : "scale-100 cursor-zoom-in"}`}
            />

            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="h-9 w-9 rounded-sm border border-white/20 bg-black/55 text-white shadow hover:bg-black/70"
                onClick={handleDownload}
                title="Download original photo without watermark"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-9 w-9 rounded-sm border border-white/20 bg-black/55 text-white shadow hover:bg-black/70"
                onClick={handleToggleZoom}
                title={isZoomed ? "Zoom out" : "Zoom in"}
              >
                {isZoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-9 w-9 rounded-sm border border-white/20 bg-black/55 text-white shadow hover:bg-black/70"
                onClick={handleToggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Photo Info */}
          <div className="grid grid-cols-2 divide-x divide-[#e5dfd8] border-y border-[#d8d2ca] bg-white">
            <div>
              <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Event</p>
              <p className="px-4 pb-3 pt-1 font-semibold text-[#421012]">{photo.eventName}</p>
            </div>
            <div>
              <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Date</p>
              <p className="px-4 pb-3 pt-1 font-semibold text-[#421012]">
                {formatDayMonthYear(photo.uploadDate || photo.eventDate)}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Button
                onClick={handleToggleFavorite}
                disabled={isFavoriteLoading}
                variant="outline"
                className={`h-11 gap-2 border-[#cfc8bf] bg-white font-semibold ${isFavorite ? "border-[#82181a] bg-[#82181a] text-white hover:bg-[#641416]" : "text-[#82181a] hover:bg-[#f2e8e3]"}`}
              >
                {isFavoriteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />}
                <span className="hidden sm:inline">{isFavorite ? "Saved" : "Favorite"}</span>
              </Button>
                <Button
                  onClick={handleNativeShare}
                  disabled={isSubmitting || activeShareChannel !== null}
                  variant="outline"
                  className="h-11 gap-2 border-[#cfc8bf] bg-white font-semibold text-[#421012] hover:bg-[#f2e8e3]"
                >
                  {activeShareChannel === "native" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  <span className="hidden sm:inline">Share</span>
                </Button>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="h-11 gap-2 border-[#82181a] bg-[#82181a] font-semibold text-white hover:bg-[#641416] sm:col-span-1"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Original</span>
                </Button>
                <Button
                  onClick={() => handleQuickShare("line")}
                  disabled={isSubmitting || activeShareChannel !== null}
                  variant="outline"
                  className="h-11 gap-2 border-[#cfc8bf] bg-white font-semibold text-[#421012] hover:bg-[#f2e8e3]"
                >
                  {activeShareChannel === "line" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  LINE
                </Button>
                <Button
                  onClick={() => handleQuickShare("facebook")}
                  disabled={isSubmitting || activeShareChannel !== null}
                  variant="outline"
                  className="h-11 gap-2 border-[#cfc8bf] bg-white font-semibold text-[#421012] hover:bg-[#f2e8e3]"
                >
                  {activeShareChannel === "facebook" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Facebook className="h-4 w-4" />}
                  Facebook
                </Button>
            </div>

            {!showRemovalRequest ? (
              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  className="h-10 w-full text-xs font-medium text-muted-foreground/60 hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => setShowRemovalRequest(true)}
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Request Removal
                </Button>
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-sm space-y-2">
                    <p className="font-semibold text-foreground">Request Photo Removal</p>
                    <p className="text-muted-foreground">
                      Our team will review your request within 24 hours. You'll receive an email confirmation.
                    </p>
                    <div className="bg-primary/5 border border-primary/20 rounded-md p-3 mt-3 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        <strong className="text-primary font-semibold">Group Photos:</strong> If this photo contains multiple people, our team may choose to apply a mosaic pixelation to your face instead of deleting the entire photo. This ensures your privacy is protected while preserving the memory for others.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">
                      Reason for Removal <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      placeholder="Please explain why you want this photo removed"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="min-h-[80px]"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={handleSubmitRemovalRequest}
                    disabled={isSubmitting}
                    className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
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
                    className="flex-1 border-border"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
