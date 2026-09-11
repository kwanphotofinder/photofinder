"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, BadgeCheck, Bell, Crown, Mail, Settings, Shield, User, Users } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

type AdminProfile = {
  name: string
  email: string
  avatarUrl: string
  role: "ADMIN" | "SUPER_ADMIN" | string
}

export default function AdminProfilePage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [profile, setProfile] = useState<AdminProfile>({
    name: "",
    email: "",
    avatarUrl: "",
    role: "ADMIN",
  })

  useEffect(() => {
    const authToken = localStorage.getItem("auth_token")
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

    const storedData = localStorage.getItem("user_data")
    const storedName = localStorage.getItem("user_name") || localStorage.getItem("admin_name") || "Admin"
    const storedEmail = localStorage.getItem("user_email") || ""
    const storedRole = (localStorage.getItem("user_role") || "admin").toUpperCase()

    let nextName = storedName
    let nextEmail = storedEmail
    let nextAvatar = ""

    if (storedData) {
      try {
        const parsed = JSON.parse(storedData)
        nextName = parsed.name || nextName
        nextEmail = parsed.email || nextEmail
        nextAvatar = parsed.avatarUrl || parsed.picture || ""
      } catch (error) {
        console.error("Failed to parse user profile:", error)
      }
    }

    setProfile({
      name: nextName,
      email: nextEmail,
      avatarUrl: nextAvatar,
      role: storedRole,
    })
  }, [router])

  const isSuperAdmin = profile.role === "SUPER_ADMIN"

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
            <span className="font-semibold text-[#82181a]">{t("breadcrumb.profile")}</span>
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
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t("profile.title")}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("profile.subtitle")}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Card (REG MFU Top Maroon Border) */}
          <Card className="border border-slate-200 border-t-4 border-t-[#82181a] bg-white rounded shadow-2xs overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <User className="h-4 w-4 text-[#82181a]" />
                {t("profile.details_title")}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">{t("profile.details_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-slate-200 rounded bg-slate-50/50">
                <Avatar className="h-16 w-16 border-2 border-white shadow-xs">
                  <AvatarImage src={profile.avatarUrl} alt={profile.name || "Admin"} referrerPolicy="no-referrer" />
                  <AvatarFallback className="text-base font-bold bg-[#82181a] text-white">
                    {(profile.name?.[0] || profile.email?.[0] || "A").toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-1 text-center sm:text-left flex-1">
                  <div className="text-base font-bold text-slate-900">{profile.name || "Administrator"}</div>
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-500">
                    <Mail className="h-3.5 w-3.5 text-[#82181a]" />
                    <span>{profile.email || t("profile.email_not_found")}</span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1 px-3 py-1 rounded border text-xs font-semibold bg-amber-50 text-amber-800 border-amber-300">
                  {isSuperAdmin && <Crown className="w-3.5 h-3.5" />}
                  <span>{isSuperAdmin ? t("role.super_admin") : t("role.admin")}</span>
                </div>
              </div>

              {/* Role Scope */}
              <div className="p-4 border border-slate-200 rounded bg-white">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("profile.scope_title")}</p>
                <p className="text-xs text-slate-700 mt-1">
                  {isSuperAdmin
                    ? t("profile.scope_desc_super")
                    : t("profile.scope_desc_admin")}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => router.push("/admin/dashboard")}
                  className="bg-[#82181a] hover:bg-[#9c1f22] text-white text-xs h-9 px-4 rounded"
                >
                  {t("profile.btn_dashboard")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
