"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  Sliders,
  ToggleLeft,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  HardDrive,
  Images,
  Users2,
  Clock,
  Sparkles,
  UserPlus,
  Mail,
  DownloadCloud,
  Lock,
  ExternalLink,
  History,
  Key,
  Eye,
  EyeOff,
  Bot,
  MessageSquare,
  Undo2,
} from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { apiClient } from "@/lib/api-client"

const minutesToTime = (minutes: number) => {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

interface SettingDefinition {
  key: string
  nameTh: string
  nameEn: string
  descriptionTh: string
  descriptionEn: string
  category: "business" | "features"
  type: "number" | "boolean"
  defaultValue: number
  min?: number
  max?: number
  step?: number
  unitTh?: string
  unitEn?: string
  isDangerous?: boolean
}

interface SecretItem {
  key: string
  nameTh: string
  nameEn: string
  serviceTh?: string
  serviceEn?: string
  service?: string
  descriptionTh: string
  descriptionEn: string
  docsUrl?: string
  placeholder: string
  isPassword?: boolean
  isConfigured: boolean
  maskedValue: string
  source: "database" | "env" | "none"
  updatedAt: string | null
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const { lang, t } = useLanguage()

  // Authentication & State
  const [isLoading, setIsLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [callerEmail, setCallerEmail] = useState("")
  const [adminName, setAdminName] = useState("")

  // Settings & Secrets State
  const [definitions, setDefinitions] = useState<SettingDefinition[]>([])
  const [savedSettings, setSavedSettings] = useState<Record<string, number>>({})
  const [draftSettings, setDraftSettings] = useState<Record<string, number>>({})

  const [secrets, setSecrets] = useState<SecretItem[]>([])
  const [draftSecrets, setDraftSecrets] = useState<Record<string, string>>({})
  const [showSecretField, setShowSecretField] = useState<Record<string, boolean>>({})

  // Action states
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("business")

  // Daily cleanup time (relocated here from the dashboard so all system config is in one place)
  const [cleanupTime, setCleanupTime] = useState("00:00")
  const [cleanupTimeDraft, setCleanupTimeDraft] = useState("00:00")
  const [cleanupLastRunAt, setCleanupLastRunAt] = useState<string | null>(null)
  const [isSavingCleanupTime, setIsSavingCleanupTime] = useState(false)
  const [cleanupTimeMessage, setCleanupTimeMessage] = useState<{ text: string; ok: boolean } | null>(null)

  // Load settings on mount
  useEffect(() => {
    const adminToken = localStorage.getItem("admin_token")
    if (!adminToken) {
      router.push("/login")
      return
    }

    setAdminName(localStorage.getItem("admin_name") || "Administrator")

    const fetchSettings = async () => {
      try {
        setIsLoading(true)
        const response = await apiClient.getSystemSettings()

        if (response.error || response.status === 403) {
          setIsSuperAdmin(false)
          return
        }

        if (response.data) {
          setIsSuperAdmin(response.data.callerRole === "SUPER_ADMIN")
          setCallerEmail(response.data.callerEmail || "")
          setDefinitions((response.data.definitions as SettingDefinition[]) || [])
          setSavedSettings(response.data.settings || {})
          setDraftSettings(response.data.settings || {})
          setSecrets((response.data.secrets as SecretItem[]) || [])
          setDraftSecrets({})

          if (response.data.callerRole === "SUPER_ADMIN") {
            const cleanupRes = await apiClient.getCleanupTime()
            if (cleanupRes.data) {
              const time = minutesToTime(cleanupRes.data.minutes)
              setCleanupTime(time)
              setCleanupTimeDraft(time)
              setCleanupLastRunAt(cleanupRes.data.lastRunAt)
            }
          }
        }
      } catch (err) {
        console.error("Failed to load system settings:", err)
        setIsSuperAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [router])

  // Detect unsaved changes in settings
  const changedSettingKeys = useMemo(() => {
    const changed: string[] = []
    for (const key of Object.keys(draftSettings)) {
      if (draftSettings[key] !== savedSettings[key]) {
        changed.push(key)
      }
    }
    return changed
  }, [draftSettings, savedSettings])

  // Detect unsaved changes in secrets
  const changedSecretKeys = useMemo(() => {
    const changed: string[] = []
    for (const [key, val] of Object.entries(draftSecrets)) {
      if (val && val.trim().length > 0) {
        changed.push(key)
      }
    }
    return changed
  }, [draftSecrets])

  const hasChanges = changedSettingKeys.length > 0 || changedSecretKeys.length > 0
  const totalChangedCount = changedSettingKeys.length + changedSecretKeys.length

  // Save the daily cleanup time (its own endpoint, separate from the settings save-all)
  const saveCleanupTime = async () => {
    const match = /^(\d{2}):(\d{2})$/.exec(cleanupTimeDraft)
    if (!match) {
      setCleanupTimeMessage({ text: t("settings.cleanup_save_error"), ok: false })
      return
    }
    setIsSavingCleanupTime(true)
    setCleanupTimeMessage(null)
    const response = await apiClient.updateCleanupTime(Number(match[1]) * 60 + Number(match[2]))
    if (response.data) {
      const time = minutesToTime(response.data.minutes)
      setCleanupTime(time)
      setCleanupTimeDraft(time)
      setCleanupTimeMessage({ text: t("settings.cleanup_saved"), ok: true })
    } else {
      setCleanupTimeMessage({ text: response.error || t("settings.cleanup_save_error"), ok: false })
    }
    setIsSavingCleanupTime(false)
  }

  // Update a single draft setting
  const handleSettingChange = (key: string, value: number) => {
    setDraftSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
    setFeedback(null)
  }

  // Update a single secret input
  const handleSecretChange = (key: string, value: string) => {
    setDraftSecrets((prev) => ({
      ...prev,
      [key]: value,
    }))
    setFeedback(null)
  }

  // Toggle secret visibility
  const toggleSecretVisibility = (key: string) => {
    setShowSecretField((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  // Revert secret to env
  const handleRevertSecretToEnv = (key: string) => {
    setDraftSecrets((prev) => ({
      ...prev,
      [key]: "__REMOVE__",
    }))
    setFeedback(null)
  }

  // Save changes
  const handleSaveChanges = async () => {
    if (!hasChanges || isSaving) return

    try {
      setIsSaving(true)
      setFeedback(null)

      const payload: {
        settings?: Record<string, number>
        secrets?: Record<string, string>
      } = {}

      if (changedSettingKeys.length > 0) {
        payload.settings = draftSettings
      }

      if (changedSecretKeys.length > 0) {
        payload.secrets = draftSecrets
      }

      const response = await apiClient.updateSystemSettings(payload)

      if (response.error || !response.data?.success) {
        setFeedback({
          type: "error",
          message: response.error || t("settings.confidence_save_error"),
        })
        return
      }

      const updated = response.data.settings
      setSavedSettings(updated)
      setDraftSettings(updated)

      if (response.data.secrets) {
        setSecrets(response.data.secrets as SecretItem[])
      }
      setDraftSecrets({})

      setFeedback({
        type: "success",
        message: `${t("settings.save_success_toast")} (${response.data.changedCount} ${t("settings.items_modified")})`,
      })

      // Auto dismiss success toast after 4s
      setTimeout(() => {
        setFeedback((curr) => (curr?.type === "success" ? null : curr))
      }, 4000)
    } catch (err) {
      console.error("Save error:", err)
      setFeedback({
        type: "error",
        message: t("settings.confidence_save_error"),
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Reset to default
  const handleResetToDefaults = async () => {
    try {
      setIsResetting(true)
      setShowResetConfirm(false)
      setFeedback(null)

      const response = await apiClient.resetSystemSettings()

      if (response.error || !response.data?.success) {
        setFeedback({
          type: "error",
          message: response.error || "Failed to reset settings",
        })
        return
      }

      const resetted = response.data.settings
      setSavedSettings(resetted)
      setDraftSettings(resetted)

      if (response.data.secrets) {
        setSecrets(response.data.secrets as SecretItem[])
      }
      setDraftSecrets({})

      setFeedback({
        type: "success",
        message: t("settings.reset_success_toast"),
      })

      setTimeout(() => {
        setFeedback((curr) => (curr?.type === "success" ? null : curr))
      }, 4000)
    } catch (err) {
      console.error("Reset error:", err)
      setFeedback({
        type: "error",
        message: "Failed to reset system settings",
      })
    } finally {
      setIsResetting(false)
    }
  }

  // Group definitions by category
  const businessDefs = useMemo(
    () => definitions.filter((d) => d.category === "business"),
    [definitions]
  )
  const featureDefs = useMemo(
    () => definitions.filter((d) => d.category === "features"),
    [definitions]
  )

  // Map icons for visual clarity
  const getSettingIcon = (key: string) => {
    switch (key) {
      case "face_match_threshold":
        return <Cpu className="w-5 h-5 text-[#82181a]" />
      case "low_confidence_threshold":
        return <Cpu className="w-5 h-5 text-[#82181a]" />
      case "max_upload_size_mb":
        return <HardDrive className="w-5 h-5 text-[#82181a]" />
      case "max_photos_per_event":
        return <Images className="w-5 h-5 text-[#82181a]" />
      case "max_faces_per_photo":
        return <Users2 className="w-5 h-5 text-[#82181a]" />
      case "ai_timeout_seconds":
        return <Clock className="w-5 h-5 text-[#82181a]" />
      case "maintenance_mode":
        return <AlertTriangle className="w-5 h-5 text-amber-600" />
      case "enable_ai_face_search":
        return <Sparkles className="w-5 h-5 text-emerald-600" />
      case "allow_public_registration":
        return <UserPlus className="w-5 h-5 text-blue-600" />
      case "enable_email_notifications":
        return <Mail className="w-5 h-5 text-indigo-600" />
      case "enable_original_download":
        return <DownloadCloud className="w-5 h-5 text-teal-600" />
      default:
        return <Sliders className="w-5 h-5 text-slate-600" />
    }
  }

  const getSecretIcon = (key: string) => {
    if (key.includes("GROQ")) {
      return <Bot className="w-5 h-5 text-amber-600" />
    }
    if (key.includes("LINE")) {
      return <MessageSquare className="w-5 h-5 text-emerald-600" />
    }
    if (key.includes("GMAIL")) {
      return <Mail className="w-5 h-5 text-red-600" />
    }
    return <Key className="w-5 h-5 text-[#82181a]" />
  }

  return (
    <>
      <Header userRole="admin" />

      {/* Breadcrumbs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span
              className="hover:text-[#82181a] cursor-pointer"
              onClick={() => router.push("/admin/dashboard")}
            >
              {t("breadcrumb.home")}
            </span>
            <span className="text-slate-400">/</span>
            <span
              className="hover:text-[#82181a] cursor-pointer"
              onClick={() => router.push("/admin/dashboard")}
            >
              {t("breadcrumb.admin")}
            </span>
            <span className="text-slate-400">/</span>
            <span className="font-semibold text-[#82181a]">
              {t("settings.system_title")}
            </span>
          </div>
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="flex items-center gap-1.5 text-slate-500 hover:text-[#82181a] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("breadcrumb.back")}</span>
          </button>
        </div>
      </div>

      <main className="min-h-screen bg-[#f0f2f5] pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* Loading Skeleton */}
          {isLoading && (
            <div className="bg-white border border-slate-200 rounded p-8 text-center space-y-3">
              <div className="animate-spin w-8 h-8 border-3 border-[#82181a] border-t-transparent rounded-full mx-auto" />
              <p className="text-xs text-slate-500">
                {t("settings.loading_verifying")}
              </p>
            </div>
          )}

          {/* ACCESS DENIED: Regular Admin or Non-Super Admin */}
          {!isLoading && !isSuperAdmin && (
            <Card className="border border-red-200 border-t-4 border-t-red-600 bg-white rounded shadow-sm overflow-hidden">
              <CardHeader className="bg-red-50/50 border-b border-red-100 p-6 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <CardTitle className="text-lg font-bold text-slate-900">
                  {t("settings.access_denied_title")}
                </CardTitle>
                <CardDescription className="text-xs text-slate-600 max-w-xl mx-auto mt-2 leading-relaxed">
                  {t("settings.access_denied_desc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 font-medium mb-4">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {t("settings.current_role")} <strong className="text-slate-900">ADMIN</strong> ({t("settings.requires_role")} <strong className="text-[#82181a]">SUPER_ADMIN</strong>)
                  </span>
                </div>
                <div>
                  <Button
                    onClick={() => router.push("/admin/dashboard")}
                    className="bg-[#82181a] hover:bg-[#641416] text-white text-xs px-5 h-9 rounded"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                    {t("settings.return_dashboard")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AUTHORIZED: Super Admin View */}
          {!isLoading && isSuperAdmin && (
            <>
              {/* Top Banner (REG MFU Style) */}
              <div className="bg-white border border-slate-200 border-t-4 border-t-[#82181a] rounded p-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded bg-[#82181a]/10 flex items-center justify-center text-[#82181a] shrink-0 mt-0.5">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                          {t("settings.system_title")}
                        </h1>
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100 text-[10px] font-bold py-0.5 px-2">
                          <ShieldCheck className="w-3 h-3 mr-1 inline text-amber-700" />
                          {t("settings.super_admin_only_badge")}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {t("settings.system_subtitle")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <div className="text-right text-[11px] text-slate-500 hidden md:block">
                      <p>{t("settings.signed_in_as")}:</p>
                      <p className="font-bold text-slate-800">{callerEmail || adminName}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className={`transition-all duration-200 bg-white border rounded p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 ${
                hasChanges ? "border-amber-300 bg-amber-50/40" : "border-slate-200"
              }`}>
                <div className="flex items-center gap-2">
                  {hasChanges ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                      </span>
                      <span>
                        {t("settings.unsaved_alert")} ({totalChangedCount}{" "}
                        {t("settings.items_modified")})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{t("settings.all_synced")}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSaving || isResetting}
                    onClick={() => setShowResetConfirm(true)}
                    className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-8 px-3 rounded"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    {t("settings.btn_reset")}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={!hasChanges || isSaving}
                    onClick={handleSaveChanges}
                    className={`text-xs h-8 px-4 rounded font-semibold transition-all ${
                      hasChanges
                        ? "bg-[#82181a] hover:bg-[#641416] text-white shadow-xs"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    {isSaving ? t("settings.btn_saving") : t("settings.btn_save")}
                  </Button>
                </div>
              </div>

              {/* Feedback Alert Toast */}
              {feedback && (
                <div
                  className={`p-3.5 rounded text-xs flex items-center justify-between border ${
                    feedback.type === "success"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                      : "bg-red-50 text-red-900 border-red-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {feedback.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                  <button
                    onClick={() => setFeedback(null)}
                    className="text-xs underline hover:opacity-80"
                  >
                    {t("settings.dismiss")}
                  </button>
                </div>
              )}

              {/* Settings Tabs (3 Tabs: Business, Features, Integrations) */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="bg-white border border-slate-200 p-1 rounded grid grid-cols-3 w-full max-w-xl h-auto">
                  <TabsTrigger
                    value="business"
                    className="data-[state=active]:bg-[#82181a] data-[state=active]:text-white text-xs font-semibold py-2 rounded transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 mr-1.5" />
                    {t("settings.tab_business")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="features"
                    className="data-[state=active]:bg-[#82181a] data-[state=active]:text-white text-xs font-semibold py-2 rounded transition-colors"
                  >
                    <ToggleLeft className="w-3.5 h-3.5 mr-1.5" />
                    {t("settings.tab_features")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="integrations"
                    className="data-[state=active]:bg-[#82181a] data-[state=active]:text-white text-xs font-semibold py-2 rounded transition-colors"
                  >
                    <Key className="w-3.5 h-3.5 mr-1.5" />
                    {t("settings.tab_integrations")}
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: BUSINESS LOGIC CONTROLS */}
                <TabsContent value="business" className="mt-0 outline-none space-y-4">
                  <Card className="border border-slate-200 bg-white rounded shadow-2xs overflow-hidden">
                    <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
                      <div className="flex items-center gap-2.5">
                        <Sliders className="w-4 h-4 text-[#82181a]" />
                        <div>
                          <CardTitle className="text-sm font-bold text-slate-900">
                            {t("settings.business_title")}
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-500 mt-0.5">
                            {t("settings.business_desc")}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 divide-y divide-slate-100">
                      {businessDefs.map((def) => {
                        const rawValue = draftSettings[def.key] ?? def.defaultValue
                        const isPercent = def.key === "face_match_threshold" || def.key === "low_confidence_threshold"
                        const displayValue = rawValue
                        const isChanged = draftSettings[def.key] !== savedSettings[def.key]
                        const currentUnit = lang === "th" ? (def.unitTh || def.unitEn || "") : (def.unitEn || def.unitTh || "")

                        return (
                          <div
                            key={def.key}
                            className={`py-4 first:pt-0 last:pb-0 transition-colors rounded px-2 -mx-2 ${
                              isChanged ? "bg-amber-50/50" : ""
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="mt-0.5 shrink-0">{getSettingIcon(def.key)}</div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-slate-900">
                                      {lang === "th" ? def.nameTh : def.nameEn}
                                    </p>
                                    {isChanged && (
                                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0">
                                        {t("settings.modified_badge")}
                                      </Badge>
                                    )}
                                    {isChanged && (
                                      <button
                                        type="button"
                                        onClick={() => handleSettingChange(def.key, def.defaultValue)}
                                        title={lang === "th" ? "คืนค่าเริ่มต้น" : "Reset to default"}
                                        className="text-slate-400 hover:text-[#82181a] transition-colors shrink-0 p-1 -m-1"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                    {lang === "th" ? def.descriptionTh : def.descriptionEn}
                                  </p>
                                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                                    <span>
                                      {t("settings.default_val")}{" "}
                                      <strong className="text-slate-600">
                                        {`${def.defaultValue} ${currentUnit}`}
                                      </strong>
                                    </span>
                                    {def.min !== undefined && def.max !== undefined && (
                                      <span>
                                        ({t("settings.allowed_range")} {def.min} - {def.max} {currentUnit})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Input Control */}
                              <div className="flex items-center gap-3 sm:min-w-64 justify-end">
                                {isPercent ? (
                                  <div className="w-full space-y-1.5">
                                    <div className="flex items-center gap-3">
                                      <Slider
                                        min={def.min ?? 35}
                                        max={def.max ?? 95}
                                        step={def.step || 1}
                                        value={[displayValue]}
                                        onValueChange={(val) => handleSettingChange(def.key, val[0])}
                                        className="flex-1"
                                      />
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Input
                                          type="number"
                                          min={def.min ?? 35}
                                          max={def.max ?? 95}
                                          value={displayValue}
                                          onChange={(e) => {
                                            const num = Number(e.target.value)
                                            if (!isNaN(num)) {
                                              handleSettingChange(def.key, Math.max(def.min ?? 35, Math.min(def.max ?? 95, num)))
                                            }
                                          }}
                                          className="h-8 w-16 text-center text-xs font-bold rounded border-slate-300"
                                        />
                                        <span className="text-xs font-bold text-slate-600">%</span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-400">
                                      <span>{t("settings.relaxed")}</span>
                                      <span>{t("settings.strict")}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min={def.min}
                                      max={def.max}
                                      step={def.step || 1}
                                      value={displayValue}
                                      onChange={(e) => {
                                        const num = Number(e.target.value)
                                        if (!isNaN(num)) {
                                          handleSettingChange(def.key, num)
                                        }
                                      }}
                                      className="h-8 w-24 text-center text-xs font-bold rounded border-slate-300"
                                    />
                                    {currentUnit && (
                                      <span className="text-xs font-medium text-slate-600 min-w-8">
                                        {currentUnit}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>

                  {isSuperAdmin && (
                    <Card className="border border-slate-200 bg-white rounded shadow-2xs overflow-hidden mt-4">
                      <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
                        <div className="flex items-center gap-2.5">
                          <Clock className="w-4 h-4 text-[#82181a]" />
                          <div>
                            <CardTitle className="text-sm font-bold text-slate-900">
                              {t("settings.cleanup_title")}
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500 mt-0.5">
                              {t("settings.cleanup_desc")}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-[11px] text-slate-500">
                            {t("settings.cleanup_last_run")}{" "}
                            {cleanupLastRunAt
                              ? new Date(cleanupLastRunAt).toLocaleString(undefined, { timeZone: "Asia/Bangkok" })
                              : t("settings.cleanup_never_run")}
                          </p>
                          <div className="flex items-center gap-3">
                            <Input
                              type="time"
                              value={cleanupTimeDraft}
                              onChange={(e) => setCleanupTimeDraft(e.target.value)}
                              className="h-8 w-28 text-center text-xs font-bold rounded border-slate-300"
                              aria-label={t("settings.cleanup_title")}
                            />
                            <span className="shrink-0 whitespace-nowrap text-[11px] font-bold text-[#82181a]">
                              {t("settings.cleanup_timezone")}
                            </span>
                            <Button
                              size="sm"
                              disabled={isSavingCleanupTime || !cleanupTimeDraft || cleanupTimeDraft === cleanupTime}
                              onClick={saveCleanupTime}
                              className="h-8 rounded bg-[#82181a] px-3 text-xs text-white hover:bg-[#9c1f22]"
                            >
                              {isSavingCleanupTime ? "…" : t("settings.confidence_save")}
                            </Button>
                          </div>
                        </div>
                        {cleanupTimeMessage && (
                          <p className={`mt-2 text-[11px] ${cleanupTimeMessage.ok ? "text-emerald-600" : "text-destructive"}`}>
                            {cleanupTimeMessage.text}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* TAB 2: FEATURE TOGGLES & EMERGENCY SWITCHES */}
                <TabsContent value="features" className="mt-0 outline-none space-y-4">
                  <Card className="border border-slate-200 bg-white rounded shadow-2xs overflow-hidden">
                    <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
                      <div className="flex items-center gap-2.5">
                        <ToggleLeft className="w-4 h-4 text-[#82181a]" />
                        <div>
                          <CardTitle className="text-sm font-bold text-slate-900">
                            {t("settings.features_title")}
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-500 mt-0.5">
                            {t("settings.features_desc")}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 divide-y divide-slate-100">
                      {featureDefs.map((def) => {
                        const isChecked = Boolean(draftSettings[def.key] ?? def.defaultValue)
                        const isChanged = draftSettings[def.key] !== savedSettings[def.key]

                        return (
                          <div
                            key={def.key}
                            className={`py-4 first:pt-0 last:pb-0 transition-colors rounded p-3 -mx-2 ${
                              def.isDangerous && isChecked
                                ? "bg-amber-50/80 border border-amber-200"
                                : isChanged
                                ? "bg-amber-50/40"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="mt-0.5 shrink-0">{getSettingIcon(def.key)}</div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-bold text-slate-900">
                                      {lang === "th" ? def.nameTh : def.nameEn}
                                    </p>
                                    {def.isDangerous && (
                                      <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] px-1.5 py-0">
                                        {t("settings.critical_badge")}
                                      </Badge>
                                    )}
                                    {isChanged && (
                                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0">
                                        {t("settings.modified_badge")}
                                      </Badge>
                                    )}
                                    {isChanged && (
                                      <button
                                        type="button"
                                        onClick={() => handleSettingChange(def.key, def.defaultValue)}
                                        title={lang === "th" ? "คืนค่าเริ่มต้น" : "Reset to default"}
                                        className="text-slate-400 hover:text-[#82181a] transition-colors shrink-0 p-1 -m-1"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                    {lang === "th" ? def.descriptionTh : def.descriptionEn}
                                  </p>
                                  {def.key === "maintenance_mode" && isChecked && (
                                    <p className="mt-1 text-[11px] font-semibold text-amber-800 bg-amber-100/60 p-1.5 rounded">
                                      ⚠️ {t("settings.maintenance_warning")}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Toggle Switch */}
                              <div className="flex items-center gap-3 shrink-0">
                                <Badge
                                  className={`text-[10px] font-bold px-2 py-0.5 ${
                                    isChecked
                                      ? def.isDangerous
                                        ? "bg-amber-100 text-amber-900 border-amber-300"
                                        : "bg-emerald-50 text-emerald-800 border-emerald-300"
                                      : "bg-slate-100 text-slate-600 border-slate-300"
                                  }`}
                                >
                                  {isChecked ? t("settings.status_on") : t("settings.status_off")}
                                </Badge>
                                <Switch
                                  checked={isChecked}
                                  onCheckedChange={(checked) => handleSettingChange(def.key, checked ? 1 : 0)}
                                  aria-label={lang === "th" ? def.nameTh : def.nameEn}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* TAB 3: API KEYS & INTEGRATIONS */}
                <TabsContent value="integrations" className="mt-0 outline-none space-y-4">
                  <Card className="border border-slate-200 bg-white rounded shadow-2xs overflow-hidden">
                    <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
                      <div className="flex items-center gap-2.5">
                        <Key className="w-4 h-4 text-[#82181a]" />
                        <div>
                          <CardTitle className="text-sm font-bold text-slate-900">
                            {t("settings.integrations_title")}
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-500 mt-0.5">
                            {t("settings.integrations_desc")}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 divide-y divide-slate-100">
                      {secrets.map((item) => {
                        const draftVal = draftSecrets[item.key] ?? ""
                        const isReverting = draftVal === "__REMOVE__"
                        const isEnteringNew = draftVal.length > 0 && !isReverting
                        const isVisible = showSecretField[item.key] || false
                        const serviceLabel = lang === "th" ? (item.serviceTh || item.service || "") : (item.serviceEn || item.service || "")

                        return (
                          <div
                            key={item.key}
                            className={`py-4 first:pt-0 last:pb-0 transition-colors rounded p-3 -mx-2 ${
                              isEnteringNew
                                ? "bg-amber-50/50"
                                : isReverting
                                ? "bg-red-50/40"
                                : ""
                            }`}
                          >
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="mt-0.5 shrink-0">{getSecretIcon(item.key)}</div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-bold text-slate-900">
                                      {lang === "th" ? item.nameTh : item.nameEn}
                                    </p>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-300 text-slate-600">
                                      {serviceLabel}
                                    </Badge>
                                    {item.source === "database" && (
                                      <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] px-1.5 py-0">
                                        {t("settings.configured_in_db")}
                                      </Badge>
                                    )}
                                    {item.source === "env" && (
                                      <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] px-1.5 py-0">
                                        {t("settings.configured_in_env")}
                                      </Badge>
                                    )}
                                    {item.source === "none" && (
                                      <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0">
                                        {t("settings.not_configured")}
                                      </Badge>
                                    )}
                                    {isEnteringNew && (
                                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0">
                                        {t("settings.new_value_entered")}
                                      </Badge>
                                    )}
                                    {isReverting && (
                                      <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] px-1.5 py-0">
                                        {t("settings.reverting_badge")}
                                      </Badge>
                                    )}
                                  </div>

                                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    {lang === "th" ? item.descriptionTh : item.descriptionEn}
                                  </p>

                                  {/* Masked current status */}
                                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                                    <Lock className="w-3 h-3 text-slate-400" />
                                    <span>
                                      {t("settings.current_key")}{" "}
                                      <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded text-[11px]">
                                        {item.isConfigured ? item.maskedValue : t("settings.empty_val")}
                                      </code>
                                    </span>
                                    {item.docsUrl && (
                                      <a
                                        href={item.docsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#82181a] hover:underline inline-flex items-center gap-0.5 ml-2"
                                      >
                                        <span>{t("settings.provider_console")}</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Input & Action buttons */}
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:min-w-80 justify-end">
                                <div className="relative flex-1">
                                  <Input
                                    type={item.isPassword && !isVisible ? "password" : "text"}
                                    placeholder={
                                      isReverting
                                        ? t("settings.reverting_placeholder")
                                        : t("settings.enter_new_secret")
                                    }
                                    value={isReverting ? "" : draftVal}
                                    onChange={(e) => handleSecretChange(item.key, e.target.value)}
                                    disabled={isReverting}
                                    className="h-8 text-xs font-mono pr-8 rounded border-slate-300"
                                  />
                                  {item.isPassword && (
                                    <button
                                      type="button"
                                      onClick={() => toggleSecretVisibility(item.key)}
                                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                                      tabIndex={-1}
                                    >
                                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                  )}
                                </div>

                                {item.source === "database" && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (isReverting) {
                                        handleSecretChange(item.key, "")
                                      } else {
                                        handleRevertSecretToEnv(item.key)
                                      }
                                    }}
                                    className={`text-xs h-8 px-2.5 rounded shrink-0 ${
                                      isReverting
                                        ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                                        : "border-slate-300 text-slate-600 hover:bg-slate-100"
                                    }`}
                                  >
                                    <Undo2 className="w-3 h-3 mr-1" />
                                    {isReverting ? t("settings.cancel_btn") : t("settings.revert_env_btn")}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Security & Audit Trail Information Card */}
              <Card className="border border-slate-200 bg-white rounded shadow-2xs overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-[#82181a]" />
                      <CardTitle className="text-xs font-bold text-slate-800">
                        {t("settings.audit_title")}
                      </CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push("/admin/dashboard")}
                      className="text-xs text-[#82181a] hover:bg-[#82181a]/10 h-7 px-2"
                    >
                      <span>{t("settings.audit_view_btn")}</span>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 text-xs text-slate-500 leading-relaxed">
                  <p>
                    {t("settings.audit_description")}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>

      {/* Confirmation Dialog for Factory Reset */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-md bg-white p-6 rounded">
          <DialogHeader className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-1">
              <RotateCcw className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              {t("settings.reset_dialog_title")}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 leading-relaxed">
              {t("settings.reset_dialog_desc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowResetConfirm(false)}
              className="text-xs rounded h-8 px-3"
            >
              {t("settings.reset_dialog_cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isResetting}
              onClick={handleResetToDefaults}
              className="bg-red-600 hover:bg-red-700 text-white text-xs rounded h-8 px-3"
            >
              {isResetting ? t("settings.btn_saving") : t("settings.reset_dialog_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
