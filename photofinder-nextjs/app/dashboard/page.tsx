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
import { AlertCircle, ArrowUpRight, Camera, CheckCircle2, ImageIcon, Loader2, Search, ShieldCheck, Sparkles, Trash2, UploadCloud, User } from "lucide-react"
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

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
      const storedId = localStorage.getItem("user_id") || "guest"
      const savedRes = await fetch(`${apiUrl}/saved-photos/${storedId}`)
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
    if (!confirm("Are you sure you want to remove your profile selfie?")) return

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
      <main className="min-h-screen bg-[#faf9f7] text-slate-950">
        <div className="border-b border-[#e2ddd6] bg-[#f5f3ef]">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
            <div className="grid overflow-hidden border border-[#d8d2ca] bg-white shadow-sm lg:grid-cols-[1.25fr_.75fr]">
              <div className="relative flex min-h-70 flex-col justify-between overflow-hidden bg-[#fbf8f5] p-6 sm:p-9 lg:p-10">
                <div className="relative z-10 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#82181a]">
                  <Sparkles className="h-4 w-4" /> {t("student.space")}
                </div>
                <div className="relative z-10 mt-12">
                  <p className="mb-2 text-sm font-medium text-slate-500">{t("student.welcome")}</p>
                  <h1 className="max-w-xl text-3xl font-black tracking-[-0.03em] text-[#421012] sm:text-4xl lg:text-5xl">{displayName}</h1>
                  <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
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
                    className="h-11 rounded-none bg-[#82181a] px-5 text-sm font-bold text-white hover:bg-[#641416]"
                    disabled={isDeletingReference}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {hasReferenceFace ? t("student.update_profile") : t("student.set_selfie")}
                  </Button>
                  <Button onClick={() => router.push("/search")} variant="outline" size="lg" className="h-11 rounded-none border-[#cfc8bf] bg-white px-5 text-sm font-bold text-[#82181a] hover:bg-[#f5f3ef]">
                    <Search className="mr-2 h-4 w-4" /> {t("student.browse_photos")}
                  </Button>
                </div>
              </div>
              <div className="relative min-h-70 border-l-4 border-l-[#f4c66a] bg-[#721719] p-6 text-white sm:p-9 lg:p-10">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-[#f4c66a]">
                  <span>{t("student.profile_signal")}</span>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="mt-7 flex items-center gap-5">
                  <div className={`h-28 w-28 shrink-0 overflow-hidden border-4 border-white bg-[#ded4c5] shadow-lg sm:h-36 sm:w-36 ${!hasConsentedToFaceSearch ? "grayscale opacity-50" : ""}`}>
                    {hasReferenceFace && referenceFaceUrl ? (
                      <img src={referenceFaceUrl} alt="Reference face" className="h-full w-full object-cover" />
                    ) : (
                      <img src="/Camera Icon.gif" alt="No selfie" className="h-full w-full object-contain p-3 opacity-50" />
                    )}
                  </div>
                  <div>
                    <p className="text-xl font-black tracking-tight text-white">{hasReferenceFace ? t("student.ready") : t("student.not_set_up")}</p>
                    <p className="mt-2 max-w-42.5 text-sm leading-5 text-white/70">{hasReferenceFace ? t("student.ready_description") : t("student.not_set_up_description")}</p>
                  </div>
                </div>
                {hasReferenceFace && (
                  <Button onClick={handleDeleteSelfie} variant="ghost" size="sm" className="mt-6 h-9 rounded-none px-0 font-bold text-[#f4c66a] hover:bg-transparent hover:text-white" disabled={isDeletingReference || isUploading || !hasConsentedToFaceSearch}>
                    {isDeletingReference ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Remove profile
                  </Button>
                )}
              </div>
            </div>
            <div className="grid border-x border-b border-[#d8d2ca] bg-white sm:grid-cols-3">
              {stats.map((stat, index) => (
                <div key={stat.label} className={`flex items-center justify-between px-5 py-5 sm:px-7 ${index > 0 ? "border-t border-[#d8d2ca] sm:border-l sm:border-t-0" : ""}`}>
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{stat.label}</p><p className="mt-1 text-2xl font-black tracking-tight text-[#421012]">{stat.value}</p></div>
                  <stat.icon className="h-5 w-5 text-[#82181a]" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <section>
            <div className="mb-7 flex items-end justify-between gap-4 border-b border-[#d8d2ca] pb-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#82181a]">{t("student.collection")}</p><h2 className="mt-2 text-2xl font-black tracking-[-0.02em] sm:text-3xl">{t("student.recently_matched")}</h2></div>
              <Button onClick={() => router.push("/search")} variant="ghost" className="hidden rounded-none px-0 font-bold text-[#82181a] hover:bg-transparent sm:flex">{t("student.view_all")} <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
            </div>
            {isLoading ? (
              <div className="border border-dashed border-[#cfc8bf] bg-white p-12 text-center text-sm text-slate-500">Loading your dashboard...</div>
            ) : hasReferenceFace && autoMatches.length > 0 ? (
              <PhotoGrid photos={autoMatches} showRank={true} compact={true} showShare={false} />
            ) : (
              <div className="relative flex min-h-36 items-center justify-center overflow-hidden py-10">
                <ImageIcon className="absolute h-28 w-28 text-[#82181a] opacity-[0.035]" />
                <p className="select-none text-center text-3xl font-black uppercase tracking-[0.12em] text-[#82181a] opacity-[0.08] sm:text-4xl">{t("student.no_matches")}</p>
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
