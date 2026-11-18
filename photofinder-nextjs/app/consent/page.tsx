"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Shield, Lock } from "lucide-react"
import { PrivacyConsentForm, type ConsentData } from "@/components/privacy-consent-form"
import { apiClient } from "@/lib/api-client"
import { useLanguage } from "@/lib/language-context"

export default function ConsentPage() {
  const router = useRouter()
  const { lang, setLang, t } = useLanguage()
  
  useEffect(() => {
    const isPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "true"
    if (isPreview) return

    const authToken = localStorage.getItem("auth_token")
    const userRole = localStorage.getItem("user_role")

    if (!authToken) {
      router.push("/login")
      return
    }

    if (userRole === "photographer") {
      router.push("/photographer")
      return
    } else if (userRole === "admin" || userRole === "super_admin") {
      router.push("/admin/dashboard")
      return
    }
  }, [router])

  const [isLoading, setIsLoading] = useState(false)
  const [consent, setConsent] = useState<ConsentData>({
    globalFaceSearch: false,
    dataProcessing: false,
  })
  const [error, setError] = useState<string | null>(null)

  const handleConsent = async (accepted: boolean) => {
    setIsLoading(true)
    setError(null)

    const isPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "true"
    if (isPreview) {
      setTimeout(() => {
        setIsLoading(false)
        if (accepted) {
          router.push("/dashboard")
        } else {
          router.push("/consent/minimal")
        }
      }, 500)
      return
    }

    try {
      const consentRes = await apiClient.updateMyConsent(accepted)
      if (consentRes.error) {
        throw new Error(consentRes.error)
      }

      localStorage.setItem(
        "consent_preferences",
        JSON.stringify({
          ...consent,
          accepted,
          timestamp: new Date().toISOString(),
        }),
      )

      if (accepted) {
        router.push("/dashboard")
      } else {
        router.push("/consent/minimal")
      }
    } catch (err) {
      setError(t("consent.save_error"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleConsentChange = (key: keyof ConsentData) => {
    setConsent((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 sm:p-8 relative"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="w-full max-w-2xl relative z-10">
        <Card className="border border-border/50 shadow-2xl bg-card/80 backdrop-blur-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-500 relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
          
          {/* Language Switcher */}
          <div className="absolute top-4 right-4 z-20">
            <div className="flex items-center overflow-hidden rounded-md border border-border/60 bg-background/80 shadow-xs backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setLang("th")}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  lang === "th"
                    ? "bg-primary text-white shadow-inner"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                title="ภาษาไทย"
              >
                TH
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  lang === "en"
                    ? "bg-primary text-white shadow-inner"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                title="English"
              >
                EN
              </button>
            </div>
          </div>

          <CardHeader className="space-y-4 pb-6 pt-10 text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center rounded-2xl shadow-sm border border-primary/20">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
                {t("consent.title")}
              </CardTitle>
              <CardDescription className="text-sm sm:text-base max-w-md mx-auto">
                {t("consent.desc")}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-8 px-6 sm:px-10 pb-10">
            {error && (
              <div className="flex gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}

            <div className="bg-background/50 rounded-xl p-2 sm:p-4 border border-border/50 shadow-sm">
              <PrivacyConsentForm
                consent={consent}
                onChange={handleConsentChange}
                disabled={isLoading}
              />
            </div>

            {/* Privacy Rights Info */}
            <div className="space-y-3 p-5 bg-primary/5 rounded-xl border border-primary/10">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-4 h-4 text-primary" />
                </div>
                <div className="text-sm space-y-2 text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    {t("consent.guarantee_title")}
                  </p>
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>{t("consent.guarantee_item1")}</li>
                    <li>{t("consent.guarantee_item2")}</li>
                    <li>{t("consent.guarantee_item3")}</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4 pt-2 mt-4 border-t border-border/40">
              <Button
                onClick={() => handleConsent(true)}
                disabled={isLoading || !consent.globalFaceSearch || !consent.dataProcessing}
                className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 py-6 text-base sm:text-lg font-semibold hover:scale-[1.01]"
                size="lg"
              >
                {isLoading ? t("consent.processing") : t("consent.accept_btn")}
              </Button>
              <Button
                onClick={() => handleConsent(false)}
                disabled={isLoading}
                variant="outline"
                className="w-full py-6 text-base sm:text-lg font-semibold border-2"
                size="lg"
              >
                {t("consent.decline_btn")}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {t("consent.terms_prefix")}{" "}
                <a href="/privacy" className="text-primary hover:underline font-medium">
                  {t("consent.privacy_policy_link")}
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
