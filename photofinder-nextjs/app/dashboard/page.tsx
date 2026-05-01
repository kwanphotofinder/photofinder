"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { convertHeicToJpeg } from "@/lib/heic-converter"
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
import { IdentityVerification } from "@/components/identity-verification"
import { AlertCircle, Camera, CheckCircle2, Loader2, Sparkles, Trash2, UploadCloud, User } from "lucide-react"
import { UploadLoader } from "@/components/upload-loader"

interface Photo {
  id: string
  url: string
  eventName: string
  eventDate: string
  uploadDate?: string
  confidence: number
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <Card className="group relative overflow-hidden border-none bg-white/40 shadow-sm transition-all duration-300 hover:bg-white/60 hover:shadow-md hover:-translate-y-1">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 transition-transform duration-500 group-hover:scale-150" />
      <CardContent className="relative p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">{label}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{value}</span>
            </div>
          </div>
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary shadow-inner">
            <Icon className="h-5 w-5" />
          </div>
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
  const [showVerification, setShowVerification] = useState(false)
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
        icon: Sparkles,
      },
      {
        label: "Saved moments",
        value: savedPhotos.length,
        icon: CheckCircle2,
      },
      {
        label: "Profile status",
        value: hasReferenceFace ? "Active" : "Inactive",
        icon: User,
      },
    ],
    [autoMatches.length, hasReferenceFace, savedPhotos.length],
  )

  const fetchDashboardData = async () => {
    const authToken = localStorage.getItem("auth_token")
    const userRole = localStorage.getItem("user_role")

    if (!authToken) {
      router.push("/login")
      return
    }

    if (userRole === "photographer") {
      router.push("/photographer")
      return
    } else if (userRole === "admin" || userRole === "super_admin") {
      router.push("/admin/dashboard")
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
              uploadDate: item.photo.createdAt,
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
    
    try {
      // Convert HEIC to JPEG if needed
      const processedFile = await convertHeicToJpeg(file)
      
      const formData = new FormData()
      formData.append("file", processedFile)

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
      <AlertDialog open={showConsentNotice} onOpenChange={setShowConsentNotice}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Consent required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>Enable these before using face search:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="text-xs text-foreground">
                    <p className="font-semibold">AI face search</p>
                    <p className="text-muted-foreground">Find your face in event photos.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="text-xs text-foreground">
                    <p className="font-semibold">Data processing</p>
                    <p className="text-muted-foreground">Your biometric data is processed securely.</p>
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

        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <section className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/60 p-6 shadow-2xl shadow-primary/5 backdrop-blur-2xl transition-all duration-500 sm:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(130,24,26,0.08),transparent_40%),linear-gradient(to_bottom_right,rgba(255,255,255,0.4),rgba(255,255,255,0))]" />
            <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 space-y-6">
                <div className="space-y-4">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                    <span className="block text-foreground">Welcome back,</span>
                    <span className="bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent drop-shadow-sm select-none">
                      {displayName}
                    </span>
                  </h1>
                    <p className="text-sm text-muted-foreground sm:text-base">
                      Upload a clear selfie once, then we will keep matching new event photos for you automatically.
                    </p>
                </div>

                <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center">
                  <Button
                    onClick={() => {
                      if (!hasConsentedToFaceSearch) {
                        setShowConsentNotice(true)
                        return
                      }
                      setShowVerification(true)
                    }}
                    variant="outline"
                    size="lg"
                    className={`h-12 rounded-2xl border-2 px-7 text-sm font-bold backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-primary sm:h-14 sm:text-base sm:w-auto ${!hasConsentedToFaceSearch ? "opacity-50" : "hover:scale-[1.02] active:scale-95"}`}
                    disabled={isDeletingReference}
                  >
                    <Camera className="mr-2.5 h-5 w-5" />
                    {hasReferenceFace ? "Update Profile" : "Verify & Set Selfie"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-6 lg:w-72">
                <div className={`group relative transition-all duration-500 ${!hasConsentedToFaceSearch ? "opacity-40 grayscale" : "hover:scale-105"}`}>
                  <div className={`absolute -inset-4 rounded-full blur-2xl transition-all duration-500 group-hover:blur-3xl ${hasReferenceFace ? "bg-primary/20" : "bg-slate-200/50"}`} />
                  <div className={`relative flex h-48 w-48 items-center justify-center rounded-3xl p-1 shadow-2xl transition-all duration-500 sm:h-56 sm:w-56 ${hasReferenceFace ? "bg-gradient-to-br from-primary via-primary/30 to-white" : "bg-white"}`}>
                    <div className="h-full w-full overflow-hidden rounded-[calc(1.5rem-2px)] bg-slate-100 shadow-inner">
                      {hasReferenceFace && referenceFaceUrl ? (
                        <img src={referenceFaceUrl} alt="Reference face" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50/50 text-slate-400">
                          <img 
                            src="/Camera Icon.gif" 
                            alt="No selfie" 
                            className="h-44 w-44 object-contain opacity-40 transition-opacity duration-300 group-hover:opacity-60" 
                          />
                          <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400/80 relative -top-3">No Image Set</span>
                        </div>
                      )}
                    </div>
                    {hasReferenceFace && (
                      <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-1 shadow-xl">
                        <div className="flex h-full w-full items-center justify-center rounded-xl bg-emerald-500 text-white">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {hasReferenceFace && (
                  <Button
                    onClick={handleDeleteSelfie}
                    variant="ghost"
                    size="sm"
                    className="h-10 rounded-xl font-bold text-destructive/60 transition-colors hover:bg-destructive/5 hover:text-destructive active:bg-destructive/10"
                    disabled={isDeletingReference || isUploading || !hasConsentedToFaceSearch}
                  >
                    {isDeletingReference ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Reset Profile
                  </Button>
                )}
              </div>
            </div>

              <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {stats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>
          </section>

          <div className="mt-12 space-y-12">
            <section className="space-y-8">
              <div className="flex items-center justify-between border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Recently Matched</h2>
                </div>
              </div>

              {isLoading ? (
                <Card className="border-dashed border-border/70 bg-card/70">
                    <CardContent className="p-10 text-center text-sm text-muted-foreground">
                    Loading your dashboard...
                  </CardContent>
                </Card>
              ) : hasReferenceFace ? (
                autoMatches.length > 0 ? (
                  <PhotoGrid photos={autoMatches} showRank={true} compact={true} showShare={false} />
                ) : (
                  <Card className="border-dashed border-border/70 bg-card/70">
                    <CardContent className="p-10 text-center">
                      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-semibold sm:text-lg">No matches yet</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        We’ll keep checking new events.
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
                    <h3 className="text-base font-semibold sm:text-lg">Upload a selfie to start</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      We’ll match you to event photos automatically.
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        </div>
      </main>
      {/* Branded Loading Overlay */}
      <UploadLoader 
        isVisible={isUploading} 
        message={hasReferenceFace ? "Updating your profile..." : "Mapping your face..."} 
      />
      {/* Identity Verification Modal */}
      {showVerification && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg">
            <IdentityVerification
              onSuccess={async () => {
                setShowVerification(false)
                await fetchDashboardData()
              }}
              onCancel={() => setShowVerification(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
