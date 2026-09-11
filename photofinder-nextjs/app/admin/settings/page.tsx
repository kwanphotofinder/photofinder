"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Settings, Users, Bell, ArrowLeft } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

export default function AdminSettingsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [adminName, setAdminName] = useState("")

  useEffect(() => {
    const adminToken = localStorage.getItem("admin_token")
    if (!adminToken) {
      router.push("/login")
      return
    }

    setAdminName(localStorage.getItem("admin_name") || "Admin")
  }, [router])

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
            <span className="font-semibold text-[#82181a]">{t("breadcrumb.settings")}</span>
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {/* Header Banner */}
          <div className="bg-white border border-slate-200 rounded p-5 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 bg-[#82181a] rounded-xs"></div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t("settings.title")}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("settings.subtitle")}
                </p>
              </div>
            </div>
          </div>

          {/* Settings Card (REG MFU Top Maroon Border) */}
          <Card className="border border-slate-200 border-t-4 border-t-[#82181a] bg-white rounded shadow-2xs overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#82181a]" />
                {t("settings.session_title")}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">{t("settings.session_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="rounded border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400">{t("settings.signed_in_as")}</p>
                <p className="mt-1 text-base font-bold text-slate-900">{adminName || "Administrator"}</p>
                <p className="mt-0.5 text-xs text-slate-500">{t("settings.session_active")}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div
                  onClick={() => router.push("/admin/dashboard")}
                  className="rounded border border-slate-200 bg-white p-4 cursor-pointer hover:border-[#82181a] hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Users className="h-4 w-4 text-[#82181a]" />
                    {t("settings.user_roles_title")}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {t("settings.user_roles_desc")}
                  </p>
                </div>

                <div
                  onClick={() => router.push("/admin/dashboard")}
                  className="rounded border border-slate-200 bg-white p-4 cursor-pointer hover:border-[#82181a] hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Bell className="h-4 w-4 text-[#82181a]" />
                    {t("settings.moderation_title")}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {t("settings.moderation_desc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
