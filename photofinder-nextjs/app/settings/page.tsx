"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Lock, Shield, CheckCircle2, Mail, User, BadgeCheck, Sparkles } from "lucide-react"
import { PrivacyConsentForm, type ConsentData } from "@/components/privacy-consent-form"
import { apiClient } from "@/lib/api-client"

type AccountProfile = {
  name: string
  email: string
  avatarUrl: string
  role: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [consent, setConsent] = useState<ConsentData>({
    globalFaceSearch: false,
    dataProcessing: false,
  })
  const [profile, setProfile] = useState<AccountProfile>({
    name: "",
    email: "",
    avatarUrl: "",
    role: "student",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem("user_data")
    const storedName = localStorage.getItem("user_name") || localStorage.getItem("admin_name") || ""
    const storedEmail = localStorage.getItem("user_email") || ""
    const storedRole = (localStorage.getItem("user_role") || "student").toLowerCase()

    let avatarUrl = ""
    let parsedName = storedName
    let parsedEmail = storedEmail

    if (userData) {
      try {
        const parsed = JSON.parse(userData)
        parsedName = parsed.name || parsedName
        parsedEmail = parsed.email || parsedEmail
        avatarUrl = parsed.avatarUrl || parsed.picture || ""
      } catch (error) {
        console.error("Failed to parse user profile:", error)
      }
    }

    setProfile({
      name: parsedName || "User",
      email: parsedEmail || "",
      avatarUrl,
      role: storedRole,
    })
  }, [])

  useEffect(() => {
    const loadConsent = async () => {
      try {
        const authToken = localStorage.getItem("auth_token")
        if (!authToken) return

        // Fetch current consent status from server
        const consentRes = await fetch("/api/me/consent", {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        const consentData = await consentRes.json()

        if (consentRes.ok && typeof consentData.pdpaConsent === "boolean") {
          setConsent({
            globalFaceSearch: consentData.pdpaConsent,
            dataProcessing: consentData.pdpaConsent,
          })
        } else {
          // Fallback to localStorage
          const saved = localStorage.getItem("consent_preferences")
          if (saved) {
            const parsed = JSON.parse(saved)
            setConsent({
              globalFaceSearch: parsed.globalFaceSearch ?? false,
              dataProcessing: parsed.dataProcessing ?? false,
            })
          }
        }
      } catch (error) {
        console.error("Failed to load consent:", error)
        // Fallback to localStorage
        const saved = localStorage.getItem("consent_preferences")
        if (saved) {
          const parsed = JSON.parse(saved)
          setConsent({
            globalFaceSearch: parsed.globalFaceSearch ?? false,
            dataProcessing: parsed.dataProcessing ?? false,
          })
        }
      }
    }

    loadConsent()
  }, [])

  const handleConsentChange = (key: keyof ConsentData) => {
    setConsent((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSavePreferences = async () => {
    console.log("[v0] Starting save preferences")
    setIsSaving(true)
    setShowSuccess(false)

    try {
      const authToken = localStorage.getItem("auth_token")
      if (!authToken) {
        router.push("/login")
        return
      }

      // Call API to save consent status
      const consentAccepted = consent.globalFaceSearch && consent.dataProcessing
      const result = await apiClient.updateMyConsent(consentAccepted)

      if (result.error) {
        console.error("Failed to save consent:", result.error)
        setIsSaving(false)
        return
      }

      localStorage.setItem(
        "consent_preferences",
        JSON.stringify({
          ...consent,
          accepted: consentAccepted,
          timestamp: new Date().toISOString(),
        }),
      )

      setIsSaving(false)
      console.log("[v0] Setting showSuccess to true")
      setShowSuccess(true)
      setTimeout(() => {
        console.log("[v0] Hiding success banner")
        setShowSuccess(false)
      }, 3000)
    } catch (error) {
      console.error("Error saving preferences:", error)
      setIsSaving(false)
    }
  }

  useEffect(() => {
    console.log("[v0] showSuccess state changed:", showSuccess)
  }, [showSuccess])

  const prettyRole = profile.role.replace("_", " ")

  return (
    <>
      <Header showLogout />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(130,24,26,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(130,24,26,0.08),_transparent_32%),linear-gradient(to_bottom,_#fff,_#faf7f7_58%,_#f8f4f4)]">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:py-10">
          <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_22px_70px_rgba(130,24,26,0.12)] backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(130,24,26,0.12),_transparent_35%),linear-gradient(135deg,_rgba(255,255,255,0.85),_transparent_46%)]" />
            <div className="relative space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Personal settings
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Settings</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Manage your account profile and privacy preferences in one place.
              </p>
            </div>
          </section>

          <div className="mt-8">
            {showSuccess && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-lg shadow-emerald-100/40 animate-in slide-in-from-top duration-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800 sm:text-base">
                  Preferences saved successfully!
                </p>
              </div>
            )}
          </div>

          <Tabs defaultValue="privacy" className="space-y-6">
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl border border-white/60 bg-white/80 p-1.5 shadow-lg shadow-slate-100/60 backdrop-blur-xl">
              <TabsTrigger value="account" className="rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-slate-50">
                Account Profile
              </TabsTrigger>
              <TabsTrigger value="privacy" className="rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-slate-50">
                Privacy & Consent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-4">
              <Card className="overflow-hidden border border-white/60 bg-gradient-to-br from-white/95 to-white/80 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
                <CardHeader className="border-b border-white/50 bg-gradient-to-r from-slate-50/80 to-white/80">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <CardTitle>Account Profile</CardTitle>
                      <CardDescription>View the account details currently used in the system</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="flex flex-col gap-5 rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 shadow-sm sm:flex-row sm:items-center">
                    <Avatar className="h-20 w-20 shrink-0 ring-4 ring-white shadow-lg shadow-slate-200/60">
                      <AvatarImage src={profile.avatarUrl} alt={profile.name || "User"} referrerPolicy="no-referrer" />
                      <AvatarFallback className="bg-slate-100 text-lg font-semibold text-slate-700">
                        {(profile.name?.[0] || profile.email?.[0] || "U").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Name</p>
                        <p className="mt-1 text-base font-semibold text-foreground">{profile.name || "User"}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            Email
                          </div>
                          <p className="mt-2 truncate text-sm font-medium text-foreground">{profile.email || "Not available"}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                            <BadgeCheck className="h-4 w-4" />
                            Role
                          </div>
                          <p className="mt-2 text-sm font-medium text-foreground capitalize">{prettyRole}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-muted-foreground">
                    This profile information is read from the current login session. If you update your Google account name or photo, sign out and sign back in to refresh it here.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Tab */}
            <TabsContent value="privacy" className="space-y-4">
              <Card className="overflow-hidden border border-primary/30 bg-primary/5 shadow-xl shadow-primary/10">
                <CardHeader className="border-b border-primary/15">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <CardTitle>Consent Status</CardTitle>
                      <CardDescription>Control your participation in the photo system</CardDescription>
                    </div>
                    <div
                      className="rounded-full px-3 py-1 text-sm font-semibold"
                      style={{
                        backgroundColor: consent.globalFaceSearch ? "rgba(130, 24, 26, 0.15)" : "rgba(0, 0, 0, 0.1)",
                        color: consent.globalFaceSearch ? "var(--color-primary)" : "var(--color-muted-foreground)",
                      }}
                    >
                      {consent.globalFaceSearch ? "Opted In" : "Opted Out"}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="rounded-xl border border-border bg-background/80 p-4">
                    <p className="text-sm text-foreground leading-relaxed">
                      {consent.globalFaceSearch
                        ? "You are currently opted in. The system can identify you in photos and send you notifications when new photos are available."
                        : "You are currently opted out. Your face will not be identified in photos and you won't receive notifications."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border border-white/60 bg-gradient-to-br from-white/95 to-white/80 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
                <CardHeader className="border-b border-white/50 bg-gradient-to-r from-slate-50/80 to-white/80">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <CardTitle>Privacy & Consent Preferences</CardTitle>
                      <CardDescription>Control how your data is used for photo discovery</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <PrivacyConsentForm
                    consent={consent}
                    onChange={handleConsentChange}
                    disabled={isSaving}
                  />


                  {/* Privacy Rights Info */}
                  <div className="space-y-3 rounded-xl border border-border/30 bg-muted/50 p-4">
                    <div className="flex gap-3">
                      <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="text-sm space-y-2 text-muted-foreground">
                        <p className="font-semibold text-foreground">Your Privacy Rights</p>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>You can opt-out of face search at any time</li>
                          <li>Request removal or blur of photos featuring you</li>
                          <li>Download or delete your personal data</li>
                          <li>Learn more in our privacy policy</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleSavePreferences}
                    disabled={isSaving}
                    className="w-full rounded-full bg-primary py-6 text-primary-foreground shadow-xl shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-2xl hover:shadow-primary/30"
                    size="lg"
                  >
                    {isSaving ? "Saving..." : "Save Privacy Preferences"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>

        </div>
      </main>
    </>
  )
}
