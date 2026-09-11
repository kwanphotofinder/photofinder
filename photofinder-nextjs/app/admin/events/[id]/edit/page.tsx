"use client"

import type React from "react"

import { useRouter, useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, ArrowLeft, Loader, Pencil } from "lucide-react"
import { apiClient } from "@/lib/api-client"

interface EventData {
    name: string
    date: string
    status: "DRAFT" | "PUBLISHED"
}

export default function EditEventPage() {
    const router = useRouter()
    const params = useParams()
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        date: "",
        status: "DRAFT" as "DRAFT" | "PUBLISHED" | "ARCHIVED",
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

        const fetchEvent = async () => {
            try {
                const response = await apiClient.getEvent(params.id as string)
                if (response.data) {
                    const eventData = response.data as EventData
                    setFormData({
                        name: eventData.name,
                        date: new Date(eventData.date).toISOString().split('T')[0],
                        status: eventData.status,
                    })
                } else {
                    setError("Event not found")
                }
            } catch (err) {
                setError("Failed to fetch event")
            } finally {
                setIsLoading(false)
            }
        }

        fetchEvent()
    }, [router, params.id])

    const handleInputChange = (field: string, value: string | boolean) => {
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

            // Call API to update event
            const response = await apiClient.updateEvent(params.id as string, {
                name: formData.name.trim(),
                date: new Date(formData.date).toISOString(),
                status: formData.status,
            })

            if (response.error) {
                setError(response.error || "Failed to update event")
                setIsSubmitting(false)
                return
            }

            // Success - redirect to dashboard
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
                            <Pencil className="h-3.5 w-3.5" />
                            Event Update
                        </div>
                        <h1 className="text-3xl font-bold text-foreground">Edit Event</h1>
                        <p className="text-muted-foreground mt-2">Update event details</p>
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
                            <CardDescription>Update the information for this event</CardDescription>
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
                                                Saving...
                                            </>
                                        ) : (
                                            "Save Changes"
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
