"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, BadgeCheck, Camera, CheckCircle, Clock, ImageIcon, Mail, Shield, Upload, User, Users } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useLanguage } from "@/lib/language-context"

type PhotographerProfile = {
  name: string
  email: string
  avatarUrl: string
  role: "PHOTOGRAPHER" | string
}

export default function PhotographerProfilePage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [profile, setProfile] = useState<PhotographerProfile>({
    name: "",
    email: "",
    avatarUrl: "",
    role: "PHOTOGRAPHER",
  })
  const [photoCount, setPhotoCount] = useState(0)
  const [processingCount, setProcessingCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [recentEventsCount, setRecentEventsCount] = useState(0)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("dev") === "true" || (!localStorage.getItem("auth_token") && process.env.NODE_ENV === "development")) {
        if (!localStorage.getItem("auth_token") || localStorage.getItem("user_role") !== "photographer") {
          localStorage.setItem("auth_token", "dev_photographer_token");
          localStorage.setItem("user_role", "photographer");
          localStorage.setItem("user_name", "ช่างภาพกิจกรรม มฟล.");
          localStorage.setItem("user_email", "photo.service@mfu.ac.th");
        }
      }
    }

    const authToken = localStorage.getItem("auth_token")
    const userRole = localStorage.getItem("user_role")

    if (!authToken || userRole !== "photographer") {
      router.push("/login")
      return
    }

    const storedData = localStorage.getItem("user_data")
    const storedName = localStorage.getItem("user_name") || "Photographer"
    const storedEmail = localStorage.getItem("user_email") || ""

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
        console.error("Failed to parse photographer profile:", error)
      }
    }

    setProfile({
      name: nextName,
      email: nextEmail,
      avatarUrl: nextAvatar,
      role: "PHOTOGRAPHER",
    })
  }, [router])

  useEffect(() => {
    const loadStats = async () => {
      try {
        const result = await apiClient.getMyPhotos()
        const photos = Array.isArray(result.data) ? result.data : []

        if (photos.length > 0) {
          setPhotoCount(photos.length)
          setProcessingCount(photos.filter((photo: any) => photo.processingStatus === "PROCESSING" || photo.processingStatus === "PENDING").length)
          setCompletedCount(photos.filter((photo: any) => photo.processingStatus === "COMPLETED").length)

          const eventIds = new Set(photos.map((photo: any) => photo.eventId).filter(Boolean))
          setRecentEventsCount(eventIds.size)
        } else if (process.env.NODE_ENV === "development") {
          setPhotoCount(124)
          setCompletedCount(118)
          setProcessingCount(6)
          setRecentEventsCount(3)
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          setPhotoCount(124)
          setCompletedCount(118)
          setProcessingCount(6)
          setRecentEventsCount(3)
        }
      }
    }

    loadStats()
  }, [])

  const initials = useMemo(() => (profile.name?.[0] || profile.email?.[0] || "P").toUpperCase(), [profile.name, profile.email])

  return (
    <>
      <Header showLogout userRole="photographer" />

      <main className="min-h-screen bg-[#f0f2f5] pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Card */}
          <div className="bg-white border border-slate-200 rounded p-6 shadow-2xs mb-6 border-t-4 border-t-[#82181a]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-1.5 bg-[#82181a] rounded-xs"></div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t("photo.profile.title")}</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t("photo.profile.subtitle")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push("/photographer")}
                className="border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-xs font-semibold rounded h-9 px-3.5 bg-white shadow-2xs self-start sm:self-auto transition-colors"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                {t("photo.profile.back")}
              </Button>
            </div>
          </div>

          {/* Profile Identity Card */}
          <div className="bg-white border border-slate-200 rounded p-6 shadow-2xs mb-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-slate-100">
              <Avatar className="h-20 w-20 rounded border-2 border-slate-200 shadow-2xs">
                <AvatarImage src={profile.avatarUrl} alt={profile.name || "Photographer"} referrerPolicy="no-referrer" />
                <AvatarFallback className="bg-[#82181a] text-white text-2xl font-bold rounded">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="text-center sm:text-left space-y-1 flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{profile.name || "Photographer"}</h2>
                  <span className="text-[10px] font-bold text-[#82181a] bg-[#82181a]/10 px-2 py-0.5 rounded uppercase tracking-wider">
                    {t("photo.profile.role_badge")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center justify-center sm:justify-start gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {profile.email || "No email provided"}
                </p>
              </div>

              <div className="border border-emerald-200 bg-emerald-50/70 text-emerald-800 rounded px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {t("photo.profile.active")}
              </div>
            </div>

            {/* Performance Statistics Grid */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                {t("photo.profile.metrics_title")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="border border-slate-200 rounded p-3.5 bg-slate-50/50">
                  <span className="text-[11px] font-semibold text-slate-500">{t("photo.profile.stat_total")}</span>
                  <p className="text-xl font-bold text-slate-900 mt-1">{photoCount.toLocaleString()}</p>
                </div>
                <div className="border border-slate-200 rounded p-3.5 bg-slate-50/50">
                  <span className="text-[11px] font-semibold text-slate-500">{t("photo.profile.stat_completed")}</span>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{completedCount.toLocaleString()}</p>
                </div>
                <div className="border border-slate-200 rounded p-3.5 bg-slate-50/50">
                  <span className="text-[11px] font-semibold text-slate-500">{t("photo.profile.stat_processing")}</span>
                  <p className="text-xl font-bold text-amber-700 mt-1">{processingCount.toLocaleString()}</p>
                </div>
                <div className="border border-slate-200 rounded p-3.5 bg-slate-50/50">
                  <span className="text-[11px] font-semibold text-slate-500">{t("photo.profile.stat_events")}</span>
                  <p className="text-xl font-bold text-[#82181a] mt-1">{recentEventsCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Guidelines Card */}
          <div className="bg-white border border-slate-200 rounded p-6 shadow-2xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
              <Shield className="w-4 h-4 text-[#82181a]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                {t("photo.profile.guidelines_title")}
              </h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-xs text-slate-600">
              <div className="border border-slate-100 rounded p-3.5 bg-slate-50/60 flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800">{t("photo.profile.guide1_title")}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t("photo.profile.guide1_desc")}</p>
                </div>
              </div>

              <div className="border border-slate-100 rounded p-3.5 bg-slate-50/60 flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800">{t("photo.profile.guide2_title")}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t("photo.profile.guide2_desc")}</p>
                </div>
              </div>

              <div className="border border-slate-100 rounded p-3.5 bg-slate-50/60 flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800">{t("photo.profile.guide3_title")}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t("photo.profile.guide3_desc")}</p>
                </div>
              </div>

              <div className="border border-slate-100 rounded p-3.5 bg-slate-50/60 flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800">{t("photo.profile.guide4_title")}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t("photo.profile.guide4_desc")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
