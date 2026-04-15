"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, BadgeCheck, Camera, ImageIcon, Mail, Sparkles, Upload, User, Users } from "lucide-react"
import { apiClient } from "@/lib/api-client"

type PhotographerProfile = {
  name: string
  email: string
  avatarUrl: string
  role: "PHOTOGRAPHER" | string
}

export default function PhotographerProfilePage() {
  const router = useRouter()
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

        setPhotoCount(photos.length)
        setProcessingCount(photos.filter((photo: any) => photo.processingStatus === "PROCESSING" || photo.processingStatus === "PENDING").length)
        setCompletedCount(photos.filter((photo: any) => photo.processingStatus === "COMPLETED").length)

        const eventIds = new Set(photos.map((photo: any) => photo.eventId).filter(Boolean))
        setRecentEventsCount(eventIds.size)
      } catch (error) {
        console.error("Failed to load photographer stats:", error)
      }
    }

    loadStats()
  }, [])

  const initials = useMemo(() => (profile.name?.[0] || profile.email?.[0] || "P").toUpperCase(), [profile.name, profile.email])

  return (
    <>
      <Header userRole="photographer" />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(130,24,26,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(130,24,26,0.08),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.98),rgba(248,250,252,1))]">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <section className="overflow-hidden rounded-3xl border border-border/60 bg-card/85 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="border-b border-border/60 bg-gradient-to-r from-card/90 to-muted/40 p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Camera className="h-3.5 w-3.5" />
                    Photographer account
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Account & Settings</h1>
                  <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                    View the account details and upload-related information for this photographer profile.
                  </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/photographer")} className="rounded-full border-border/70">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to uploader
                </Button>
              </div>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              <Card className="border border-border/60 bg-background/80 shadow-sm backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Profile details
                  </CardTitle>
                  <CardDescription>This information comes from the signed-in photographer account.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-muted/30 p-6 sm:flex-row sm:items-center sm:gap-6">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={profile.avatarUrl} alt={profile.name || "Photographer"} referrerPolicy="no-referrer" />
                      <AvatarFallback className="text-xl font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="w-full space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Name</p>
                        <p className="mt-1 text-base font-semibold text-foreground">{profile.name || "Photographer"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</p>
                        <p className="mt-1 flex items-center gap-2 text-sm text-foreground">
                          <Mail className="h-4 w-4 text-primary" />
                          {profile.email || "No email found"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Access role</p>
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
                      <BadgeCheck className="h-4 w-4 text-primary" />
                      Photographer
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      You can upload photos, monitor processing status, and manage your photo library.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/60 bg-background/80 shadow-sm backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Upload workflow
                  </CardTitle>
                  <CardDescription>Useful reminders for the photographer role.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Upload className="h-4 w-4 text-primary" />
                      Upload events
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Select an event before uploading to keep photos organized and searchable.</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      Review your library
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Track completed and processing photos from your uploaded collection.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
