"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, AlertCircle, Share2, Loader2, Heart, ZoomIn, ZoomOut, Maximize2, Minimize2, Copy, Facebook, MessageCircle, X } from "lucide-react"
import { format } from 'date-fns'
import { downloadPhoto } from "@/lib/download"
import { apiClient } from "@/lib/api-client"
import { sharePhotoToChannel, type ShareChannel } from "@/lib/share"
import { trackPhotoEngagement } from "@/lib/engagement-client"

interface Photo {
  id: string
  url: string
  eventName: string
  eventDate: string
  uploadDate?: string
  confidence?: number
}

interface PhotoDetailModalProps {
  photo: Photo | null
  isOpen: boolean
  onClose: () => void
  initialShareOpen?: boolean
}

export function PhotoDetailModal({ photo, isOpen, onClose, initialShareOpen = false }: PhotoDetailModalProps) {
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const trackedViewPhotoIdRef = useRef<string | null>(null)
  const [showRemovalRequest, setShowRemovalRequest] = useState(false)
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false)
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false)
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
      setIsShareSheetOpen(false)
      setActiveShareChannel(null)
      setIsZoomed(false)
      setIsFullscreen(false)
      trackedViewPhotoIdRef.current = null
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && initialShareOpen) {
      setIsShareSheetOpen(true)
    }
  }, [initialShareOpen, isOpen])

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

  useEffect(() => {
    if (!isOpen || !photo) return
    if (trackedViewPhotoIdRef.current === photo.id) return

    trackedViewPhotoIdRef.current = photo.id
    trackPhotoEngagement(photo.id, "VIEW")
  }, [isOpen, photo])

  if (!photo) return null

  const handleDownload = async () => {
    trackPhotoEngagement(photo.id, "DOWNLOAD")
    await downloadPhoto(photo.url, photo.eventName, photo.uploadDate || photo.eventDate)
  }

  const openShareSheet = () => {
    setIsShareSheetOpen(true)
  }

  const handleShareChannel = async (channel: ShareChannel) => {
    try {
      setActiveShareChannel(channel)
      trackPhotoEngagement(photo.id, "SHARE")
      await sharePhotoToChannel(photo, "original", channel)
      setIsShareSheetOpen(false)
    } catch (error) {
      console.error("Failed to share photo:", error)
      alert("Unable to share right now. Please try another channel.")
    } finally {
      setActiveShareChannel(null)
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

    setIsSubmitting(true)
    try {
      const response = await apiClient.requestPhotoRemoval(photo.id, "DELETE", reason)

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
              <p className="font-semibold text-foreground">
                {new Date(photo.uploadDate || photo.eventDate).toLocaleDateString()}
              </p>
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
              
              <div className="flex justify-center">
                <Button
                  onClick={openShareSheet}
                  disabled={isSubmitting}
                  className="group relative h-20 w-full max-w-sm justify-start gap-4 rounded-3xl border border-border bg-transparent px-5 text-left text-foreground shadow-none backdrop-blur-0 transition-all hover:border-red-900 hover:bg-red-800 hover:text-white active:border-red-950 active:bg-red-900 active:text-white"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-transparent transition-transform group-hover:scale-105 group-hover:border-red-200/60 group-hover:bg-white/15 group-active:border-red-100/70 group-active:bg-white/20">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground group-hover:text-white/85 group-active:text-white/85">
                      Share original photo
                    </span>
                    <span className="text-sm font-bold tracking-tight">Original</span>
                  </div>
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
                      disabled={isFavoriteLoading || isSubmitting || isShareSheetOpen}
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

      <Dialog open={isShareSheetOpen} onOpenChange={setIsShareSheetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share photo</DialogTitle>
            <DialogDescription>
              Choose a destination channel for this photo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              onClick={() => handleShareChannel("native")}
              disabled={activeShareChannel !== null}
              className="justify-start gap-3"
            >
              {activeShareChannel === "native" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Native share
            </Button>

            <Button
              onClick={() => handleShareChannel("copy")}
              disabled={activeShareChannel !== null}
              variant="outline"
              className="justify-start gap-3"
            >
              {activeShareChannel === "copy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Copy link
            </Button>

            <Button
              onClick={() => handleShareChannel("line")}
              disabled={activeShareChannel !== null}
              variant="outline"
              className="justify-start gap-3"
            >
              {activeShareChannel === "line" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              LINE
            </Button>

            <Button
              onClick={() => handleShareChannel("whatsapp")}
              disabled={activeShareChannel !== null}
              variant="outline"
              className="justify-start gap-3"
            >
              {activeShareChannel === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              WhatsApp
            </Button>

            <Button
              onClick={() => handleShareChannel("facebook")}
              disabled={activeShareChannel !== null}
              variant="outline"
              className="justify-start gap-3"
            >
              {activeShareChannel === "facebook" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Facebook className="h-4 w-4" />}
              Facebook
            </Button>

            <Button
              onClick={() => handleShareChannel("x")}
              disabled={activeShareChannel !== null}
              variant="outline"
              className="justify-start gap-3"
            >
              {activeShareChannel === "x" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              X
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
