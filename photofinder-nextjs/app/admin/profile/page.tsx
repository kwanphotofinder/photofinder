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
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(130,24,26,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(130,24,26,0.08),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.98),rgba(248,250,252,1))]">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <section className="overflow-hidden rounded-3xl border border-border/60 bg-card/85 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="border-b border-border/60 bg-gradient-to-r from-card/90 to-muted/40 p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Shield className="h-3.5 w-3.5" />
                    Admin account
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Account & Settings</h1>
                  <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                    View the account details currently used for your admin access.
                  </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/admin/dashboard")} className="rounded-full border-border/70">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to dashboard
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
                  <CardDescription>This information comes from your current signed-in account.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-muted/30 p-6 sm:flex-row sm:items-center sm:gap-6">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={profile.avatarUrl} alt={profile.name || "Admin"} referrerPolicy="no-referrer" />
                      <AvatarFallback className="text-xl font-semibold">
                        {(profile.name?.[0] || profile.email?.[0] || "A").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="w-full space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Name</p>
                        <p className="mt-1 text-base font-semibold text-foreground">{profile.name || "Admin"}</p>
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
                      {isSuperAdmin ? <Crown className="h-4 w-4 text-amber-600" /> : <BadgeCheck className="h-4 w-4 text-primary" />}
                      {isSuperAdmin ? "Super Admin" : "Admin"}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {isSuperAdmin
                        ? "You can manage admins, photographers, events, and moderation workflows."
                        : "You can manage events, photographers, and moderation workflows."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/60 bg-background/80 shadow-sm backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    Admin Settings
                  </CardTitle>
                  <CardDescription>Quick access context for admin operations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Users className="h-4 w-4 text-primary" />
                        User management
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">Adjust roles and review account access from the admin dashboard.</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Bell className="h-4 w-4 text-primary" />
                        Moderation workflow
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">Handle removal requests and event review from the admin tools.</p>
                    </div>
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
