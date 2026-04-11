"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PhotoGrid } from "@/components/photo-grid"
import { AlertCircle, Camera, CheckCircle2, Loader2, Sparkles, Trash2, UploadCloud } from "lucide-react"

interface Photo {
  id: string
  url: string
  eventName: string
  eventDate: string
  confidence: number
}

function StatCard({ label, value, description }: { label: string; value: string | number; description: string }) {
  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur-md shadow-sm">
      <CardContent className="p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="text-3xl font-semibold tracking-tight">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userName, setUserName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [hasReferenceFace, setHasReferenceFace] = useState(false)
  const [referenceFaceUrl, setReferenceFaceUrl] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [isDeletingReference, setIsDeletingReference] = useState(false)
  const [autoMatches, setAutoMatches] = useState<Photo[]>([])
  const [savedPhotos, setSavedPhotos] = useState<Photo[]>([])
  const [hasConsentedToFaceSearch, setHasConsentedToFaceSearch] = useState(true)
  const [showConsentNotice, setShowConsentNotice] = useState(false)

  const displayName = userName || "Student"

  const stats = useMemo(
    () => [
      {
        label: "Auto matches",
        value: autoMatches.length,
        description: hasReferenceFace ? "New event photos matched by your reference face." : "Activate reference face to unlock matching.",
      },
      {
        label: "Saved photos",
        value: savedPhotos.length,
        description: "Photos you bookmarked for quick access.",
      },
      {
        label: "Reference face",
        value: hasReferenceFace ? "Active" : "Not set",
        description: hasReferenceFace ? "Your auto-search profile is live." : "Upload a selfie to start auto-matching.",
      },
    ],
    [autoMatches.length, hasReferenceFace, savedPhotos.length],
  )

  const fetchDashboardData = async () => {
    const authToken = localStorage.getItem("auth_token")
    if (!authToken) {
      router.push("/login")
      return
    }

    setUserName(localStorage.getItem("user_name") || "")

    try {
      // Check consent status
      const consentRes = await fetch("/api/me/consent", {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const consentData = await consentRes.json()
      const consented = consentRes.ok && consentData.pdpaConsent
      
      console.log("[Dashboard] Consent status:", { ok: consentRes.ok, consented, pdpaConsent: consentData.pdpaConsent })
      setHasConsentedToFaceSearch(consented)

      // If consent withdrawn, delete reference photo
      if (!consented) {
        console.log("[Dashboard] Consent withdrawn, checking for reference photo to delete...")
        const existingFaceRes = await fetch("/api/me/reference-face", {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        const existingFaceData = await existingFaceRes.json()
        console.log("[Dashboard] Existing reference face check:", { ok: existingFaceRes.ok, hasReference: existingFaceData.hasReference })
        
        if (existingFaceData.hasReference) {
          console.log("[Dashboard] Deleting reference photo...")
          const deleteRes = await fetch("/api/me/reference-face", {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
          })
          console.log("[Dashboard] Delete response:", { ok: deleteRes.ok, status: deleteRes.status })
        }
        setHasReferenceFace(false)
        setReferenceFaceUrl("")
        setAutoMatches([])
        setIsLoading(false)
        return
      }

      const faceRes = await fetch("/api/me/reference-face", {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const faceData = await faceRes.json()

      if (faceRes.ok && faceData.hasReference) {
        setHasReferenceFace(true)
        setReferenceFaceUrl(faceData.userFace.imageUrl)

        const matchRes = await fetch("/api/me/matches", {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        const matchData = await matchRes.json()
        if (matchRes.ok) {
          setAutoMatches(matchData.results)
        }
      } else {
        setHasReferenceFace(false)
        setReferenceFaceUrl("")
        setAutoMatches([])
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
      const storedId = localStorage.getItem("user_id") || "guest"
      const savedRes = await fetch(`${apiUrl}/saved-photos/${storedId}`)
      if (savedRes.ok) {
        const savedData = await savedRes.json()
        setSavedPhotos(
          savedData.map((item: any) => ({
            id: item.photo.id,
            url: item.photo.storageUrl,
            eventName: item.photo.event?.name || "Unknown",
            eventDate: item.photo.event?.date || item.photo.createdAt,
            confidence: 0.95,
          })),
        )
      } else {
        setSavedPhotos([])
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()

    // Also recheck consent when page becomes visible (tab refocus)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("Dashboard refocused, rechecking consent...")
        fetchDashboardData()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [router])

  const handleUploadSelfie = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!hasConsentedToFaceSearch) {
      alert("You need to consent to face search to upload a reference photo. Please update your privacy settings.")
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const authToken = localStorage.getItem("auth_token")
      const response = await fetch("/api/me/reference-face", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || "Failed to analyze face. Please try a clearer selfie.")
      } else {
        await fetchDashboardData()
      }
    } catch (error) {
      alert("Network error. Please try again.")
      console.error(error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteSelfie = async () => {
    if (!confirm("Are you sure you want to delete your auto-search default face?")) return

    setIsDeletingReference(true)
    try {
      const authToken = localStorage.getItem("auth_token")
      const response = await fetch("/api/me/reference-face", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        alert(data?.error || "Failed to delete reference photo.")
        return
      }

      // Immediately reflect deactivated state in dashboard UI.
      setHasReferenceFace(false)
      setReferenceFaceUrl("")
      setAutoMatches([])

      await fetchDashboardData()
    } catch (e) {
      console.error(e)
      alert("Network error. Please try again.")
    } finally {
      setIsDeletingReference(false)
    }
  }

  const openFilePicker = () => {
    if (!hasConsentedToFaceSearch) {
      setShowConsentNotice(true)
      return
    }

    if (!fileInputRef.current) return
    // Allow selecting the same file again after a previous upload.
    fileInputRef.current.value = ""
    fileInputRef.current.click()
  }

  return (
    <>
      <Header userRole="student" />
      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUploadSelfie} />
      <AlertDialog open={showConsentNotice} onOpenChange={setShowConsentNotice}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Consent Required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>You must agree to both items before using AI face search:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="text-xs text-foreground">
                    <p className="font-semibold">Enable AI Face Search</p>
                    <p className="text-muted-foreground">Allow the system to identify your face in event photos and create a personal photo album.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="text-xs text-foreground">
                    <p className="font-semibold">Data Processing Agreement</p>
                    <p className="text-muted-foreground">I understand my biometric data will be processed and stored securely in compliance with GDPR and PDPA regulations.</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertDialogCancel>Dismiss</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/settings")}>Go to Settings</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <main className="min-h-screen relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(130,24,26,0.14),transparent_36%),radial-gradient(circle_at_top_right,rgba(130,24,26,0.10),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.96),rgba(248,250,252,1))]">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent pointer-events-none" />
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-[#82181a]/12 blur-3xl pointer-events-none" />
        <div className="absolute top-48 left-0 h-64 w-64 rounded-full bg-[#82181a]/10 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <section className="relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-card/80 shadow-[0_12px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(130,24,26,0.12),rgba(255,255,255,0)_42%,rgba(130,24,26,0.08))]" />
            <div className="relative space-y-6 p-4 sm:p-6 lg:p-7">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                    Student dashboard
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium">
                    {hasReferenceFace ? "Auto-match active" : "Reference face not set"}
                  </Badge>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="space-y-3 max-w-xl">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      Welcome back, <span className="bg-gradient-to-r from-[#82181a] to-[#a8252d] bg-clip-text text-transparent">{displayName}</span>
                    </h1>
                    <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                      Your photo archive is organized around you. Upload a reference selfie once, then let the dashboard surface matches and saved moments in one place.
                    </p>
                  </div>

                  <div className={`relative w-fit justify-self-start lg:justify-self-end lg:mr-30 transition-opacity duration-200 ${!hasConsentedToFaceSearch ? "opacity-50" : ""}`}>
                    <div className="relative h-28 w-28 sm:h-32 sm:w-32 lg:h-48 lg:w-48 rounded-full bg-gradient-to-br  ">
                      <div className="h-full w-full overflow-hidden rounded-full border border-white/70 bg-muted/30">
                        {hasReferenceFace && referenceFaceUrl ? (
                          <img src={referenceFaceUrl} alt="Reference selfie" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                            <Camera className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        onClick={openFilePicker}
                        variant="outline"
                        size="lg"
                        className={`h-12 rounded-full border-border/70 px-6 font-medium transition-opacity duration-200 sm:w-auto ${!hasConsentedToFaceSearch ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={isUploading || isDeletingReference}
                      >
                        <UploadCloud className="mr-2 h-4 w-4" />
                        {hasReferenceFace ? "Update reference selfie" : "Upload reference selfie"}
                      </Button>

                      {hasReferenceFace && (
                        <Button
                          onClick={handleDeleteSelfie}
                          variant="destructive"
                          size="sm"
                          className={`h-10 rounded-full transition-opacity duration-200 sm:w-auto ${!hasConsentedToFaceSearch ? "opacity-50 cursor-not-allowed" : ""}`}
                          disabled={isDeletingReference || isUploading || !hasConsentedToFaceSearch}
                        >
                          {isDeletingReference ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Delete Reference photo
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex lg:justify-end lg:mr-25">
                    <Button
                      onClick={() => router.push("/search")}
                      size="lg"
                      className="h-12 w-full rounded-full bg-gradient-to-r from-primary to-primary/80 px-6 font-medium text-primary-foreground transition-all duration-300 hover:from-primary/90 hover:to-primary/70 hover:opacity-90 sm:w-auto"
                    >
                      <Sparkles className="mr-2 h-4 w-4 " />
                      Manual Photo Search
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {stats.map((stat) => (
                    <StatCard key={stat.label} {...stat} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="mt-8 space-y-8">
            <section className="space-y-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Auto-matched feed</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">Photos found for you</h2>
                </div>
                {hasReferenceFace && <Badge variant="outline" className="rounded-full">{autoMatches.length} results</Badge>}
              </div>

              {isLoading ? (
                <Card className="border-dashed border-border/70 bg-card/70">
                  <CardContent className="p-10 text-center text-sm text-muted-foreground">
                    Loading your dashboard...
                  </CardContent>
                </Card>
              ) : hasReferenceFace ? (
                autoMatches.length > 0 ? (
                  <PhotoGrid photos={autoMatches} showRank={true} />
                ) : (
                  <Card className="border-dashed border-border/70 bg-card/70">
                    <CardContent className="p-10 text-center">
                      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-semibold">No matches yet</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        We will keep checking future events and surface new matches here automatically.
                      </p>
                    </CardContent>
                  </Card>
                )
              ) : (
                <Card className="border-dashed border-border/70 bg-card/70">
                  <CardContent className="p-10 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Camera className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold">Activate auto-match to see results</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Upload a reference selfie and we will start indexing your event photos automatically.
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
