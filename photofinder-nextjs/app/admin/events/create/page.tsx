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
import { AlertCircle, ArrowLeft, Loader, CalendarDays } from "lucide-react"
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
    if (!adminToken) {
      router.push("/login")
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
      <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(130,24,26,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(130,24,26,0.08),transparent_36%),linear-gradient(to_bottom,rgba(255,255,255,0.98),rgba(248,250,252,1))]">
        <div className="pointer-events-none absolute -left-12 top-10 h-64 w-64 rounded-full bg-[#82181a]/12 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-40 h-72 w-72 rounded-full bg-[#a8252d]/10 blur-3xl" />

        <div className="relative max-w-2xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8 rounded-2xl border border-border/70 bg-card/80 px-5 py-5 shadow-sm backdrop-blur-md sm:px-6">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <CalendarDays className="h-3.5 w-3.5" />
              Event Setup
            </div>
            <h1 className="text-3xl font-bold text-foreground">Create New Event</h1>
            <p className="text-muted-foreground mt-2">Set up a new campus event for photo uploads and face search</p>
          </div>

          {/* Error Alert */}
          {error && (
            <Card className="border border-destructive/30 bg-destructive/5 mb-6">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Error</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form Card */}
          <Card className="border border-border/70 bg-card/85 shadow-sm backdrop-blur-md">
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
              <CardDescription>Configure the basic information for this event</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Event Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground font-medium">
                    Event Name *
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="e.g., Spring Orientation 2024"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="border-border"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">Give your event a descriptive name</p>
                </div>

                {/* Event Date */}
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-foreground font-medium">
                    Event Date *
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    className="border-border"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">The date when this event occurs</p>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-foreground font-medium">
                    Event Status
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange("status", value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="PUBLISHED">Published</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Draft: Not visible | Published: Visible to users
                  </p>
                </div>

                {/* Expiry Settings */}
                <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="space-y-1">
                    <Label className="text-foreground font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-primary" />
                      Auto-Deletion Timer
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      For privacy compliance, events and their photos will be automatically deleted after this many days.
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    {[7, 14, 30].map((days) => (
                      <Button
                        key={days}
                        type="button"
                        variant={formData.expiryDays === days ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => handleInputChange("expiryDays", days)}
                      >
                        {days} Days
                      </Button>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Label htmlFor="customDays" className="text-sm whitespace-nowrap">Custom Days:</Label>
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
                      className="w-24 border-border"
                      disabled={isSubmitting}
                    />
                    <span className="text-xs text-muted-foreground">(Max 30 days)</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                    className="flex-1 border-border"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-[#82181a] to-[#a8252d] text-primary-foreground shadow-sm shadow-[#82181a]/30 hover:from-[#82181a]/90 hover:to-[#a8252d]/90"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Event"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="mt-6 border border-primary/20 bg-primary/5 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">What happens next?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>✓ Event will appear in your event console</p>
              <p>✓ Photographers can start uploading photos</p>
              <p>✓ Students can opt-in and search for themselves</p>
              <p>✓ Analytics will track engagement and metrics</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
