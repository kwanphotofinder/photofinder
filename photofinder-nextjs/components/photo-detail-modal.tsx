"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, AlertCircle, Share2, WandSparkles, Loader2, Heart, ZoomIn, ZoomOut, Maximize2, Minimize2 } from "lucide-react"
import { format } from 'date-fns'
import { downloadPhoto } from "@/lib/download"
import { apiClient } from "@/lib/api-client"
import { sharePhotoOriginal, sharePhotoWatermarked } from "@/lib/share"

interface Photo {
  id: string
  url: string
  eventName: string
  eventDate: string
  confidence?: number
}

interface PhotoDetailModalProps {
  photo: Photo | null
  isOpen: boolean
  onClose: () => void
}

export function PhotoDetailModal({ photo, isOpen, onClose }: PhotoDetailModalProps) {
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const [showRemovalRequest, setShowRemovalRequest] = useState(false)
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false)
  const [isSharingOriginal, setIsSharingOriginal] = useState(false)
  const [isSharingWatermarked, setIsSharingWatermarked] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowRemovalRequest(false)
      setReason("")
      setIsFavorite(false)
      setIsFavoriteLoading(false)
      setIsSharingOriginal(false)
      setIsSharingWatermarked(false)
      setIsZoomed(false)
      setIsFullscreen(false)
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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
        const response = await fetch(`${apiUrl}/saved-photos/${userId}`)

        if (response.ok) {
          const savedPhotos = await response.json()
          setIsFavorite(savedPhotos.some((item: any) => item.photo.id === photo.id))
        }
      } catch (error) {
        console.error("Failed to load favorite state:", error)
      } finally {
        setIsFavoriteLoading(false)
      }
    }

    loadFavoriteState()
  }, [isOpen, photo])

  if (!photo) return null

  const handleDownload = async () => {
    await downloadPhoto(photo.url, photo.eventName, photo.eventDate)
  }

  const handleShareOriginal = async () => {
    try {
      setIsSharingOriginal(true)
      await sharePhotoOriginal(photo)
    } catch (error) {
      console.error("Failed to share original photo:", error)
      alert("Unable to share the original photo right now.")
    } finally {
      setIsSharingOriginal(false)
    }
  }

  const handleShareWatermarked = async () => {
    try {
      setIsSharingWatermarked(true)
      await sharePhotoWatermarked(photo)
    } catch (error) {
      console.error("Failed to share watermarked photo:", error)
      alert("Unable to share the watermarked photo right now.")
    } finally {
      setIsSharingWatermarked(false)
    }
  }

  const handleToggleFavorite = async () => {
    try {
      setIsFavoriteLoading(true)
      const userId = localStorage.getItem("user_id") || "guest"
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

      if (isFavorite) {
        const response = await fetch(`${apiUrl}/saved-photos/${userId}/${photo.id}`, {
          method: "DELETE",
          headers: {
            "user-id": userId,
          },
        })

        if (response.ok) {
          setIsFavorite(false)
        } else {
          alert("Unable to remove this photo from Favorites right now.")
        }
      } else {
        const response = await fetch(`${apiUrl}/saved-photos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "user-id": userId,
          },
          body: JSON.stringify({ photoId: photo.id }),
        })

        if (response.ok) {
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

    // Get user info from localStorage
    const userName = localStorage.getItem("user_name") || "Unknown User"
    const userEmail = localStorage.getItem("user_email") || ""

    setIsSubmitting(true)
    try {
      const response = await apiClient.requestPhotoRemoval(photo.id, "DELETE", userName, userEmail, reason)

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{photo.eventName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo Display */}
          <div
            ref={imageContainerRef}
            className={`relative w-full bg-muted rounded-lg overflow-hidden flex items-center justify-center ${
              isFullscreen ? "h-screen" : "h-[400px]"
            }`}
          >
            <Image
              src={photo.url || "/placeholder.svg"}
              alt={photo.eventName}
              width={800}
              height={600}
              onClick={handleToggleZoom}
              className={`w-auto object-contain transition-transform duration-300 ${
                isFullscreen ? "max-h-screen" : "max-h-[400px]"
              } ${isZoomed ? "scale-[1.55] cursor-zoom-out" : "scale-100 cursor-zoom-in"}`}
            />

            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="h-9 w-9 rounded-full bg-black/55 text-white shadow hover:bg-black/70"
                onClick={handleToggleZoom}
                title={isZoomed ? "Zoom out" : "Zoom in"}
              >
                {isZoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-9 w-9 rounded-full bg-black/55 text-white shadow hover:bg-black/70"
                onClick={handleToggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Photo Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-card border border-border rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Event</p>
              <p className="font-semibold text-foreground">{photo.eventName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
              <p className="font-semibold text-foreground">{new Date(photo.eventDate).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Share your moment</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleShareOriginal}
                  disabled={isSharingOriginal || isSharingWatermarked || isSubmitting}
                  className="group relative h-24 flex-col gap-1 rounded-2xl border-none bg-primary/10 text-primary shadow-none transition-all hover:bg-primary hover:text-white"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-sm transition-transform group-hover:scale-110 group-hover:bg-white/20">
                    {isSharingOriginal ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-tight">Original</span>
                </Button>

                <Button
                  onClick={handleShareWatermarked}
                  disabled={isSharingOriginal || isSharingWatermarked || isSubmitting}
                  className="group relative h-24 flex-col gap-1 rounded-2xl border-none bg-amber-500/10 text-amber-600 shadow-none transition-all hover:bg-amber-500 hover:text-white"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-sm transition-transform group-hover:scale-110 group-hover:bg-white/20">
                    {isSharingWatermarked ? <Loader2 className="h-5 w-5 animate-spin" /> : <WandSparkles className="h-5 w-5" />}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-tight">Watermark</span>
                </Button>
              </div>
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
                  </div>
                </div>
                <div className="space-y-3">
                  <Button
                    onClick={handleToggleFavorite}
                    disabled={isFavoriteLoading || isSubmitting || isSharingOriginal || isSharingWatermarked}
                    variant="outline"
                    className={`h-12 w-full rounded-xl border transition-all ${
                      isFavorite
                        ? "border-pink-200 bg-pink-50 text-pink-600 hover:border-pink-300 hover:bg-pink-100 hover:text-pink-700"
                        : "border-border bg-background text-foreground hover:border-pink-200 hover:bg-pink-50 hover:text-pink-600"
                    }`}
                  >
                    {isFavoriteLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Heart className={`mr-2 h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                    )}
                    {isFavorite ? "Saved to Favorites" : "Add to Favorites"}
                  </Button>

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
