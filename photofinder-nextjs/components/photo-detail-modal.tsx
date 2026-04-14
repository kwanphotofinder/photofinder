"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Download, Trash2, AlertCircle, Share2, WandSparkles, Loader2, Heart } from "lucide-react"
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
  const [showRemovalRequest, setShowRemovalRequest] = useState(false)
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false)
  const [isSharingOriginal, setIsSharingOriginal] = useState(false)
  const [isSharingWatermarked, setIsSharingWatermarked] = useState(false)

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowRemovalRequest(false)
      setReason("")
      setIsFavorite(false)
      setIsFavoriteLoading(false)
      setIsSharingOriginal(false)
      setIsSharingWatermarked(false)
    }
  }, [isOpen])

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
          <div className="relative w-full max-h-[400px] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            <Image src={photo.url || "/placeholder.svg"} alt={photo.eventName} width={800} height={600} className="object-contain max-h-[400px] w-auto" />
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

              {/* Social Shortcut Buttons */}
              <div className="mt-2 flex items-center justify-center gap-4 border-t border-border/50 pt-4">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Quick Share:</span>
                <div className="flex gap-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2] hover:text-white"
                    onClick={handleShareOriginal}
                    disabled={isSharingOriginal || isSharingWatermarked || isSubmitting}
                  >
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full bg-[#06C755]/10 text-[#06C755] hover:bg-[#06C755] hover:text-white"
                    onClick={handleShareOriginal}
                    disabled={isSharingOriginal || isSharingWatermarked || isSubmitting}
                  >
                    <span className="text-[10px] font-bold">LINE</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full bg-[#1DA1F2]/10 text-[#1DA1F2] hover:bg-[#1DA1F2] hover:text-white"
                    onClick={handleShareOriginal}
                    disabled={isSharingOriginal || isSharingWatermarked || isSubmitting}
                  >
                    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                    </svg>
                  </Button>
                </div>
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
