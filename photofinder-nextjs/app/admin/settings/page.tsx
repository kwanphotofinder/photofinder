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
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(130,24,26,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(130,24,26,0.08),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.98),rgba(248,250,252,1))]">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <section className="overflow-hidden rounded-3xl border border-border/60 bg-card/85 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="border-b border-border/60 bg-gradient-to-r from-card/90 to-muted/40 p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Settings className="h-3.5 w-3.5" />
                    Admin settings
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Settings</h1>
                  <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                    Manage admin-only preferences, access, and workflow shortcuts for {adminName || "your account"}.
                  </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/admin/dashboard")} className="rounded-full border-border/70">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to dashboard
                </Button>
              </div>
            </div>

            <div className="grid gap-6 p-6 sm:p-8">
              <Card className="border border-border/60 bg-background/80 shadow-sm backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Admin access
                  </CardTitle>
                  <CardDescription>Confirm the current admin session and available account actions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Signed in as</p>
                    <p className="mt-2 text-base font-semibold text-foreground">{adminName || "Admin"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Admin dashboard access is active for this session.</p>
                  </div>

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
