"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Settings, Users, Bell, ArrowLeft } from "lucide-react"

export default function AdminSettingsPage() {
  const router = useRouter()
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
              ส่วนทะเบียนและประมวลผล • การตั้งค่าระบบ
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              การตั้งค่าระบบผู้ดูแล (System & Governance Settings)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              ภาพรวมการควบคุมเซสชัน มาตรฐานการกำกับดูแลข้อมูล และการเข้าถึงระบบ
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          <Card className="border border-slate-200 border-t-4 border-t-[#82181A] bg-white rounded-lg shadow-xs overflow-hidden">
            <CardHeader className="border-b border-slate-100 py-4 px-6 bg-slate-50/50">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#82181A]" />
                สถานะเซสชันผู้ดูแลระบบ (Active Session Status)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">ตรวจสอบความถูกต้องของการลงชื่อเข้าใช้งานปัจจุบัน</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ลงชื่อเข้าใช้ในชื่อ (Signed in as)</span>
                <p className="mt-1 text-base font-bold text-slate-900">{adminName || "Admin"}</p>
                <p className="mt-1 text-xs text-slate-500">เซสชันเจ้าหน้าที่ส่วนทะเบียนกำลังทำงานและเชื่อมต่อฐานข้อมูลอย่างปลอดภัย</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <Users className="h-4 w-4 text-[#82181A]" />
                    ระบบจัดการสิทธิ์ (Role Control)
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    สามารถปรับเปลี่ยนสิทธิ์ช่างภาพและแอดมินได้ผ่านแท็บจัดการผู้ใช้งานในหน้าแดชบอร์ดหลัก
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <Bell className="h-4 w-4 text-[#82181A]" />
                    ระบบคุ้มครองข้อมูล (PDPA Compliance)
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    จัดการคำร้องขอลบหรือเบลอภาพถ่ายจากนักศึกษาได้แบบเรียลไทม์ผ่านแดชบอร์ด
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
