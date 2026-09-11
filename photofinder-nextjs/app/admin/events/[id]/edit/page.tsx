"use client"

import type React from "react"

import { useRouter, useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, ArrowLeft, Loader, Pencil } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useLanguage } from "@/lib/language-context"

interface EventData {
    name: string
    date: string
    status: "DRAFT" | "PUBLISHED"
}

export default function EditEventPage() {
    const router = useRouter()
    const { t } = useLanguage()
    const params = useParams()
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        date: "",
        status: "DRAFT" as "DRAFT" | "PUBLISHED" | "ARCHIVED",
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

        const fetchEvent = async () => {
            try {
                const response = await apiClient.getEvent(params.id as string)
                if (response.data) {
                    const eventData = response.data as EventData
                    setFormData({
                        name: eventData.name,
                        date: new Date(eventData.date).toISOString().split('T')[0],
                        status: eventData.status,
                    })
                } else {
                    setError("Event not found")
                }
            } catch (err) {
                setError("Failed to fetch event")
            } finally {
                setIsLoading(false)
            }
        }

        fetchEvent()
    }, [router, params.id])

    const handleInputChange = (field: string, value: string | boolean) => {
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

            // Call API to update event
            const response = await apiClient.updateEvent(params.id as string, {
                name: formData.name.trim(),
                date: new Date(formData.date).toISOString(),
                status: formData.status,
            })

            if (response.error) {
                setError(response.error || "Failed to update event")
                setIsSubmitting(false)
                return
            }

            // Success - redirect to dashboard
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
                        <span className="font-semibold text-[#82181a]">{t("breadcrumb.edit_event")}</span>
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
                                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t("event_form.edit_title")}</h1>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {t("event_form.edit_subtitle")}
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
                                            <SelectItem value="ARCHIVED">{t("event_form.status_archived")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-slate-400">
                                        {formData.status === "DRAFT" ? t("event_form.status_draft") : formData.status === "PUBLISHED" ? t("event_form.status_published") : t("event_form.status_archived")}
                                    </p>
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
                                            t("event_form.btn_save")
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </>
    )
}
