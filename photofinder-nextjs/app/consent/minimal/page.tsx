"use client"

import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Info } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

export default function MinimalConsentPage() {
  const router = useRouter()
  const { t } = useLanguage()

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-background to-secondary/5 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-2xl">{t("consent.minimal.title")}</CardTitle>
              <CardDescription>{t("consent.minimal.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-3 p-4 bg-muted/50 border border-border/30 rounded-lg">
                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-2">
                  <p className="font-semibold text-foreground">{t("consent.minimal.access_title")}</p>
                  <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                    <li>{t("consent.minimal.access_item1")}</li>
                    <li>{t("consent.minimal.access_item2")}</li>
                    <li>{t("consent.minimal.access_item3")}</li>
                    <li>{t("consent.minimal.access_item4")}</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t("consent.minimal.note")}
                </p>
              </div>

              <Button
                onClick={() => router.push("/dashboard")}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6"
                size="lg"
              >
                {t("consent.minimal.continue_btn")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
