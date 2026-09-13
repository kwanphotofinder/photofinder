"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Shield,
  Trash2,
  User,
} from "lucide-react"
import { FaLine } from "react-icons/fa"
import { SiGmail } from "react-icons/si"
import { apiClient } from "@/lib/api-client"
import { useLanguage } from "@/lib/language-context"
import { ConfirmationModal } from "@/components/confirmation-modal"

type AccountProfile = {
  name: string
  email: string
  avatarUrl: string
  role: string
}

export default function SettingsPage() {
  const router = useRouter()
  const { t } = useLanguage()

  const [profile, setProfile] = useState<AccountProfile>({
    name: "",
    email: "",
    avatarUrl: "",
    role: "student",
  })
  const [consent, setConsent] = useState({
    globalFaceSearch: true,
    dataProcessing: true,
  })

  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [saveError, setSaveError] = useState("")
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
    const userRole = (localStorage.getItem("user_role") || "student").toLowerCase()
    const authToken = localStorage.getItem("auth_token")

    if (!authToken && typeof window !== "undefined") {
      router.push("/login")
      return
    }

    if (userRole === "admin" || userRole === "super_admin") {
      router.replace("/admin/profile")
      return
    }
    if (userRole === "photographer") {
      router.replace("/photographer/profile")
      return
    }

    const userData = localStorage.getItem("user_data")
    const storedName = localStorage.getItem("user_name") || ""
    const storedEmail = localStorage.getItem("user_email") || ""

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
      name: parsedName || "Student",
      email: parsedEmail || "",
      avatarUrl,
      role: "student",
    })
  }, [router])

  // Load consent and notifications
  useEffect(() => {
    const authToken = localStorage.getItem("auth_token")
    if (!authToken) return

    // 1. Consent
    let localGlobalFaceSearch = true
    let localDataProcessing = true
    const storedConsent = localStorage.getItem("consent_preferences")
    if (storedConsent) {
      try {
        const parsed = JSON.parse(storedConsent)
        if (typeof parsed.globalFaceSearch === "boolean") localGlobalFaceSearch = parsed.globalFaceSearch
        if (typeof parsed.dataProcessing === "boolean") localDataProcessing = parsed.dataProcessing
      } catch (e) {
        console.error("Failed to parse stored consent preferences:", e)
      }
    }

    fetch("/api/me/consent", { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.pdpaConsent === "boolean") {
          setConsent({
            globalFaceSearch: localGlobalFaceSearch,
            dataProcessing: storedConsent ? localDataProcessing : data.pdpaConsent,
          })
        }
      })
      .catch((err) => console.error("Failed to load consent:", err))

    // 2. LINE status
    fetch("/api/me/line", { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => res.json())
      .then((data) => setLineLinked(!!data.linked))
      .catch(() => setLineLinked(false))

    // 3. Email notifications status
    fetch("/api/me/email-notifications", { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => res.json())
      .then((data) => setEmailEnabled(!!data.enabled))
      .catch(() => setEmailEnabled(false))
  }, [])

  // Check URL params for LINE redirect feedback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("success") === "LINE_LINKED") {
      setLineLinked(true)
      window.history.replaceState({}, "", "/settings")
    } else if (params.get("error")?.startsWith("LINE")) {
      setLineLinked(false)
      window.history.replaceState({}, "", "/settings")
    }
  }, [])

  const handleToggleEmail = async () => {
    const authToken = localStorage.getItem("auth_token")
    if (!authToken) return

    setIsUpdatingEmail(true)
    const targetState = !emailEnabled

    try {
      const res = await fetch("/api/me/email-notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ enabled: targetState }),
      })

      if (res.ok) {
        setEmailEnabled(targetState)
      } else {
        alert("Failed to update email preferences. Please try again.")
      }
    } catch (err) {
      console.error("Failed to update email notifications:", err)
      alert("An error occurred. Please try again.")
    } finally {
      setIsUpdatingEmail(false)
    }
  }

  const [showUnlinkLineModal, setShowUnlinkLineModal] = useState(false)
  const [showFullDeleteModal, setShowFullDeleteModal] = useState(false)

  const handleConfirmUnlinkLine = async () => {
    const authToken = localStorage.getItem("auth_token")
    if (!authToken) return

    setIsUnlinkingLine(true)
    try {
      const res = await fetch("/api/me/line", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) {
        setLineLinked(false)
        setShowUnlinkLineModal(false)
      } else {
        alert("Failed to unlink LINE account. Please try again.")
      }
    } catch (err) {
      console.error("Failed to unlink LINE:", err)
      alert("An error occurred. Please try again.")
    } finally {
      setIsUnlinkingLine(false)
    }
  }

  const handleToggleGlobalFaceSearch = (checked: boolean) => {
    setConsent((prev) => ({ ...prev, globalFaceSearch: checked }))
  }

  const handleToggleDataProcessing = (checked: boolean) => {
    setConsent((prev) => ({ ...prev, dataProcessing: checked }))
  }

  const handleSavePreferences = async () => {
    setIsSaving(true)
    setShowSuccess(false)
    setSaveError("")
    try {
      const authToken = localStorage.getItem("auth_token")
      const pdpaAccepted = Boolean(consent.dataProcessing)

      if (authToken) {
        const response = await fetch("/api/me/consent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            accepted: pdpaAccepted,
            pdpaConsent: pdpaAccepted,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to save consent on server")
        }
      }

      localStorage.setItem(
        "consent_preferences",
        JSON.stringify({
          globalFaceSearch: consent.globalFaceSearch,
          dataProcessing: consent.dataProcessing,
          accepted: pdpaAccepted,
          timestamp: new Date().toISOString(),
        }),
      )

      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3500)
    } catch (error) {
      console.error("Failed to save preferences:", error)
      setSaveError(t("student.save_error") || "Failed to save preferences. Please try again.")
      setTimeout(() => setSaveError(""), 4000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportData = async () => {
    setIsExportingData(true)
    setPrivacyActionError("")
    try {
      const result = await apiClient.exportMyPrivacyData()
      if (result.error || !result.data) {
        setPrivacyActionError(result.error || "Failed to export data")
        return
      }

      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json;charset=utf-8",
      })
      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = downloadUrl
      anchor.download = `photofinder-privacy-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("Failed to export privacy data:", error)
      setPrivacyActionError("Failed to export privacy data")
    } finally {
      setIsExportingData(false)
    }
  }

  const handleConfirmFullDeleteData = async () => {
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
        `ลบข้อมูลสำเร็จ: รูปใบหน้าอ้างอิง ${details?.referenceFacesDeleted ?? 0} รายการ, รูปที่บันทึก ${details?.savedPhotosDeleted ?? 0} รูป`,
      )

      setConsent({ globalFaceSearch: false, dataProcessing: false })
      setShowFullDeleteModal(false)

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

  const initials = useMemo(
    () => (profile.name?.[0] || profile.email?.[0] || "S").toUpperCase(),
    [profile.name, profile.email],
  )
  const isDataProcessingWithdrawn = !consent.dataProcessing
  const isFaceSearchDisabledOnly = consent.dataProcessing && !consent.globalFaceSearch

  return (
    <>
      <Header showLogout userRole="student" />

      {/* REG MFU Breadcrumbs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span
              className="hover:text-[#82181a] cursor-pointer transition-colors"
              onClick={() => router.push("/dashboard")}
            >
              {t("breadcrumb.home")}
            </span>
            <span className="text-slate-400">/</span>
            <span className="font-semibold text-[#82181a]">{t("breadcrumb.settings")}</span>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-slate-500 hover:text-[#82181a] font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("breadcrumb.back")}</span>
          </button>
        </div>
      </div>

      <main className="min-h-screen bg-[#f0f2f5] pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Header Banner */}
          <div className="bg-white border border-slate-200 rounded p-6 shadow-2xs border-t-4 border-t-[#82181a]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-1.5 bg-[#82181a] rounded-xs"></div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    {t("student.settings_title")}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t("student.settings_subtitle")}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-800 self-start sm:self-auto">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>บัญชีพร้อมใช้งาน (Active)</span>
              </div>
            </div>
          </div>

          {/* Section 1: ข้อมูลบัญชีผู้ใช้ (Account Information) */}
          <div className="bg-white border border-slate-200 rounded p-6 shadow-2xs">
            <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-[#82181a]/10 text-[#82181a]">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{t("student.account_section")}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{t("student.account_desc")}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 rounded border-2 border-slate-200 shadow-2xs">
                <AvatarImage src={profile.avatarUrl} alt={profile.name || "Student"} referrerPolicy="no-referrer" />
                <AvatarFallback className="bg-[#82181a] text-white text-xl font-bold rounded">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{profile.name || "Student"}</h3>
                  <span className="text-[10px] font-bold text-[#82181a] bg-[#82181a]/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {t("student.role_badge")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>{profile.email || "No email provided"}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: ช่องทางการรับการแจ้งเตือน (Notification Channels) */}
          <div className="bg-white border border-slate-200 rounded p-6 shadow-2xs">
            <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-[#82181a]/10 text-[#82181a]">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{t("student.notif_section")}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{t("student.notif_desc")}</p>
              </div>
            </div>

            <div className="space-y-5 divide-y divide-slate-100">
              {/* LINE Official Account Row */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-1 first:pt-0">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#00B900]/10 text-[#00B900] mt-0.5">
                    <FaLine className="h-5 w-5 fill-current" />
                  </div>
                  <div className="space-y-1 max-w-lg">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{t("student.line_title")}</h3>
                      {lineLinked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {t("student.line_connected")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          {t("student.line_not_connected")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{t("student.line_desc")}</p>

                    {!lineLinked && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                        <span>{t("student.line_add_friend")}</span>
                        <a
                          href="https://lin.ee/6oiEili"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#00B900] hover:underline"
                        >
                          เพิ่มเพื่อน <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 self-start sm:self-center">
                  {lineLinked === null ? (
                    <div className="h-8 w-24 animate-pulse rounded bg-slate-100" />
                  ) : lineLinked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowUnlinkLineModal(true)}
                      disabled={isUnlinkingLine}
                      className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold h-8 rounded cursor-pointer"
                    >
                      {isUnlinkingLine && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                      {t("student.line_unlink_btn")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        const token = localStorage.getItem("auth_token") || ""
                        if (!token) return alert("Please login again first")
                        window.location.href = `/api/auth/line/login?token=${token}`
                      }}
                      className="bg-[#00B900] hover:bg-[#009b00] text-white text-xs font-semibold h-8 px-4 rounded shadow-2xs cursor-pointer"
                    >
                      {t("student.line_link_btn")}
                    </Button>
                  )}
                </div>
              </div>

              {/* Email Notifications Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mt-0.5">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 max-w-lg">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{t("student.email_title")}</h3>
                      {emailEnabled ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          {t("student.email_active")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          {t("student.email_inactive")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {profile.email
                        ? `ส่งอีเมลสรุปรูปถ่ายกิจกรรมไปยัง ${profile.email}`
                        : t("student.email_desc")}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 self-start sm:self-center">
                  <Switch
                    checked={!!emailEnabled}
                    onCheckedChange={handleToggleEmail}
                    disabled={isUpdatingEmail || emailEnabled === null}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: ความเป็นส่วนตัวและข้อมูลส่วนบุคคล (Privacy & PDPA) */}
          <div className="bg-white border border-slate-200 rounded p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-[#82181a]/10 text-[#82181a]">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{t("student.privacy_section")}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{t("student.privacy_desc")}</p>
              </div>
            </div>

            <div className="space-y-4 divide-y divide-slate-100">
              {/* Face Search Consent Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 first:pt-0">
                <div className="space-y-1 pr-4">
                  <h3 className="text-sm font-bold text-slate-900">{t("student.consent_face_title")}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{t("student.consent_face_desc")}</p>
                </div>
                <div className="shrink-0">
                  <Switch
                    checked={consent.globalFaceSearch}
                    onCheckedChange={handleToggleGlobalFaceSearch}
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Data Processing Consent Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
                <div className="space-y-1 pr-4">
                  <h3 className="text-sm font-bold text-slate-900">{t("student.consent_data_title")}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{t("student.consent_data_desc")}</p>
                </div>
                <div className="shrink-0">
                  <Switch
                    checked={consent.dataProcessing}
                    onCheckedChange={handleToggleDataProcessing}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>

            {/* Warning if disabled */}
            {isDataProcessingWithdrawn && (
              <div className="rounded border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="leading-relaxed">{t("student.withdraw_data_warning")}</p>
              </div>
            )}
            {isFaceSearchDisabledOnly && (
              <div className="rounded border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="leading-relaxed">{t("student.withdraw_face_warning")}</p>
              </div>
            )}

            {/* Save Button & Feedback */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div>
                {showSuccess && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 animate-in fade-in duration-200">
                    <Check className="h-4 w-4 text-emerald-600" />
                    {t("student.save_success")}
                  </span>
                )}
                {saveError && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive animate-in fade-in duration-200">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    {saveError}
                  </span>
                )}
              </div>
              <Button
                onClick={handleSavePreferences}
                disabled={isSaving}
                className="bg-[#82181a] hover:bg-[#641416] text-white text-xs font-semibold h-9 px-5 rounded shadow-2xs cursor-pointer transition-colors"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    {t("student.btn_saving")}
                  </>
                ) : (
                  t("student.btn_save")
                )}
              </Button>
            </div>
          </div>

          {/* Section 4: สิทธิและการจัดการข้อมูลส่วนบุคคล (Data Subject Rights) */}
          <div className="bg-white border border-slate-200 rounded p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-700">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{t("student.rights_section")}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{t("student.rights_desc")}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Export Data Tile */}
              <div className="border border-slate-200 rounded p-4 bg-slate-50/50 flex flex-col justify-between gap-3.5">
                <div>
                  <h3 className="text-xs font-bold text-slate-800">{t("student.btn_export")}</h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t("student.btn_export_desc")}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportData}
                  disabled={isExportingData || isDeletingData}
                  className="w-full bg-white hover:bg-slate-50 text-slate-700 border-slate-300 text-xs font-semibold h-8 rounded cursor-pointer"
                >
                  {isExportingData ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-slate-500 mr-1.5" />
                  )}
                  {t("student.btn_export")}
                </Button>
              </div>

              {/* Delete All Data Tile */}
              <div className="border border-rose-100 rounded p-4 bg-rose-50/20 flex flex-col justify-between gap-3.5">
                <div>
                  <h3 className="text-xs font-bold text-rose-800">{t("student.btn_delete")}</h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t("student.btn_delete_desc")}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFullDeleteModal(true)}
                  disabled={isDeletingData || isExportingData}
                  className="w-full bg-white hover:bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold h-8 rounded cursor-pointer"
                >
                  {isDeletingData ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 text-rose-600 mr-1.5" />
                  )}
                  {t("student.btn_delete")}
                </Button>
              </div>
            </div>

            {deletionStatus !== "idle" && (
              <div
                className={`rounded border p-3 text-xs ${
                  deletionStatus === "completed"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : deletionStatus === "processing"
                      ? "border-blue-200 bg-blue-50 text-blue-800"
                      : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <p className="font-bold">
                  {deletionStatus === "processing"
                    ? "กำลังดำเนินการลบข้อมูล..."
                    : deletionStatus === "completed"
                      ? "ลบข้อมูลสำเร็จ"
                      : "ไม่สามารถลบข้อมูลได้"}
                </p>
                {deletionSummary && <p className="mt-1 text-slate-600">{deletionSummary}</p>}
              </div>
            )}

            {privacyActionError && (
              <p className="text-xs font-semibold text-rose-600">{privacyActionError}</p>
            )}
          </div>
        </div>
      </main>

      {/* Unlink LINE Confirmation Modal */}
      <ConfirmationModal
        open={showUnlinkLineModal}
        onOpenChange={setShowUnlinkLineModal}
        title="Unlink LINE Account"
        description="Are you sure you want to unlink your LINE account? You will no longer receive instant event photo notifications via LINE."
        confirmText="Unlink LINE"
        cancelText="Cancel"
        variant="warning"
        isLoading={isUnlinkingLine}
        onConfirm={handleConfirmUnlinkLine}
      />

      {/* Full Privacy Data Deletion Modal */}
      <ConfirmationModal
        open={showFullDeleteModal}
        onOpenChange={setShowFullDeleteModal}
        title="Permanently Delete All Biometric Data"
        description="Warning: This action will permanently erase your reference selfies, facial embeddings/vectors, and saved photo bookmarks. Your account will be reset to an unverified state."
        confirmText="Permanently Delete All Data"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeletingData}
        requireMatchText="DELETE"
        matchPlaceholder="Type DELETE to confirm"
        onConfirm={handleConfirmFullDeleteData}
      />
    </>
  )
}
