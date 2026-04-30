"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { convertHeicToJpeg } from "@/lib/heic-converter"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertCircle,
  Upload,
  Loader2,
  ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
  FolderUp,
  Trash2,
  Trash,
  Sparkles,
  Images,
  FolderOpen,
  ArrowUpRight,
  Album,
  BarChart3,
  Download,
  Eye,
  CalendarDays,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api-client"
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"



export default function PhotographerPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedPhotos, setUploadedPhotos] = useState<any[]>([])
  const [photographerUser, setPhotographerUser] = useState<{
    name: string
    email: string
    id: string
    avatarUrl?: string
  } | null>(null)

  const [selectedEvent, setSelectedEvent] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [analyticsData, setAnalyticsData] = useState<{
    totals: { events: number; photos: number; views: number; downloads: number }
    dailyStats: Array<{
      day: string
      views: number
      downloads: number
    }>
    eventStats: Array<{
      eventId: string
      eventName: string
      eventDate: string
      photoCount: number
      views: number
      downloads: number
    }>
  }>({
    totals: { events: 0, photos: 0, views: 0, downloads: 0 },
    dailyStats: [],
    eventStats: [],
  })
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"analytics" | "upload" | "manage_uploads">("upload")
  const [trendDays, setTrendDays] = useState<7 | 14>(14)
  const [isNotifying, setIsNotifying] = useState(false)
  const [notifyStatus, setNotifyStatus] = useState<string | null>(null)
  
  useEffect(() => {
    // Silently wake up the AI service in the background
    fetch('/api/ai-health').catch(() => {})
  }, [])
  
  // Fetch real events and photos from backend
  const loadData = async (photographerId?: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api'
    const authToken = localStorage.getItem('auth_token') || ''
    const authHeaders: HeadersInit = authToken
      ? { Authorization: `Bearer ${authToken}` }
      : {}

    let safeEvents: Array<{ id: string; name: string }> = []

    // Fetch events separately so a photo error doesn't wipe the event list
    try {
      const eventsRes = await fetch(`${apiUrl}/events`, {
        headers: authHeaders,
      })

      const eventsData = await eventsRes.json().catch(() => null)
      const eventsPayload = Array.isArray(eventsData)
        ? eventsData
        : Array.isArray((eventsData as { events?: unknown[] } | null)?.events)
          ? ((eventsData as { events: unknown[] }).events as any[])
          : []

      safeEvents = eventsPayload.map((event: any) => ({
        id: String(event.id ?? ''),
        name: String(event.name ?? 'Untitled Event'),
      }))

      if (!eventsRes.ok) {
        console.warn('Failed to load events:', eventsData)
      }

      setEvents(safeEvents)
    } catch (err) {
      console.error('Failed to load events:', err)
      setEvents([])
    }

    // Fetch this photographer's photos separately
    try {
      // Use /me/my-photos which reads uploaderId from the JWT token
      const photosRes = await fetch(`${apiUrl}/me/my-photos`, {
        headers: authHeaders,
      })
      const photosData = await photosRes.json()

      if (Array.isArray(photosData)) {
        const transformedPhotos = photosData.map((photo: any) => {
          const event = safeEvents.find((e: any) => e.id === photo.eventId);
          const dimensions = photo.width && photo.height ? `${photo.width} × ${photo.height}` : 'N/A';
          return {
            id: photo.id,
            filename: photo.storageUrl.split('/').pop() || 'unknown',
            eventName: event?.name || photo.event?.name || 'Unknown Event',
            uploadDate: photo.createdAt,
            status: photo.processingStatus?.toLowerCase() || 'pending',
            size: dimensions,
            thumbnail: photo.storageUrl,
            metadata: {
              datetime: photo.createdAt,
            },
          };
        });

        // Remove duplicates by ID
        const uniquePhotos = Array.from(
          new Map(transformedPhotos.map((p: any) => [p.id, p])).values()
        );

        setUploadedPhotos(uniquePhotos);
      } else {
        console.error('Photos API returned non-array:', photosData);
        setUploadedPhotos([]);
      }
    } catch (err) {
      console.error('Failed to load photos:', err);
      setUploadedPhotos([]);
    }
  };

  const loadPhotographerAnalytics = async () => {
    try {
      setAnalyticsLoading(true)
      setAnalyticsError(null)
      const result = await apiClient.getPhotographerAnalytics()

      if (result.error) {
        throw new Error(result.error)
      }

      if (result.data) {
        setAnalyticsData(result.data)
      }
    } catch (err) {
      console.error("Failed to load photographer analytics:", err)
      setAnalyticsError("Unable to load engagement analytics right now.")
    } finally {
      setAnalyticsLoading(false)
    }
  }

  useEffect(() => {
    const userRole = localStorage.getItem("user_role")
    const authToken = localStorage.getItem("auth_token")
    const userData = localStorage.getItem("user_data")

    if (!authToken || userRole !== "photographer") {
      setError("You must be logged in as a photographer to access this page.")
      setIsLoading(false)
      setTimeout(() => {
        router.push("/login")
      }, 2000)
      return
    }

    if (userData) {
      try {
        const parsed = JSON.parse(userData)
        setPhotographerUser({
          id: parsed.id || "",
          name: parsed.name || localStorage.getItem("user_name") || "Photographer",
          email: parsed.email || localStorage.getItem("user_email") || "",
          avatarUrl: parsed.avatarUrl || parsed.picture || "",
        })
        // Load only this photographer's data
        loadData(parsed.id);
        loadPhotographerAnalytics();
      } catch (e) {
        console.error("[v0] Failed to parse user data:", e)
        setPhotographerUser(null)
        loadData();
        loadPhotographerAnalytics();
      }
    } else {
      loadData();
      loadPhotographerAnalytics();
    }

    setIsAuthenticated(true)
    setIsLoading(false)
  }, [router])

  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

  const filterValidFiles = (files: File[]) => {
    const valid: File[] = [];
    const oversized: string[] = [];
    
    for (const file of files) {
      const isHeic = file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");
      if (!file.type.startsWith("image/") && !isHeic) continue;
      
      if (file.size > MAX_FILE_SIZE) {
        oversized.push(file.name);
      } else {
        valid.push(file);
      }
    }
    
    if (oversized.length > 0) {
      alert(`The following files were skipped because they exceed the 15MB limit:\n${oversized.slice(0, 5).join('\n')}${oversized.length > 5 ? '\n...and more' : ''}`);
    }
    
    return valid;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = filterValidFiles(Array.from(e.target.files))
      setSelectedFiles((prev) => [...prev, ...newFiles])
    }
  }

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = filterValidFiles(Array.from(e.target.files))
      setSelectedFiles((prev) => [...prev, ...newFiles])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    const validFiles = filterValidFiles(droppedFiles)
    setSelectedFiles((prev) => [...prev, ...validFiles])
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearAllFiles = () => {
    setSelectedFiles([])
    setUploadProgress({})
  }

  const handleBatchUpload = async () => {
    if (!selectedEvent) {
      alert("Please select an event first")
      return
    }
    if (selectedFiles.length === 0) {
      alert("Please select files to upload")
      return
    }

    setIsUploading(true)
    
    // Upload files sequentially to avoid overwhelming Vercel's concurrent functions limit (10 limit on Hobby)
    for (let i = 0; i < selectedFiles.length; i++) {
      const rawFile = selectedFiles[i];
      
      try {
        setUploadProgress((prev) => ({ ...prev, [rawFile.name]: 0 }))
        setUploadErrors((prev) => { const next = {...prev}; delete next[rawFile.name]; return next; })

        // Convert HEIC to JPEG if needed
        const file = await convertHeicToJpeg(rawFile);

        const formData = new FormData()
        formData.append("file", file)
        formData.append("eventId", selectedEvent)
        // Attach the photographer's user ID so ownership is tracked
        if (photographerUser?.id) {
          formData.append("uploaderId", photographerUser.id)
        }

        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            const current = prev[rawFile.name] || 0
            if (current >= 90) {
              clearInterval(progressInterval)
              return prev
            }
            return { ...prev, [rawFile.name]: current + 10 }
          })
        }, 200)

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
        
        // Add auth header since the route is now protected
        const headers: HeadersInit = {}
        const token = localStorage.getItem('auth_token')
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(`${apiUrl}/photos/upload`, {
          method: "POST",
          headers,
          body: formData,
        })

        clearInterval(progressInterval)

        if (response.ok) {
          setUploadProgress((prev) => ({ ...prev, [rawFile.name]: 100 }))
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))
          setUploadProgress((prev) => ({ ...prev, [rawFile.name]: -1 }))
          setUploadErrors((prev) => ({ ...prev, [rawFile.name]: errorData.error || 'Failed' }))
        }
      } catch (error) {
        console.error("[v0] Upload error:", error)
        setUploadProgress((prev) => ({ ...prev, [rawFile.name]: -1 }))
        setUploadErrors((prev) => ({ ...prev, [rawFile.name]: 'Network error' }))
      }
    }

    setIsUploading(false)

    // After all uploads, reload only this photographer's photos
    await loadData(photographerUser?.id);
    await loadPhotographerAnalytics();

    setTimeout(() => {
      clearAllFiles()
    }, 2000)
  }

  const handleNotifyMatches = async () => {
    if (!selectedEvent) return
    setIsNotifying(true)
    setNotifyStatus(null)
    try {
      const authToken = localStorage.getItem('auth_token')
      const response = await fetch(`/api/events/${selectedEvent}/notify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      })
      const data = await response.json()
      if (response.ok) {
        setNotifyStatus(`Success: Notified ${data.notified} user(s).`)
        setTimeout(() => setNotifyStatus(null), 5000)
      } else {
        setNotifyStatus(`Error: ${data.error || 'Failed to send notifications'}`)
      }
    } catch (err) {
      setNotifyStatus("Error: Network failure")
    } finally {
      setIsNotifying(false)
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this photo? This action cannot be undone.")) {
      return
    }

    try {
      console.log('Deleting photo:', photoId);
      const response = await apiClient.deletePhoto(photoId);
      console.log('Delete response:', response);

      if (response.error) {
        throw new Error(response.error)
      }

      // Reload data from server to ensure sync
      await loadData();
      await loadPhotographerAnalytics();
      console.log('Photo deleted and data reloaded');
    } catch (error) {
      console.error("[v0] Delete error:", error)
      alert("Failed to delete photo. Please try again.")
    }
  }

  const handleRetryFailed = async (photoId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api'
      const response = await fetch(`${apiUrl}/photos/${photoId}/retry`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
      })
      if (!response.ok) throw new Error("Retry failed")
      alert("Photo AI processing restared successfully. It will now show as PROCESSING.")
      loadData(photographerUser?.id)
    } catch (err) {
      alert("Failed to retry photo processing.")
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "completed":
      case "processed":
        return { icon: <CheckCircle className="w-3 h-3" />, variant: "default" as const, label: "Completed" }
      case "processing":
        return { icon: <Clock className="w-3 h-3" />, variant: "secondary" as const, label: "Processing" }
      case "failed":
        return { icon: <XCircle className="w-3 h-3" />, variant: "destructive" as const, label: "Failed" }
      default:
        return { icon: <Clock className="w-3 h-3" />, variant: "outline" as const, label: "Pending" }
    }
  }

  const activeUploads = Object.values(uploadProgress).filter((value) => value > 0 && value < 100).length
  const completedUploads = Object.values(uploadProgress).filter((value) => value === 100).length
  const hasUploadStarted = activeUploads > 0 || completedUploads > 0

  const uploadSteps = [
    {
      label: "Choose Event",
      done: Boolean(selectedEvent),
      helper: selectedEvent ? "Event selected" : "Pick where photos will go",
    },
    {
      label: "Add Files",
      done: selectedFiles.length > 0,
      helper: selectedFiles.length > 0 ? `${selectedFiles.length} files ready` : "Drag or select photos",
    },
    {
      label: "Start Upload",
      done: hasUploadStarted,
      helper: hasUploadStarted ? "Upload in progress or completed" : "Click Upload Photos",
    },
  ]

  const trendChartData = useMemo(() => {
    return analyticsData.dailyStats.slice(-trendDays).map((point) => {
      const [year, month, day] = point.day.split("-").map(Number)
      const displayDate = new Date(year, month - 1, day)

      return {
        ...point,
        label: displayDate.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      }
    })
  }, [analyticsData.dailyStats, trendDays])

  const peakDailyViews = trendChartData.reduce((max, item) => Math.max(max, item.views), 0)
  const peakDailyDownloads = trendChartData.reduce((max, item) => Math.max(max, item.downloads), 0)
  const selectedEventName = useMemo(() => {
    return events.find((event) => event.id === selectedEvent)?.name || ""
  }, [events, selectedEvent])

  if (isLoading) {
    return (
      <>
        <Header userRole="photographer" />
        <main className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-border/60 bg-card/80 px-8 py-10 text-center shadow-sm backdrop-blur">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <div>
              <p className="text-base font-medium text-foreground">Loading your photographer workspace</p>
              <p className="mt-1 text-sm text-muted-foreground">Preparing events, uploads, and analytics.</p>
            </div>
          </div>
        </main>
      </>
    )
  }

  if (error || !isAuthenticated) {
    return (
      <>
        <Header userRole="photographer" />
        <main className="min-h-screen bg-background flex items-center justify-center px-4">
          <Card className="w-full max-w-md border border-border/60 bg-card/90 shadow-lg backdrop-blur flex-col">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-destructive" />
                Photographer access required
              </CardTitle>
              <CardDescription>Sign in with a photographer account to upload and manage event photos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => router.push("/login")} className="w-full bg-primary hover:bg-primary/90">
                Go to sign in
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(130,24,26,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(130,24,26,0.08),_transparent_22%),linear-gradient(to_bottom,_#fff,_#faf7f7_58%,_#f8f5f5)]">
        <div className="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur-xl shadow-sm">
          <Header showLogout userRole="photographer" />
        </div>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/90 p-6 shadow-[0_20px_60px_rgba(130,24,26,0.08)] backdrop-blur">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(130,24,26,0.12),_transparent_34%),linear-gradient(135deg,_rgba(255,255,255,0.6),_transparent_45%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Photographer workspace
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    A simpler way to upload, review, and manage event photos.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Pick an event, add your files, and keep track of progress in one place. The page shows only the details you need to finish the upload quickly.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">1. Choose event</p>
                    <p className="mt-2 text-sm text-foreground">Start with the event that needs new photos.</p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">2. Add files</p>
                    <p className="mt-2 text-sm text-foreground">Drag images in or select a whole folder.</p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">3. Upload</p>
                    <p className="mt-2 text-sm text-foreground">Review the queue and send everything at once.</p>
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <Card className="border-border/60 bg-white/80 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs uppercase tracking-wide">Events</span>
                      <Album className="h-4 w-4" />
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-foreground">{events.length}</div>
                    <p className="mt-1 text-xs text-muted-foreground">Available to upload</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-white/80 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs uppercase tracking-wide">Selected</span>
                      <FolderOpen className="h-4 w-4" />
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-foreground">{selectedFiles.length}</div>
                    <p className="mt-1 text-xs text-muted-foreground">Ready to upload</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-white/80 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs uppercase tracking-wide">Library</span>
                      <Images className="h-4 w-4" />
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-foreground">{uploadedPhotos.length}</div>
                    <p className="mt-1 text-xs text-muted-foreground">Uploaded photos</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-white/80 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs uppercase tracking-wide">Active</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-foreground">{activeUploads}</div>
                    <p className="mt-1 text-xs text-muted-foreground">In progress</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <div className="mt-10 rounded-3xl border border-white/70 bg-gradient-to-br from-white/90 via-white/80 to-rose-50/30 p-4 shadow-lg shadow-slate-200/40 backdrop-blur sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Workspace Mode</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{activeWorkspaceTab === "upload" ? "Upload mode" : activeWorkspaceTab === "analytics" ? "Analytics mode" : "Manage Photos"}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {activeWorkspaceTab === "upload"
                    ? "Choose an event, stage your files, and upload when the queue looks right."
                    : activeWorkspaceTab === "analytics"
                    ? "Review trends and top-performing events from a single focused view."
                    : "View, manage, and monitor the processing status of all your uploaded event photos."}
                </p>
              </div>
              <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab("upload")}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    activeWorkspaceTab === "upload"
                      ? "bg-slate-900 text-white shadow"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Upload Workflow
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab("analytics")}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    activeWorkspaceTab === "analytics"
                      ? "bg-slate-900 text-white shadow"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab("manage_uploads")}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    activeWorkspaceTab === "manage_uploads"
                      ? "bg-slate-900 text-white shadow"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Images className="h-4 w-4" />
                  Manage Photos
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Queued files</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{selectedFiles.length.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Recent views</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{analyticsData.totals.views.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Recent downloads</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{analyticsData.totals.downloads.toLocaleString()}</p>
              </div>
            </div>

            {activeWorkspaceTab === "upload" ? (
              <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/90 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Quick Upload Guide</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {uploadSteps.map((step) => (
                    <div
                      key={step.label}
                      className={`rounded-xl border px-3 py-2.5 ${
                        step.done ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-slate-50/80"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {step.done ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-slate-400" />
                        )}
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">{step.label}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{step.helper}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeWorkspaceTab === "analytics" ? (
              <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/90 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Analytics Tips</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Trend View</p>
                    <p className="mt-1 text-xs text-slate-600">Switch between 7 and 14 days to spot short-term vs weekly behavior.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Peak Signals</p>
                    <p className="mt-1 text-xs text-slate-600">Use peak views/downloads to identify the best publishing times.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Event Matrix</p>
                    <p className="mt-1 text-xs text-slate-600">Compare engagement rate to decide which events deserve more uploads.</p>
                  </div>
                </div>
              </div>
            ) : activeWorkspaceTab === "manage_uploads" ? (
              <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/90 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Photo Management Tips</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Check Status</p>
                    <p className="mt-1 text-xs text-slate-600">Photos will show as 'Processing' until the AI has finished indexing faces and features.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Retry Processing</p>
                    <p className="mt-1 text-xs text-slate-600">If a photo shows as 'Failed', use the retry button to run it through the AI engine again.</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-8 grid gap-10 xl:grid-cols-[0.9fr_1.1fr]">
            {activeWorkspaceTab === "analytics" && (
            <Card className="group relative overflow-hidden border-none bg-white/40 shadow-2xl shadow-slate-200/40 backdrop-blur-2xl xl:col-span-2 transition-all duration-500 hover:shadow-primary/5">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
              <CardHeader className="relative space-y-4 border-b border-white/40 bg-white/20 p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-5">
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                      <BarChart3 className="h-7 w-7" />
                      <div className="absolute -right-1 -top-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-white/20 border border-white/50"></span>
                      </div>
                    </div>
                    <div>
                      <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">Engagement Dashboard</CardTitle>
                      <CardDescription className="text-sm font-medium text-slate-600 mt-1">Real-time audience interaction metrics for your photography.</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-start sm:self-center">
                    <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50/80 px-4 py-2">
                      <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                      <span className="text-[10px] font-bold text-green-700 uppercase tracking-[0.2em]">Active Analytics</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative p-8 sm:p-10 space-y-12">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Total Events", value: analyticsData.totals.events, icon: Album, color: "bg-indigo-500", light: "bg-indigo-50" },
                    { label: "Photo Assets", value: analyticsData.totals.photos, icon: Images, color: "bg-blue-500", light: "bg-blue-50" },
                    { label: "Content Views", value: analyticsData.totals.views, icon: Eye, color: "bg-amber-500", light: "bg-amber-50" },
                    { label: "Acquisitions", value: analyticsData.totals.downloads, icon: Download, color: "bg-rose-500", light: "bg-rose-50" }
                  ].map((stat, i) => (
                    <div key={i} className="group/stat relative overflow-hidden rounded-3xl border border-white/60 bg-white/60 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/20">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2.5 rounded-2xl ${stat.light} transition-colors group-hover/stat:bg-white`}>
                          <stat.icon className={`h-6 w-6 text-slate-700 transition-transform group-hover/stat:scale-110`} />
                        </div>
                        <div className={`h-1.5 w-8 rounded-full ${stat.color} opacity-20`} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                        <h3 className="text-4xl font-extrabold tracking-tighter text-slate-900">
                          {stat.value.toLocaleString()}
                        </h3>
                      </div>
                    </div>
                  ))}
                </div>

                {analyticsLoading ? (
                  <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-slate-200 bg-white/40 py-24 shadow-inner">
                    <div className="relative h-12 w-12">
                      <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                    </div>
                    <p className="mt-6 text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">Synchronizing performance data...</p>
                  </div>
                ) : analyticsError ? (
                  <div className="rounded-[2rem] border border-red-100 bg-red-50/50 p-8 text-sm text-red-600 flex items-center gap-4 justify-center">
                    <AlertCircle className="h-6 w-6 animate-bounce" />
                    <span className="font-bold uppercase tracking-tight">{analyticsError}</span>
                  </div>
                ) : analyticsData.eventStats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-slate-200 bg-white/40 py-24 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-xl text-slate-300 mb-6 group-hover:rotate-12 transition-transform duration-500">
                      <BarChart3 className="h-10 w-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">Awaiting Interaction</h3>
                    <p className="mt-3 text-sm text-slate-500 max-w-xs font-medium">
                      Engagement data will populate here as soon as visitors begin browsing your event photography.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-xl shadow-slate-200/20 sm:p-7">
                      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-500">Daily Engagement Trend</h3>
                          <p className="mt-1 text-sm text-slate-500">Track audience behavior over the last 7 or 14 days.</p>
                        </div>
                        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                          <button
                            type="button"
                            onClick={() => setTrendDays(7)}
                            className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-wide transition ${
                              trendDays === 7
                                ? "bg-white text-slate-900 shadow"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            7 Days
                          </button>
                          <button
                            type="button"
                            onClick={() => setTrendDays(14)}
                            className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-wide transition ${
                              trendDays === 14
                                ? "bg-white text-slate-900 shadow"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            14 Days
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Range
                          </div>
                          <p className="mt-2 text-lg font-bold text-slate-900">Last {trendDays} days</p>
                        </div>
                        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Peak Daily Views</p>
                          <p className="mt-2 text-lg font-bold text-amber-900">{peakDailyViews.toLocaleString()}</p>
                        </div>
                        <div className="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-700">Peak Daily Downloads</p>
                          <p className="mt-2 text-lg font-bold text-rose-900">{peakDailyDownloads.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="mt-6 h-72 rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/40 p-3 sm:p-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                            <Tooltip
                              contentStyle={{
                                borderRadius: "14px",
                                border: "1px solid #e2e8f0",
                                boxShadow: "0 16px 40px rgba(15, 23, 42, 0.12)",
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "12px" }} />
                            <Line
                              type="monotone"
                              dataKey="views"
                              name="Views"
                              stroke="#f59e0b"
                              strokeWidth={3}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="downloads"
                              name="Downloads"
                              stroke="#f43f5e"
                              strokeWidth={3}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-2">
                       <h3 className="text-sm font-black uppercase tracking-[0.25em] text-slate-400">Event Performance Matrix</h3>
                       <div className="h-px flex-1 mx-6 bg-gradient-to-r from-slate-200 to-transparent" />
                    </div>
                    <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-2xl shadow-slate-200/30">
                      <div className="grid grid-cols-12 gap-4 border-b border-slate-100 bg-slate-50/50 px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <div className="col-span-5">Digital Collection</div>
                        <div className="col-span-2 text-right">Assets</div>
                        <div className="col-span-2 text-right">Views</div>
                        <div className="col-span-3 text-right">Engagement Rate</div>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {analyticsData.eventStats.slice(0, 8).map((event) => {
                          const engagementRate = event.views > 0 ? ((event.downloads / event.views) * 100).toFixed(1) : "0.0";
                          const isHighEngagement = parseFloat(engagementRate) >= 15;
                          return (
                            <div key={event.eventId} className="grid grid-cols-12 gap-4 items-center px-8 py-6 transition-all duration-300 hover:bg-primary/[0.02] hover:translate-x-1 group/row">
                              <div className="col-span-5 min-w-0">
                                <p className="truncate text-base font-bold text-slate-900 group-hover/row:text-primary transition-colors">{event.eventName}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{new Date(event.eventDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric'})}</p>
                              </div>
                              <div className="col-span-2 text-right">
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100/50 px-3 py-1.5 text-xs font-bold text-slate-700 border border-white">
                                  {event.photoCount}
                                </span>
                              </div>
                              <div className="col-span-2 text-right font-black text-slate-900 tracking-tight">{event.views.toLocaleString()}</div>
                              <div className="col-span-3 flex items-center justify-end gap-6 text-right">
                                <div className="text-base font-black text-slate-900 tracking-tighter">{event.downloads.toLocaleString()}</div>
                                <div className="w-20 text-right">
                                  <div className={`text-[10px] font-black px-2 py-1 rounded-full border shadow-sm transition-all ${
                                    isHighEngagement 
                                      ? 'bg-green-500 text-white border-green-400 shadow-green-100' 
                                      : 'bg-white text-slate-600 border-slate-200'
                                  }`}>
                                    {engagementRate}% 
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {activeWorkspaceTab === "upload" && (
            <>
            <Card id="upload-panel" className="group relative overflow-hidden border-none bg-white/45 shadow-2xl shadow-slate-200/40 backdrop-blur-2xl transition-all duration-500 hover:shadow-primary/5">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-primary/[0.04]" />
              <CardHeader className="relative space-y-3 border-b border-white/50 bg-white/25 p-8">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                    <Upload className="h-5 w-5" />
                    <div className="absolute -right-1 -top-1 flex h-4 w-4">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-40"></span>
                      <span className="relative inline-flex h-4 w-4 rounded-full border border-white/50 bg-white/20"></span>
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Upload your event photos</CardTitle>
                    <CardDescription className="text-sm font-medium text-slate-600">Choose an event first so the upload stays organized and easy to find later.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-6 p-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-slate-700">Event selection</label>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">Step 1 of 3</span>
                  </div>
                  <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                    <SelectTrigger className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-sm outline-none transition-all duration-200 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 hover:border-slate-300">
                      <SelectValue placeholder="-- Select an event --" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-slate-200 bg-white shadow-lg">
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id} className="cursor-pointer">
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    {selectedEventName ? `Files will be uploaded to ${selectedEventName}.` : "Pick the event that matches the photos you are uploading."}
                  </p>
                </div>

                <div className="rounded-[1.75rem] border border-dashed border-slate-300/60 bg-gradient-to-br from-slate-50/50 via-white to-slate-50/30 p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-slate-100/50">
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="flex min-h-[260px] flex-col items-center justify-center rounded-[1.5rem] border border-white/70 bg-white/85 px-8 py-10 text-center shadow-inner transition-all duration-200 hover:bg-white/95"
                  >
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/10">
                      <Upload className="h-8 w-8" />
                    </div>
                    <p className="text-lg font-medium text-slate-900">Drag photos here or click to choose files</p>
                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
                      Supports JPG, PNG, HEIC. You can also upload a whole folder when you have a full event batch.
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                      <input
                        type="file"
                        multiple
                        accept="image/*,.heic,.HEIC"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-input"
                      />
                      <label htmlFor="file-input">
                        <Button className="gap-2 rounded-full px-6 py-3 shadow-lg shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30" asChild>
                          <span>Select files</span>
                        </Button>
                      </label>

                      <input
                        type="file"
                        {...({ webkitdirectory: "", directory: "" } as any)}
                        multiple
                        accept="image/*,.heic,.HEIC"
                        onChange={handleFolderSelect}
                        className="hidden"
                        id="folder-input"
                      />
                      <label htmlFor="folder-input">
                        <Button variant="outline" className="gap-2 rounded-full border-slate-300 bg-white px-6 py-3 shadow-lg shadow-slate-200/50 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-xl hover:shadow-slate-300/60" asChild>
                          <span className="flex items-center gap-2">
                            <FolderUp className="h-4 w-4" />
                            Select folder
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-none bg-white/45 shadow-2xl shadow-slate-200/40 backdrop-blur-2xl transition-all duration-500 hover:shadow-primary/5">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-primary/[0.03]" />
              <CardHeader className="relative space-y-3 border-b border-white/50 bg-white/25 p-8">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3">
                    <Images className="h-5 w-5" />
                    <div className="absolute -right-1 -top-1 flex h-4 w-4">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-30"></span>
                      <span className="relative inline-flex h-4 w-4 rounded-full border border-white/50 bg-white/20"></span>
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">File queue</CardTitle>
                    <CardDescription className="text-sm font-medium text-slate-600">Review every file before upload. Progress and errors are shown clearly in one place.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-5 p-8">
                {selectedFiles.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/70 bg-white/80 px-5 py-4 shadow-sm">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{selectedFiles.length} files ready</p>
                        <p className="text-xs text-slate-600">{activeUploads} currently uploading</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={clearAllFiles} className="rounded-full text-slate-700 hover:bg-slate-200/60 hover:text-slate-900">
                        <Trash className="mr-2 h-4 w-4" />
                        Clear All
                      </Button>
                    </div>

                    <div className="max-h-[32rem] space-y-4 overflow-y-auto pr-2">
                      {selectedFiles.map((file, index) => {
                        const progress = uploadProgress[file.name]
                        const hasError = progress === -1
                        const isComplete = progress === 100

                        return (
                          <div key={index} className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                                <ImageIcon className="h-6 w-6" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                                    <p className="mt-1 text-xs text-slate-600">{formatFileSize(file.size)}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {hasError && <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-500">{uploadErrors[file.name] || "Failed"}</span>}
                                    {isComplete && <CheckCircle className="h-5 w-5 text-green-600" />}
                                    {hasError && <XCircle className="h-5 w-5 text-red-500" />}
                                    {!isUploading && !isComplete && !hasError && (
                                      <Button variant="ghost" size="sm" onClick={() => removeFile(index)} className="h-9 w-9 rounded-full p-0 text-slate-500 hover:bg-slate-200/60 hover:text-slate-700">
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                {progress !== undefined && (
                                  <Progress value={hasError ? 100 : progress} className={`mt-4 h-2 shadow-inner ${hasError ? "bg-red-100" : ""}`} />
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-slate-300/60 bg-white/70 px-8 py-12 text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/10">
                      <FolderOpen className="h-7 w-7" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No files selected yet</h3>
                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
                      Choose a folder or individual images to build your queue. Progress appears here as soon as files are added.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-none bg-white/45 shadow-2xl shadow-slate-200/40 backdrop-blur-2xl xl:col-span-2">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-primary/[0.03]" />
              <CardContent className="relative flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <p className="text-base font-semibold text-slate-900">Ready to upload your selected photos?</p>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Make sure an event is selected before uploading. The button below sends every queued file in one batch.
                  </p>
                </div>
                <Button
                  onClick={handleBatchUpload}
                  disabled={isUploading || selectedFiles.length === 0 || !selectedEvent}
                  className="gap-3 rounded-full px-8 py-4 text-base font-semibold shadow-xl shadow-primary/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/35"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Uploading {selectedFiles.length} photos...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      Upload {selectedFiles.length > 0 ? `${selectedFiles.length} ` : ""}Photos
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Batch Notification Action Card */}
            <Card className="relative overflow-hidden border-none bg-gradient-to-br from-blue-600/90 to-indigo-700/90 text-white shadow-2xl shadow-blue-200/40 backdrop-blur-2xl xl:col-span-2">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.15),_transparent_40%)]" />
              <CardContent className="relative flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-200" />
                    <p className="text-lg font-bold">Finish & Notify Users</p>
                  </div>
                  <p className="text-sm leading-relaxed text-blue-100 max-w-md">
                    Done uploading? Click this to send out summarized notifications to all users who have matches in this event.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <Button
                    onClick={handleNotifyMatches}
                    disabled={isNotifying || !selectedEvent || uploadedPhotos.length === 0}
                    className="gap-3 rounded-full bg-white text-blue-700 px-8 py-4 text-base font-bold shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-blue-50 hover:text-blue-800"
                  >
                    {isNotifying ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Notifying Users...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Finish & Notify
                      </>
                    )}
                  </Button>
                  {notifyStatus && (
                    <p className={`text-xs font-semibold px-3 py-1 rounded-full ${notifyStatus.startsWith('Error') ? 'bg-red-500/20 text-red-100' : 'bg-green-500/20 text-green-100'}`}>
                      {notifyStatus}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
            </>
            )}

            {activeWorkspaceTab === "manage_uploads" && (
            <Card className="group relative overflow-hidden border-none bg-white/45 shadow-2xl shadow-slate-200/40 backdrop-blur-2xl transition-all duration-500 hover:shadow-primary/5 xl:col-span-2">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-primary/[0.04]" />
              <CardHeader className="relative space-y-3 border-b border-white/50 bg-white/25 p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3">
                      <Images className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Photo Library</CardTitle>
                      <CardDescription className="text-sm font-medium text-slate-600">Review, retry, or delete your uploaded assets.</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2">
                    <span className="text-sm font-bold text-slate-700">{uploadedPhotos.length} Total</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative p-8">
                {uploadedPhotos.length === 0 ? (
                  <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-slate-300/60 bg-white/70 px-8 py-12 text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/10">
                      <FolderOpen className="h-7 w-7" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Your library is empty</h3>
                    <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
                      You haven't uploaded any photos yet. Switch to the Upload Workflow to get started.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {uploadedPhotos.map((photo) => (
                      <div key={photo.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-primary/30">
                        <div className="group/image relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                          <img
                            src={photo.thumbnail}
                            alt={photo.filename}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover/image:scale-105"
                            loading="lazy"
                          />
                          {/* Hover Overlay for Actions */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:bg-none md:bg-black/40 opacity-100 md:opacity-0 transition-opacity duration-200 group-hover/image:opacity-100 flex items-end justify-end md:items-center md:justify-center gap-2 md:gap-3 p-3 md:p-0">
                            {photo.status === 'failed' && (
                              <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full bg-white/90 hover:bg-white text-amber-600 shadow-lg transition-transform hover:scale-110" onClick={() => handleRetryFailed(photo.id)} title="Retry AI Processing">
                                <Clock className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="icon" variant="destructive" className="h-9 w-9 rounded-full shadow-lg transition-transform hover:scale-110" onClick={() => handleDeletePhoto(photo.id)} title="Delete Photo">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="p-4">
                          <p className="truncate text-sm font-semibold text-slate-900" title={photo.filename}>
                            {photo.filename}
                          </p>
                          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                            <span className="truncate max-w-[120px]">{photo.eventName}</span>
                            <span>{new Date(photo.uploadDate).toLocaleDateString()}</span>
                          </div>
                          
                          <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100">
                            <Badge variant={getStatusDisplay(photo.status).variant} className="gap-1 shadow-none font-medium capitalize text-[10px]">
                              {getStatusDisplay(photo.status).icon}
                              {getStatusDisplay(photo.status).label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
