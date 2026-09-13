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
import { AlertCircle, ArrowUpRight, Camera, CheckCircle2, ImageIcon, Loader2, ShieldCheck, Sparkles, Trash2, UploadCloud, User, ChevronRight } from "lucide-react"
import { UploadLoader } from "@/components/upload-loader"
import { useLanguage } from "@/lib/language-context"

interface Photo {
  id: string
  url: string
  eventName: string
  eventDate: string
  uploadDate?: string
  confidence: number
  x?: number
  y?: number
  w?: number
  h?: number
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <Card className="group relative overflow-hidden rounded border border-slate-200 bg-white shadow-none transition-colors hover:border-primary/30">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
            </div>
          </div>
          <div className="shrink-0 rounded bg-primary/10 p-2.5 text-primary ring-1 ring-inset ring-primary/10">
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userName, setUserName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [hasReferenceFace, setHasReferenceFace] = useState(false)
  const [referenceFaceUrl, setReferenceFaceUrl] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [isDeletingReference, setIsDeletingReference] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [autoMatches, setAutoMatches] = useState<Photo[]>([])
  const [savedPhotoCount, setSavedPhotoCount] = useState(0)
  const [hasConsentedToFaceSearch, setHasConsentedToFaceSearch] = useState(true)
  const [showConsentNotice, setShowConsentNotice] = useState(false)

  const displayName = userName || "Student"

  const stats = useMemo(
    () => [
      {
        label: t("student.auto_matches"),
        value: autoMatches.length,
        icon: Sparkles,
      },
      {
        label: t("student.profile_status"),
        value: hasReferenceFace ? t("student.active") : t("student.inactive"),
        icon: User,
      },
      {
        label: t("student.saved_moments"),
        value: savedPhotoCount,
        icon: CheckCircle2,
      },
    ],
    [autoMatches.length, hasReferenceFace, savedPhotoCount, t],
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

      const storedId = localStorage.getItem("user_id") || "guest"
      const savedRes = await fetch(`/api/saved-photos/${storedId}`)
      if (savedRes.ok) {
        const savedData = await savedRes.json()
        setSavedPhotoCount(savedData.length)
      } else {
        setSavedPhotoCount(0)
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
    if (!confirm(t("student.remove_profile_confirm"))) return

    setIsDeletingReference(true)
    try {
      const authToken = localStorage.getItem("auth_token")
      const response = await fetch("/api/me/reference-face", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        alert(data?.error || t("student.remove_profile_error"))
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
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Consent required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>Enable these before using face search:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                  <div className="text-xs text-foreground space-y-0.5">
                    <p className="font-semibold">AI face search</p>
                    <p className="text-muted-foreground">Find your face in event photos.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                  <div className="text-xs text-foreground space-y-0.5">
                    <p className="font-semibold">Data processing</p>
                    <p className="text-muted-foreground">Your biometric data is processed securely.</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0">
            <AlertDialogCancel>Dismiss</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/settings")}>Go to Settings</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="grid overflow-hidden rounded border border-slate-200 bg-white shadow-none lg:grid-cols-[1.3fr_.7fr]">
              <div className="relative flex flex-col justify-between overflow-hidden bg-white p-6 sm:p-8 lg:p-10">
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 rounded bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/15">
                    <Sparkles className="h-3.5 w-3.5" /> {t("student.space")}
                  </div>
                </div>
                <div className="relative z-10 mt-10 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("student.welcome")}</p>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">{displayName}</h1>
                  </div>
                  <p className="max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {t("student.description")}
                  </p>
                </div>
                <div className="relative z-10 mt-8 flex flex-wrap gap-3">
                  <Button
                    onClick={() => {
                      if (!hasConsentedToFaceSearch) {
                        setShowConsentNotice(true)
                        return
                      }
                      setShowVerification(true)
                    }}
                    size="lg"
                    className="h-11 px-6 text-sm font-semibold shadow-sm hover:shadow-md transition-shadow"
                    disabled={isDeletingReference}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {hasReferenceFace ? t("student.update_profile") : t("student.set_selfie")}
                  </Button>
                </div>
              </div>
              <div className="relative min-h-[320px] flex flex-col justify-between border-t border-slate-200 bg-slate-50 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">{t("student.profile_signal")}</span>
                  <div className="rounded bg-primary/10 p-2 text-primary ring-1 ring-inset ring-primary/10">
                    <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-5 my-8">
                  <div className={`relative h-32 w-32 shrink-0 overflow-hidden rounded border-4 border-white bg-slate-100 shadow-sm sm:h-36 sm:w-36 ${!hasConsentedToFaceSearch ? "grayscale opacity-50" : ""}`}>
                    {hasReferenceFace && referenceFaceUrl ? (
                      <img src={referenceFaceUrl} alt="Reference face" className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-100">
                        <img src="/Camera Icon.gif" alt="No selfie" className="h-16 w-16 object-contain opacity-60" />
                      </div>
                    )}
                    {hasReferenceFace && (
                        <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-green-500 p-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="text-center space-y-1.5">
                    <p className="text-lg font-bold tracking-tight text-foreground">
                      {hasReferenceFace ? t("student.ready") : t("student.not_set_up")}
                    </p>
                    <p className="text-sm leading-5 text-muted-foreground max-w-[240px]">
                      {hasReferenceFace ? t("student.ready_description") : t("student.not_set_up_description")}
                    </p>
                  </div>
                </div>
                {hasReferenceFace && (
                  <Button
                    onClick={handleDeleteSelfie}
                    variant="outline"
                    size="sm"
                    className="h-9 w-full rounded border-destructive/20 text-sm font-medium text-destructive hover:bg-destructive/5 hover:text-destructive"
                    disabled={isDeletingReference || isUploading || !hasConsentedToFaceSearch}
                  >
                    {isDeletingReference ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    {t("student.remove_profile")}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} />
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8 lg:py-11">
          <section>
            <div className="mb-6 flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{t("student.collection")}</p>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("student.recently_matched")}</h2>
              </div>
              <Button
                onClick={() => router.push("/search")}
                variant="ghost"
                size="sm"
                className="hidden text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-transparent sm:inline-flex items-center gap-1.5 p-0 h-auto"
              >
                {t("student.view_all")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-white p-14 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm font-medium text-foreground">Loading your dashboard...</p>
                <p className="text-xs text-muted-foreground mt-1">Fetching your matched photos</p>
              </div>
            ) : hasReferenceFace && autoMatches.length > 0 ? (
              <PhotoGrid photos={autoMatches} showRank={true} compact={true} showShare={false} />
            ) : (
              <div className="relative flex flex-col items-center justify-center rounded border border-slate-200 bg-white overflow-hidden p-14">
                <div className="relative z-10 flex flex-col items-center text-center space-y-4 max-w-md">
                  <div className="rounded-2xl bg-primary/10 p-4 ring-1 ring-inset ring-primary/10">
                    <ImageIcon className="h-10 w-10 text-primary" strokeWidth={1.8} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                      {hasReferenceFace ? t("student.no_matches") : "Upload your selfie to get started"}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {hasReferenceFace
                        ? "No photos matched your profile yet. Check back after your next campus event!"
                        : "Set up your facial profile and we'll automatically find your photos from events."}
                    </p>
                  </div>
                  {!hasReferenceFace && (
                    <Button
                      onClick={() => {
                        if (!hasConsentedToFaceSearch) {
                          setShowConsentNotice(true)
                          return
                        }
                        setShowVerification(true)
                      }}
                      size="lg"
                      className="mt-2 h-11 px-6 text-sm font-semibold shadow-sm hover:shadow-md transition-shadow"
                      disabled={isDeletingReference}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {t("student.set_selfie")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      {/* Branded Loading Overlay */}
      <UploadLoader 
        isVisible={isUploading} 
        message={hasReferenceFace ? "Updating your profile..." : "Mapping your face..."} 
      />
      {/* Identity Verification Modal */}
      {showVerification && (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
