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

export default function CreateEventPage() {
  const router = useRouter()
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
        <Header showLogout />
        <main className="min-h-screen bg-background flex items-center justify-center">
          <Loader className="w-8 h-8 text-primary animate-spin" />
        </main>
      </>
    )
  }

  return (
    <>
      <Header userRole="admin" />
      <main className="min-h-screen bg-[#f8fafc] text-slate-800 pb-16">
        {/* Sub-header banner */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#82181A] hover:underline mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับสู่แดชบอร์ด (Back to Dashboard)</span>
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#82181A] uppercase tracking-wider mb-1">
              ส่วนทะเบียนและประมวลผล • งานทะเบียนกิจกรรม
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              ลงทะเบียนกิจกรรมใหม่ (Create New Campus Event)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              สร้างรายการกิจกรรมสำหรับเปิดรับภาพถ่ายจากช่างภาพและเปิดให้นักศึกษาค้นหาภาพใบหน้า
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          {/* Error Alert */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-900">เกิดข้อผิดพลาดในการบันทึกข้อมูล</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Form Card */}
          <Card className="border border-slate-200 border-t-4 border-t-[#82181A] bg-white rounded-lg shadow-xs overflow-hidden">
            <CardHeader className="border-b border-slate-100 py-4 px-6 bg-slate-50/50">
              <CardTitle className="text-base font-bold text-slate-900">ข้อมูลรายละเอียดกิจกรรม (Event Information)</CardTitle>
              <CardDescription className="text-xs text-slate-500">กรอกข้อมูลพื้นฐานและเงื่อนไขการจัดเก็บภาพถ่าย</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Event Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-bold text-slate-800">
                    ชื่อกิจกรรม (Event Name) <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="เช่น พิธีพระราชทานปริญญาบัตร ประจำปีการศึกษา 2568"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="h-9 border-slate-300 text-xs focus:border-[#82181A]"
                    disabled={isSubmitting}
                  />
                  <p className="text-[11px] text-slate-400">ระบุชื่อกิจกรรมอย่างเป็นทางการให้ชัดเจน</p>
                </div>

                {/* Event Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="date" className="text-xs font-bold text-slate-800">
                    วันที่จัดกิจกรรม (Event Date) <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    className="h-9 border-slate-300 text-xs focus:border-[#82181A]"
                    disabled={isSubmitting}
                  />
                  <p className="text-[11px] text-slate-400">วันที่เริ่มต้นการจัดกิจกรรมตามปฏิทินมหาวิทยาลัย</p>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <Label htmlFor="status" className="text-xs font-bold text-slate-800">
                    สถานะการเผยแพร่ (Publishing Status)
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange("status", value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="h-9 border-slate-300 text-xs focus:border-[#82181A]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-200">
                      <SelectItem value="DRAFT" className="text-xs">ฉบับร่าง (Draft) — ยังไม่เปิดให้นักศึกษาค้นหาภาพ</SelectItem>
                      <SelectItem value="PUBLISHED" className="text-xs">เผยแพร่ทันที (Published) — เปิดให้นักศึกษาค้นหาภาพได้</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-400">
                    สามารถตั้งเป็นฉบับร่างไว้ก่อน และเปิดเผยแพร่หลังจากอัปโหลดภาพเสร็จสิ้น
                  </p>
                </div>

                {/* Expiry Settings */}
                <div className="space-y-3 p-4 border border-slate-200 rounded-md bg-slate-50/70">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-[#82181A]" />
                      ระยะเวลาจัดเก็บภาพถ่ายอัตโนมัติ (Data Retention Period)
                    </Label>
                    <p className="text-[11px] text-slate-500">
                      ตามนโยบายการคุ้มครองข้อมูลส่วนบุคคล (PDPA) ภาพถ่ายกิจกรรมจะถูกลบออกจากระบบจัดเก็บข้อมูลเมื่อครบกำหนด
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    {[7, 14, 30].map((days) => (
                      <Button
                        key={days}
                        type="button"
                        variant={formData.expiryDays === days ? "default" : "outline"}
                        className={`flex-1 h-8 text-xs font-medium rounded ${
                          formData.expiryDays === days 
                            ? "bg-[#82181A] hover:bg-[#6e1416] text-white shadow-none" 
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                        onClick={() => handleInputChange("expiryDays", days)}
                      >
                        {days} วัน ({days} Days)
                      </Button>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-3 pt-1">
                    <Label htmlFor="customDays" className="text-xs font-medium text-slate-700 whitespace-nowrap">ระบุจำนวนวันเอง:</Label>
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
                      className="w-20 h-8 text-xs border-slate-300"
                      disabled={isSubmitting}
                    />
                    <span className="text-[11px] text-slate-400">(สูงสุดไม่เกิน 30 วัน ตามนโยบายมหาวิทยาลัย)</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                    className="flex-1 h-9 text-xs border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md font-medium"
                  >
                    ยกเลิก (Cancel)
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 h-9 text-xs bg-[#82181A] hover:bg-[#6e1416] text-white rounded-md shadow-xs font-medium"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        กำลังบันทึกข้อมูล...
                      </>
                    ) : (
                      "บันทึกและสร้างกิจกรรม (Create Event)"
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
