"use client"

import type React from "react"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, ArrowLeft, Loader } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useLanguage } from "@/lib/language-context"

export default function CreateEventPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    status: "DRAFT" as "DRAFT" | "PUBLISHED",
    expiryDays: 30, // Default to max 30 days
  })

  useEffect(() => {
    const adminToken = localStorage.getItem("admin_token")
    const userRole = localStorage.getItem("user_role")

    if (!adminToken || (userRole !== "admin" && userRole !== "super_admin")) {
      if (userRole === "photographer") {
        router.push("/photographer")
      } else if (userRole === "student") {
        router.push("/dashboard")
      } else {
        router.push("/login")
      }
      return
    }
    setIsLoading(false)
  }, [router])

  const handleInputChange = (field: string, value: string | boolean | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Validate required fields
      if (!formData.name.trim()) {
        setError("Event name is required")
        setIsSubmitting(false)
        return
      }

      if (!formData.date) {
        setError("Event date is required")
        setIsSubmitting(false)
        return
      }

      // Validate date is not in the past
      const selectedDate = new Date(formData.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Generate slug from name
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "") + "-" + Date.now().toString().slice(-4)

      // Calculate expiry date based on days selected
      let expiryDate = null;
      if (formData.expiryDays > 0) {
        const d = new Date();
        d.setDate(d.getDate() + formData.expiryDays);
        expiryDate = d.toISOString();
      }

      // Call API to create event
      const response = await apiClient.createEvent({
        name: formData.name.trim(),
        date: new Date(formData.date).toISOString(),
        status: formData.status,
        slug: slug,
        expiresAt: expiryDate,
      })

      if (response.error) {
        setError(response.error || "Failed to create event")
        setIsSubmitting(false)
        return
      }

      // Success - redirect to dashboard or event management
      router.push("/admin/dashboard")
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <Header userRole="admin" />
        <main className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
          <Loader className="w-8 h-8 text-[#82181a] animate-spin" />
        </main>
      </>
    )
  }

  return (
    <>
      <Header userRole="admin" />

      {/* REG MFU Breadcrumbs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="hover:text-[#82181a] cursor-pointer" onClick={() => router.push("/admin/dashboard")}>{t("breadcrumb.home")}</span>
            <span className="text-slate-400">/</span>
            <span className="hover:text-[#82181a] cursor-pointer" onClick={() => router.push("/admin/dashboard")}>{t("breadcrumb.admin")}</span>
            <span className="text-slate-400">/</span>
            <span className="font-semibold text-[#82181a]">{t("breadcrumb.create_event")}</span>
          </div>
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="flex items-center gap-1 text-slate-500 hover:text-[#82181a] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("breadcrumb.back")}</span>
          </button>
        </div>
      </div>

      <main className="min-h-screen bg-[#f0f2f5] pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          {/* Header Banner */}
          <div className="bg-white border border-slate-200 rounded p-5 mb-6 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 bg-[#82181a] rounded-xs"></div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t("event_form.create_title")}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("event_form.create_subtitle")}
                </p>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="border border-red-200 bg-red-50 p-4 rounded mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs text-red-800">Error</p>
                <p className="text-xs text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Form Card (REG MFU Top Maroon Border) */}
          <Card className="border border-slate-200 border-t-4 border-t-[#82181a] bg-white rounded shadow-2xs overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
              <CardTitle className="text-sm font-bold text-slate-800">{t("event_form.card_title")}</CardTitle>
              <CardDescription className="text-xs text-slate-500">{t("event_form.card_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Event Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-bold text-slate-700">
                    {t("event_form.name_label")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder={t("event_form.name_placeholder")}
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="border-slate-300 text-xs h-9 rounded"
                    disabled={isSubmitting}
                  />
                  <p className="text-[11px] text-slate-400">{t("event_form.name_help")}</p>
                </div>

                {/* Event Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="date" className="text-xs font-bold text-slate-700">
                    {t("event_form.date_label")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    className="border-slate-300 text-xs h-9 rounded max-w-xs"
                    disabled={isSubmitting}
                  />
                  <p className="text-[11px] text-slate-400">{t("event_form.date_help")}</p>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <Label htmlFor="status" className="text-xs font-bold text-slate-700">
                    {t("event_form.status_label")}
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange("status", value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="border-slate-300 text-xs h-9 rounded max-w-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">{t("event_form.status_draft")}</SelectItem>
                      <SelectItem value="PUBLISHED">{t("event_form.status_published")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-400">
                    {formData.status === "DRAFT" ? t("event_form.status_draft") : t("event_form.status_published")}
                  </p>
                </div>

                {/* Expiry Settings */}
                <div className="space-y-3 p-4 border border-slate-200 rounded bg-slate-50/70">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-[#82181a]" />
                      {t("event_form.timer_label")}
                    </Label>
                    <p className="text-[11px] text-slate-500">
                      {t("event_form.timer_desc")}
                    </p>
                  </div>
                  
                  <div className="flex gap-2 max-w-md">
                    {[7, 14, 30].map((days) => (
                      <Button
                        key={days}
                        type="button"
                        variant={formData.expiryDays === days ? "default" : "outline"}
                        className={`flex-1 h-8 text-xs rounded ${formData.expiryDays === days ? "bg-[#82181a] hover:bg-[#9c1f22] text-white" : "border-slate-300 bg-white text-slate-700"}`}
                        onClick={() => handleInputChange("expiryDays", days)}
                      >
                        {days} {t("event_form.days_unit")}
                      </Button>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-3 pt-1">
                    <Label htmlFor="customDays" className="text-xs text-slate-600">{t("event_form.custom_days")}</Label>
                    <Input
                      id="customDays"
                      type="number"
                      min="1"
                      max="30"
                      value={formData.expiryDays}
                      onChange={(e) => {
                        let val = parseInt(e.target.value) || 0;
                        if (val > 30) val = 30;
                        if (val < 0) val = 0;
                        handleInputChange("expiryDays", val);
                      }}
                      className="w-20 h-7 text-xs border-slate-300 rounded bg-white"
                      disabled={isSubmitting}
                    />
                    <span className="text-[11px] text-slate-400">{t("event_form.max_days")}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/admin/dashboard")}
                    disabled={isSubmitting}
                    className="flex-1 h-9 text-xs border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
                  >
                    {t("event_form.btn_cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 h-9 text-xs rounded bg-[#82181a] hover:bg-[#9c1f22] text-white font-semibold"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        {t("event_form.btn_saving")}
                      </>
                    ) : (
                      t("event_form.btn_create")
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Info Card */}
          <div className="border border-slate-200 bg-white rounded p-4 mt-4 text-xs text-slate-600 shadow-2xs">
            <p className="font-bold text-slate-800 text-xs mb-2">ขั้นตอนหลังจากสร้างกิจกรรม:</p>
            <ul className="space-y-1 text-slate-500 list-disc list-inside text-[11px]">
              <li>กิจกรรมจะแสดงในแผงควบคุมระบบของผู้ดูแลระบบและช่างภาพ</li>
              <li>ช่างภาพที่ได้รับสิทธิ์สามารถเริ่มอัปโหลดภาพถ่ายเข้าระบบได้ทันที</li>
              <li>ระบบ AI จะประมวลผลและสร้าง Face Embedding เพื่อให้นักศึกษาค้นหาใบหน้าตนเอง</li>
            </ul>
          </div>
        </div>
      </main>
    </>
  )
}
