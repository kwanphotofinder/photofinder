"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, BadgeCheck, Bell, Crown, Mail, Settings, Shield, User, Users } from "lucide-react"

type AdminProfile = {
  name: string
  email: string
  avatarUrl: string
  role: "ADMIN" | "SUPER_ADMIN" | string
}

export default function AdminProfilePage() {
  const router = useRouter()
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
      <main className="min-h-screen bg-[#f8fafc] text-slate-800 pb-16">
        {/* Sub-header banner */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#82181A] hover:underline mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับสู่แดชบอร์ด (Back to Dashboard)</span>
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#82181A] uppercase tracking-wider mb-1">
              ส่วนทะเบียนและประมวลผล • ข้อมูลบุคลากรผู้ดูแลระบบ
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              ข้อมูลบัญชีผู้ดูแลระบบ (Admin Profile & Permissions)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              รายละเอียดบัญชีผู้ใช้งานที่ใช้ในการเข้าถึงและกำกับดูแลระบบทะเบียนภาพถ่าย
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* Profile Card */}
          <Card className="border border-slate-200 border-t-4 border-t-[#82181A] bg-white rounded-lg shadow-xs overflow-hidden">
            <CardHeader className="border-b border-slate-100 py-4 px-6 bg-slate-50/50">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="h-4 w-4 text-[#82181A]" />
                ข้อมูลประจำตัวเจ้าหน้าที่ (Personnel Details)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">ข้อมูลที่ผูกกับเซสชันการเข้าสู่ระบบปัจจุบัน</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-md border border-slate-200 bg-slate-50/50">
                <Avatar className="h-16 w-16 ring-1 ring-slate-300">
                  <AvatarImage src={profile.avatarUrl} alt={profile.name || "Admin"} referrerPolicy="no-referrer" />
                  <AvatarFallback className="bg-[#82181A] text-white text-xl font-bold">
                    {(profile.name?.[0] || profile.email?.[0] || "A").toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="w-full space-y-2 text-center sm:text-left">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ชื่อ-นามสกุล / ชื่อแสดงผล (Name)</span>
                    <p className="text-base font-bold text-slate-900">{profile.name || "ไม่ระบุชื่อ"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">อีเมลทางการ (Email)</span>
                    <p className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-700 font-medium mt-0.5">
                      <Mail className="h-3.5 w-3.5 text-[#82181A]" />
                      {profile.email || "ไม่มีข้อมูลอีเมล"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-4 space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ระดับสิทธิ์การเข้าถึง (Authorization Level)</span>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  {isSuperAdmin ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-300 text-xs font-semibold">
                      <Crown className="h-3.5 w-3.5 text-amber-600" />
                      ผู้ดูแลระบบสูงสุด (Super Administrator)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#82181A]/10 text-[#82181A] border border-[#82181A]/20 text-xs font-semibold">
                      <BadgeCheck className="h-3.5 w-3.5 text-[#82181A]" />
                      เจ้าหน้าที่ส่วนทะเบียน (Registrar Administrator)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 pt-1">
                  {isSuperAdmin
                    ? "คุณมีสิทธิ์สูงสุดในการจัดการแต่งตั้งแอดมิน, ช่างภาพ, กิจกรรม, อนุมัติคำขอลบภาพ และจัดการฐานข้อมูลความปลอดภัย"
                    : "คุณมีสิทธิ์ในการบริหารจัดการกิจกรรม, ตรวจสอบภาพถ่าย, คัดกรองคิว AI และอนุมัติคำขอลบภาพตามมาตรฐาน PDPA"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Context Card */}
          <Card className="border border-slate-200 bg-white rounded-lg shadow-xs overflow-hidden">
            <CardHeader className="border-b border-slate-100 py-4 px-6 bg-slate-50/50">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Settings className="h-4 w-4 text-slate-700" />
                ภารกิจงานที่รับผิดชอบ (Administrative Scope)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <Users className="h-4 w-4 text-[#82181A]" />
                    งานบริหารสิทธิ์และผู้ใช้งาน
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    แต่งตั้งช่างภาพ มอบหมายสิทธิ์แอดมิน และตรวจสอบสถานะการเข้าใช้งานของนักศึกษา
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <Bell className="h-4 w-4 text-[#82181A]" />
                    งานกำกับดูแลความเป็นส่วนตัว (PDPA)
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    พิจารณาคำร้องขอลบหรือเบลอใบหน้าจากนักศึกษา และตรวจสอบคิวภาพที่มีความมั่นใจต่ำ
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
