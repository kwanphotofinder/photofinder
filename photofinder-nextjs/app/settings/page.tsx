"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertCircle, CheckCircle2, Download, Loader2, Lock, Mail, Shield, Trash2, User, BadgeCheck, Sparkles, MessageSquare } from "lucide-react"
import { PrivacyConsentForm, type ConsentData } from "@/components/privacy-consent-form"
import { apiClient } from "@/lib/api-client"

type AccountProfile = {
  name: string
  email: string
  avatarUrl: string
  role: string
}

export default function SettingsPage() {
  const router = useRouter()
  const initialRole =
    typeof window !== "undefined" ? (localStorage.getItem("user_role") || "student").toLowerCase() : "student"
  const [consent, setConsent] = useState<ConsentData>({
    globalFaceSearch: false,
    dataProcessing: false,
  })
  const [profile, setProfile] = useState<AccountProfile>({
    name: "",
    email: "",
    avatarUrl: "",
    role: initialRole,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isExportingData, setIsExportingData] = useState(false)
  const [isDeletingData, setIsDeletingData] = useState(false)
  const [deletionStatus, setDeletionStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle")
  const [deletionSummary, setDeletionSummary] = useState("")
  const [privacyActionError, setPrivacyActionError] = useState("")
  const [lineLinked, setLineLinked] = useState<boolean | null>(null)
  const [isUnlinkingLine, setIsUnlinkingLine] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState<boolean | null>(null)
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem("user_data")
    const storedName = localStorage.getItem("user_name") || localStorage.getItem("admin_name") || ""
    const storedEmail = localStorage.getItem("user_email") || ""
    const storedRole = (localStorage.getItem("user_role") || "student").toLowerCase()

    let avatarUrl = ""
    let parsedName = storedName
    let parsedEmail = storedEmail

    if (userData) {
      try {
        const parsed = JSON.parse(userData)
        parsedName = parsed.name || parsedName
        parsedEmail = parsed.email || parsedEmail
        avatarUrl = parsed.avatarUrl || parsed.picture || ""
      } catch (error) {
        console.error("Failed to parse user profile:", error)
      }
    }

    setProfile({
      name: parsedName || "User",
      email: parsedEmail || "",
      avatarUrl,
      role: storedRole,
    })
  }, [])

  useEffect(() => {
    const loadConsent = async () => {
      try {
        const authToken = localStorage.getItem("auth_token")
        if (!authToken) return

        // Fetch current consent status from server
        const consentRes = await fetch("/api/me/consent", {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        const consentData = await consentRes.json()

        if (consentRes.ok && typeof consentData.pdpaConsent === "boolean") {
          setConsent({
            globalFaceSearch: consentData.pdpaConsent,
            dataProcessing: consentData.pdpaConsent,
          })
        } else {
          // Fallback to localStorage
          const saved = localStorage.getItem("consent_preferences")
          if (saved) {
            const parsed = JSON.parse(saved)
            setConsent({
              globalFaceSearch: parsed.globalFaceSearch ?? false,
              dataProcessing: parsed.dataProcessing ?? false,
            })
          }
        }
      } catch (error) {
        console.error("Failed to load consent:", error)
        // Fallback to localStorage
        const saved = localStorage.getItem("consent_preferences")
        if (saved) {
          const parsed = JSON.parse(saved)
          setConsent({
            globalFaceSearch: parsed.globalFaceSearch ?? false,
            dataProcessing: parsed.dataProcessing ?? false,
          })
        }
      }
    }

    loadConsent()
  }, [])

  // Check LINE link status + handle success/error redirect params
  useEffect(() => {
    const authToken = localStorage.getItem("auth_token")
    if (!authToken) return

    fetch("/api/me/line", { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => res.json())
      .then((data) => setLineLinked(!!data.linked))
      .catch(() => setLineLinked(false))

    // Check if redirected back from LINE with success/error
    const params = new URLSearchParams(window.location.search)
    if (params.get("success") === "LINE_LINKED") {
      setLineLinked(true)
      window.history.replaceState({}, "", "/settings")
    } else if (params.get("error")?.startsWith("LINE")) {
      setLineLinked(false)
      window.history.replaceState({}, "", "/settings")
    }
  }, [])

  // Fetch email notification status
  useEffect(() => {
    const authToken = localStorage.getItem("auth_token")
    if (!authToken) return

    fetch("/api/me/email-notifications", { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => res.json())
      .then((data) => setEmailEnabled(!!data.enabled))
      .catch(() => setEmailEnabled(false))
  }, [])

  const handleUnlinkLine = async () => {
    const authToken = localStorage.getItem("auth_token")
    if (!authToken) return
    setIsUnlinkingLine(true)
    try {
      await fetch("/api/me/line", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      })
      setLineLinked(false)
    } catch {
      // silently fail
    } finally {
      setIsUnlinkingLine(false)
    }
  }

  const handleToggleEmail = async () => {
    const authToken = localStorage.getItem("auth_token")
    if (!authToken) return
    setIsUpdatingEmail(true)
    try {
      const res = await fetch("/api/me/email-notifications", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ enabled: !emailEnabled })
      })
      const data = await res.json()
      setEmailEnabled(!!data.enabled)
    } catch {
      // silently fail
    } finally {
      setIsUpdatingEmail(false)
    }
  }

  const handleConsentChange = (key: keyof ConsentData) => {
    setConsent((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSavePreferences = async () => {
    console.log("[v0] Starting save preferences")
    setIsSaving(true)
    setShowSuccess(false)

    try {
      const authToken = localStorage.getItem("auth_token")
      if (!authToken) {
        router.push("/login")
        return
      }

      // Call API to save consent status
      const consentAccepted = consent.globalFaceSearch && consent.dataProcessing
      const result = await apiClient.updateMyConsent(consentAccepted)

      if (result.error) {
        console.error("Failed to save consent:", result.error)
        setIsSaving(false)
        return
      }

      localStorage.setItem(
        "consent_preferences",
        JSON.stringify({
          ...consent,
          accepted: consentAccepted,
          timestamp: new Date().toISOString(),
        }),
      )

      setIsSaving(false)
      console.log("[v0] Setting showSuccess to true")
      setShowSuccess(true)
      setTimeout(() => {
        console.log("[v0] Hiding success banner")
        setShowSuccess(false)
      }, 3000)
    } catch (error) {
      console.error("Error saving preferences:", error)
      setIsSaving(false)
    }
  }

  useEffect(() => {
    console.log("[v0] showSuccess state changed:", showSuccess)
  }, [showSuccess])

  const handleExportData = async () => {
    setIsExportingData(true)
    setPrivacyActionError("")

    try {
      const result = await apiClient.exportMyPrivacyData()
      if (result.error || !result.data?.data) {
        setPrivacyActionError(result.error || "Failed to export privacy data")
        return
      }

      const fileContent = JSON.stringify(result.data.data, null, 2)
      const blob = new Blob([fileContent], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const stamp = new Date().toISOString().slice(0, 10)
      link.href = url
      link.download = `photofinder-privacy-export-${stamp}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to export privacy data:", error)
      setPrivacyActionError("Failed to export privacy data")
    } finally {
      setIsExportingData(false)
    }
  }

  const handleFullDeleteData = async () => {
    const shouldProceed = confirm(
      "This will permanently delete your reference face, saved photos list, consent profile data, and related privacy records. Continue?",
    )
    if (!shouldProceed) return

    setIsDeletingData(true)
    setDeletionStatus("processing")
    setDeletionSummary("")
    setPrivacyActionError("")

    try {
      const result = await apiClient.fullDeleteMyPrivacyData()

      if (result.error || !result.data) {
        setDeletionStatus("failed")
        setPrivacyActionError(result.error || "Failed to complete full delete")
        return
      }

      const details = result.data.details
      setDeletionStatus("completed")
      setDeletionSummary(
        `Deleted: ${details?.referenceFacesDeleted ?? 0} reference face, ${details?.savedPhotosDeleted ?? 0} saved photos, ${details?.removalRequestsDeleted ?? 0} removal requests, ${details?.abuseReportsDeleted ?? 0} reports, ${details?.deliveriesDeleted ?? 0} deliveries.`,
      )

      setConsent({ globalFaceSearch: false, dataProcessing: false })
      localStorage.setItem(
        "consent_preferences",
        JSON.stringify({
          globalFaceSearch: false,
          dataProcessing: false,
          accepted: false,
          timestamp: new Date().toISOString(),
        }),
      )
    } catch (error) {
      console.error("Failed to complete full delete:", error)
      setDeletionStatus("failed")
      setPrivacyActionError("Failed to complete full delete")
    } finally {
      setIsDeletingData(false)
    }
  }

  const prettyRole = profile.role.replace("_", " ")
  const isConsentWithdrawn = !consent.globalFaceSearch || !consent.dataProcessing
  const isPhotographer = profile.role === "photographer"
  const headerRole: "student" | "photographer" | "admin" =
    profile.role === "photographer" ? "photographer" : profile.role === "admin" ? "admin" : "student"
  const settingsSummary = isPhotographer
    ? "View account profile in one place."
    : "View account profile and manage privacy preferences in one place."

  return (
    <>
      <Header showLogout userRole={headerRole} />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(130,24,26,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(130,24,26,0.08),_transparent_32%),linear-gradient(to_bottom,_#fff,_#faf7f7_58%,_#f8f4f4)]">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:py-10">
          <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_22px_70px_rgba(130,24,26,0.12)] backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(130,24,26,0.12),_transparent_35%),linear-gradient(135deg,_rgba(255,255,255,0.85),_transparent_46%)]" />
            <div className="relative space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Account & settings
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Account & Settings</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {settingsSummary}
              </p>
            </div>
          </section>

          <Tabs defaultValue={isPhotographer ? "account" : "privacy"} className="mt-8 space-y-6 sm:mt-10">
            <TabsList className={`grid h-auto w-full rounded-2xl border border-white/60 bg-white/80 p-1.5 shadow-lg shadow-slate-100/60 backdrop-blur-xl ${isPhotographer ? "grid-cols-1" : "grid-cols-2"}`}>
              <TabsTrigger value="account" className="rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-slate-50">
                Account Profile
              </TabsTrigger>
              {!isPhotographer && (
                <TabsTrigger value="privacy" className="rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-slate-50">
                  Privacy & Consent
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="account" className="space-y-4">
              <Card className="overflow-hidden border border-white/60 bg-gradient-to-br from-white/95 to-white/80 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
                <CardHeader className="border-b border-white/50 bg-gradient-to-r from-slate-50/80 to-white/80">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <CardTitle>Account Profile</CardTitle>
                      <CardDescription>View the account details currently used in the system</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-white/60 p-6 shadow-sm">
                    <div className="flex flex-col items-center gap-4 sm:gap-6">
                      <Avatar className="h-24 w-24 ring-4 ring-white shadow-lg shadow-slate-200/60">
                        <AvatarImage src={profile.avatarUrl} alt={profile.name || "User"} referrerPolicy="no-referrer" />
                        <AvatarFallback className="bg-slate-100 text-2xl font-semibold text-slate-700">
                          {(profile.name?.[0] || profile.email?.[0] || "U").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="w-full space-y-4 text-center sm:text-left">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Full Name</p>
                          <p className="mt-1.5 text-lg font-semibold text-foreground">
                            {profile.name || "User"}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 sm:text-left">
                          <div className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-center gap-2 sm:justify-start text-xs uppercase tracking-wide text-muted-foreground font-medium">
                              <Mail className="h-4 w-4" />
                              Email Address
                            </div>
                            <p className="text-sm font-medium text-foreground break-all">
                              {profile.email || "Not available"}
                            </p>
                          </div>

                          <div className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-center gap-2 sm:justify-start text-xs uppercase tracking-wide text-muted-foreground font-medium">
                              <BadgeCheck className="h-4 w-4" />
                              Account Role
                            </div>
                            <p className="text-sm font-medium text-foreground capitalize">
                              {prettyRole}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-muted-foreground">
                    <p className="leading-relaxed">
                      This profile information is synced from your Google account. To update your name or photo, modify your Google account settings and sign out and back in to refresh it here.
                    </p>
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-white/60 p-6 shadow-sm">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00B900]/10 text-[#00B900]">
                            <MessageSquare className="h-5 w-5 fill-current" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">LINE Notifications</h3>
                            <p className="text-sm text-slate-500">Receive real-time Flex Messages via LINE OA when we find new photos of you.</p>
                          </div>
                        </div>
                        {/* Status badge */}
                        {lineLinked === null ? (
                          <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" />
                        ) : lineLinked ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Not linked
                          </span>
                        )}
                      </div>

                      <div className="rounded-xl border border-[#00B900]/20 bg-[#00B900]/5 p-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">Before linking, please add our LINE OA as a friend first.</p>
                        <p className="mt-1 leading-relaxed">
                          Add via link:
                          <a
                            href="https://lin.ee/6oiEili"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 font-semibold text-[#00B900] underline underline-offset-2 hover:text-[#009b00]"
                          >
                            https://lin.ee/6oiEili
                          </a>
                          <span className="mx-1">or search ID:</span>
                          <span className="font-semibold text-slate-900">@042nimvi</span>
                        </p>
                        <p className="mt-2 text-xs text-slate-600">
                          If you do not add the OA first, LINE account linking and notifications will not work.
                        </p>
                      </div>

                      {/* Action button */}
                      {lineLinked === null ? (
                        <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-200" />
                      ) : lineLinked ? (
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm text-slate-600">Your LINE account is linked. You will receive notifications automatically.</span>
                          <Button
                            onClick={handleUnlinkLine}
                            disabled={isUnlinkingLine}
                            className="ml-auto border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs px-3 py-1 h-auto"
                          >
                            {isUnlinkingLine ? <Loader2 className="h-3 w-3 animate-spin" /> : "Unlink"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            const token = localStorage.getItem("auth_token") || "";
                            if (!token) return alert('Please login again first');
                            window.location.href = `/api/auth/line/login?token=${token}`;
                          }}
                          className="max-w-[200px] bg-[#00B900] text-white shadow-md hover:bg-[#009b00]"
                        >
                          Link LINE Account
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Email Notifications Card */}
                  <div className="mt-6 rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-white/60 p-6 shadow-sm">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                            <Mail className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">Email Notifications</h3>
                            <p className="text-sm text-slate-500">Receive a summary email when we find photos of you at an event.</p>
                          </div>
                        </div>
                        {/* Status badge */}
                        {emailEnabled === null ? (
                          <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" />
                        ) : emailEnabled ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Disabled
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleToggleEmail}
                          disabled={isUpdatingEmail || emailEnabled === null}
                          className={`w-full sm:w-auto shadow-md ${emailEnabled
                              ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                        >
                          {isUpdatingEmail ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : emailEnabled ? (
                            "Disable Email Notifications"
                          ) : (
                            "Enable Email Notifications"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {!isPhotographer && (
              <TabsContent value="privacy" className="space-y-4">
                <Card className="overflow-hidden border border-slate-200/60 bg-white/70 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
                  <CardHeader className="border-b border-white/50 bg-gradient-to-r from-slate-50/80 to-white/80 pb-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Shield className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <CardTitle>Consent Status</CardTitle>
                          <CardDescription>Control your participation in the photo system</CardDescription>
                        </div>
                      </div>
                      <div
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-all duration-300 ${consent.globalFaceSearch
                            ? "bg-emerald-500 text-white shadow-emerald-200"
                            : "bg-slate-200 text-slate-600 shadow-slate-100"
                          }`}
                      >
                        <div className={`h-2 w-2 rounded-full ${consent.globalFaceSearch ? "bg-white animate-pulse" : "bg-slate-400"}`} />
                        {consent.globalFaceSearch ? "Opted In" : "Opted Out"}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className={`rounded-2xl border p-5 transition-all duration-500 ${consent.globalFaceSearch
                        ? "border-emerald-100 bg-emerald-50/30 text-emerald-900"
                        : "border-slate-100 bg-slate-50/50 text-slate-600"
                      }`}>
                      <div className="flex gap-4">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${consent.globalFaceSearch ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"
                          }`}>
                          {consent.globalFaceSearch ? <CheckCircle2 className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                        </div>
                        <p className="text-sm leading-relaxed">
                          {consent.globalFaceSearch
                            ? "Active: Your face is being identified in new event photos. You will be notified automatically when a match is found."
                            : "Passive: Your face is not being searched. No notifications will be sent and you will remain invisible to AI detection."}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border border-white/60 bg-white/50 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
                  <CardHeader className="border-b border-white/50 bg-gradient-to-r from-slate-50/80 to-white/80">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                        <Lock className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle>Update Preferences</CardTitle>
                        <CardDescription>Manage your privacy configuration</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6">
                    <PrivacyConsentForm
                      consent={consent}
                      onChange={handleConsentChange}
                      disabled={isSaving}
                    />

                    {isConsentWithdrawn && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-amber-900">You are about to withdraw consent</p>
                            <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
                              <li>AI face matching and new match notifications will stop.</li>
                              <li>Your profile may no longer appear in automatic event discovery.</li>
                              <li>After re-consenting, auto face matching can resume once you set a reference selfie again.</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}


                    {/* Privacy Rights Info */}
                    <div className="space-y-3 rounded-xl border border-border/30 bg-muted/50 p-4">
                      <div className="flex gap-3">
                        <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="space-y-2 text-muted-foreground">
                          <p className="text-xs uppercase tracking-widest font-medium text-foreground">Your Privacy Rights</p>
                          <ul className="space-y-1 list-disc list-inside">
                            <li>You can opt-out of face search at any time</li>
                            <li>Request removal or blur of photos featuring you</li>
                            <li>Download or delete your personal data</li>
                            <li>Learn more in our privacy policy</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleSavePreferences}
                      disabled={isSaving}
                      className="w-full rounded-full bg-primary py-6 text-primary-foreground shadow-xl shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-2xl hover:shadow-primary/30"
                      size="lg"
                    >
                      {isSaving ? "Saving..." : "Save Privacy Preferences"}
                    </Button>

                    <div className="space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <p className="text-xs font-medium uppercase tracking-widest text-slate-600">Consent Intelligence Actions</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                          type="button"
                          onClick={handleExportData}
                          disabled={isExportingData || isDeletingData}
                          className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        >
                          {isExportingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                          One-click Export Data
                        </Button>
                        <Button
                          type="button"
                          onClick={handleFullDeleteData}
                          disabled={isDeletingData || isExportingData}
                          className="w-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                        >
                          {isDeletingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                          One-click Full Delete
                        </Button>
                      </div>

                      {deletionStatus !== "idle" && (
                        <div className={`rounded-lg border p-3 text-sm ${deletionStatus === "completed"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : deletionStatus === "processing"
                              ? "border-blue-200 bg-blue-50 text-blue-800"
                              : "border-red-200 bg-red-50 text-red-800"
                          }`}>
                          <p className="font-semibold">
                            Deletion status: {deletionStatus === "processing" ? "Processing" : deletionStatus === "completed" ? "Completed" : "Failed"}
                          </p>
                          {deletionSummary && <p className="mt-1">{deletionSummary}</p>}
                        </div>
                      )}

                      {privacyActionError && (
                        <p className="text-sm font-medium text-red-600">{privacyActionError}</p>
                      )}
                    </div>

                    {showSuccess && (
                      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-lg shadow-emerald-100/40 animate-in slide-in-from-top duration-300">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                        <p className="text-sm font-semibold text-emerald-800 sm:text-base">
                          Preferences saved successfully!
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

          </Tabs>

        </div>
      </main>
    </>
  )
}
