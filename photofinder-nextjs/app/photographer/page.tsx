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
  Images,
  FolderOpen,
  ArrowUpRight,
  Album,
  BarChart3,
  Download,
  Eye,
  CalendarDays,
  User,
  Search,
  RefreshCw,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api-client"
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useLanguage } from "@/lib/language-context"

export default function PhotographerPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedPhotos, setUploadedPhotos] = useState<any[]>([])
  const [manageSearchQuery, setManageSearchQuery] = useState("")
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

      if (eventsRes.ok) {
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
      }
    } catch (err) {
      // Ignore network errors in dev mode
    }

    // Fallback events in development mode if none available
    if (safeEvents.length === 0 && process.env.NODE_ENV === 'development') {
      safeEvents = [
        { id: "sample-event-1", name: "พิธีพระราชทานปริญญาบัตร มฟล. (Sample Event)" },
        { id: "sample-event-2", name: "กิจกรรมวันไหว้ครู มหาวิทยาลัยแม่ฟ้าหลวง" },
        { id: "sample-event-3", name: "MFU Lamduan Games กีฬาสถาบัน" },
      ]
    }
    setEvents(safeEvents)

    // Fetch this photographer's photos separately
    try {
      // Use /me/my-photos which reads uploaderId from the JWT token
      const photosRes = await fetch(`${apiUrl}/me/my-photos`, {
        headers: authHeaders,
      })

      if (photosRes.ok) {
        const photosData = await photosRes.json().catch(() => [])

        if (Array.isArray(photosData)) {
          const transformedPhotos = photosData.map((photo: any) => {
            const event = safeEvents.find((e: any) => e.id === photo.eventId);
            const dimensions = photo.width && photo.height ? `${photo.width} × ${photo.height}` : 'N/A';
            return {
              id: photo.id,
              filename: photo.storageUrl?.split('/').pop() || 'photo.jpg',
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
          return;
        }
      }

      // If response is not ok or not array (e.g. dev mock session or empty db)
      if (process.env.NODE_ENV === 'development') {
        setUploadedPhotos([
          {
            id: "sample-p1",
            filename: "DSC_0012.JPG",
            eventName: safeEvents[0]?.name || "พิธีพระราชทานปริญญาบัตร มฟล.",
            uploadDate: new Date().toISOString(),
            status: "completed",
            size: "4000 × 3000",
            thumbnail: "/Logo2.png",
          },
          {
            id: "sample-p2",
            filename: "DSC_0015.JPG",
            eventName: safeEvents[0]?.name || "พิธีพระราชทานปริญญาบัตร มฟล.",
            uploadDate: new Date().toISOString(),
            status: "processing",
            size: "4000 × 3000",
            thumbnail: "/Logo2.png",
          },
        ]);
      } else {
        setUploadedPhotos([]);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        setUploadedPhotos([]);
      } else {
        setUploadedPhotos([]);
      }
    }
  };

  const loadPhotographerAnalytics = async () => {
    try {
      setAnalyticsLoading(true)
      setAnalyticsError(null)
      const result = await apiClient.getPhotographerAnalytics()

      if (result.data && !result.error) {
        setAnalyticsData(result.data)
      } else if (process.env.NODE_ENV === 'development') {
        // Fallback realistic sample analytics for development testing
        setAnalyticsData({
          totals: { events: events.length || 3, photos: 124, views: 1850, downloads: 420 },
          dailyStats: [
            { day: "2026-09-05", views: 120, downloads: 35 },
            { day: "2026-09-06", views: 190, downloads: 45 },
            { day: "2026-09-07", views: 250, downloads: 70 },
            { day: "2026-09-08", views: 310, downloads: 85 },
            { day: "2026-09-09", views: 420, downloads: 110 },
            { day: "2026-09-10", views: 280, downloads: 55 },
            { day: "2026-09-11", views: 280, downloads: 60 },
          ],
          eventStats: [
            {
              eventId: "sample-event-1",
              eventName: "พิธีพระราชทานปริญญาบัตร มฟล.",
              eventDate: "2026-09-10",
              photoCount: 84,
              views: 1250,
              downloads: 310,
            },
            {
              eventId: "sample-event-2",
              eventName: "กิจกรรมวันไหว้ครู มหาวิทยาลัยแม่ฟ้าหลวง",
              eventDate: "2026-09-08",
              photoCount: 40,
              views: 600,
              downloads: 110,
            },
          ],
        })
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        setAnalyticsError(null)
      } else {
        setAnalyticsError("Unable to load engagement analytics right now.")
      }
    } finally {
      setAnalyticsLoading(false)
    }
  }

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

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api'
        
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
        return { icon: <CheckCircle className="w-3 h-3" />, variant: "default" as const, label: t("photo.status.completed") }
      case "processing":
        return { icon: <Clock className="w-3 h-3" />, variant: "secondary" as const, label: t("photo.status.processing") }
      case "failed":
        return { icon: <XCircle className="w-3 h-3" />, variant: "destructive" as const, label: t("photo.status.failed") }
      default:
        return { icon: <Clock className="w-3 h-3" />, variant: "outline" as const, label: t("photo.status.pending") }
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

  const filteredUploadedPhotos = useMemo(() => {
    if (!manageSearchQuery.trim()) return uploadedPhotos;
    const q = manageSearchQuery.toLowerCase();
    return uploadedPhotos.filter((p) =>
      (p.filename || "").toLowerCase().includes(q) ||
      (p.eventName || "").toLowerCase().includes(q)
    );
  }, [uploadedPhotos, manageSearchQuery]);

  if (isLoading) {
    return (
      <>
        <Header userRole="photographer" />
        <main className="min-h-screen bg-[#f0f2f5] flex items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4 rounded border border-slate-200 bg-white px-8 py-10 text-center shadow-2xs">
            <Loader2 className="w-8 h-8 text-[#82181a] animate-spin" />
            <div>
              <p className="text-sm font-bold text-slate-800">{t("photo.loading.title")}</p>
              <p className="mt-1 text-xs text-slate-500">{t("photo.loading.subtitle")}</p>
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
        <main className="min-h-screen bg-[#f0f2f5] flex items-center justify-center px-4">
          <Card className="w-full max-w-md border border-slate-200 bg-white shadow-2xs rounded">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                <AlertCircle className="w-5 h-5 text-red-600" />
                {t("photo.auth.title")}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {t("photo.auth.desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-600">{error || "Authentication required"}</p>
              <Button onClick={() => router.push("/login")} className="w-full bg-[#82181a] hover:bg-[#9c1f22] text-white text-xs font-semibold rounded">
                {t("photo.auth.signin")}
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-[#f0f2f5] pb-16">
        <Header showLogout userRole="photographer" />

        {/* Academic Workspace Header Banner */}
        <div className="bg-white border-b border-slate-200 shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-1.5 bg-[#82181a] rounded-xs"></div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t("photo.title")}</h1>
                    <span className="text-[11px] font-bold tracking-wider uppercase text-[#82181a] bg-[#82181a]/10 px-2 py-0.5 rounded">
                      {t("photo.workspace_badge")}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    {t("photo.subtitle")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push("/photographer/profile")}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm rounded h-9 px-3.5 bg-white shadow-2xs"
                >
                  <User className="mr-1.5 h-4 w-4 text-slate-500" />
                  {t("photo.profile.title")}
                </Button>
              </div>
            </div>

            {/* 4 Summary Metric Cards (REG MFU Style with Top Border Stripe) */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
              <div className="bg-white rounded border border-slate-200 border-t-4 border-t-[#82181a] p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>{t("photo.analytics.metric.events")}</span>
                  <div className="w-8 h-8 rounded bg-[#82181a]/10 flex items-center justify-center text-[#82181a]">
                    <Album className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">{events.length}</div>
                <p className="text-[11px] text-slate-400 mt-1">{events.length > 0 ? t("photo.metric.ready") : t("photo.metric.no_events")}</p>
              </div>

              <div className="bg-white rounded border border-slate-200 border-t-4 border-t-[#82181a] p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>{t("photo.upload.selected_summary")}</span>
                  <div className="w-8 h-8 rounded bg-[#82181a]/10 flex items-center justify-center text-[#82181a]">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">{selectedFiles.length}</div>
                <p className="text-[11px] text-slate-400 mt-1">{selectedFiles.length > 0 ? `${activeUploads} ${t("photo.metric.processing")}` : t("photo.metric.no_files_queue")}</p>
              </div>

              <div className="bg-white rounded border border-slate-200 border-t-4 border-t-[#82181a] p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>{t("photo.analytics.metric.photos")}</span>
                  <div className="w-8 h-8 rounded bg-[#82181a]/10 flex items-center justify-center text-[#82181a]">
                    <Images className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">{uploadedPhotos.length}</div>
                <p className="text-[11px] text-slate-400 mt-1">{t("photo.manage.total_photos")}</p>
              </div>

              <div className="bg-white rounded border border-slate-200 border-t-4 border-t-[#82181a] p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>{t("photo.analytics.metric.views")}</span>
                  <div className="w-8 h-8 rounded bg-[#82181a]/10 flex items-center justify-center text-[#82181a]">
                    <Eye className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">{analyticsData.totals.views.toLocaleString()}</div>
                <p className="text-[11px] text-slate-400 mt-1">{t("photo.analytics.metric.downloads")}: {analyticsData.totals.downloads.toLocaleString()}</p>
              </div>
            </div>

            {/* Academic Workspace Tabs */}
            <div className="flex items-center gap-2 mt-6 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab("upload")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                  activeWorkspaceTab === "upload"
                    ? "border-[#82181a] text-[#82181a] bg-slate-50"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50/60"
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>{t("photo.tab.upload")}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab("manage_uploads")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                  activeWorkspaceTab === "manage_uploads"
                    ? "border-[#82181a] text-[#82181a] bg-slate-50"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50/60"
                }`}
              >
                <Images className="w-4 h-4" />
                <span>{t("photo.tab.manage")}</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-bold">
                  {uploadedPhotos.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab("analytics")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                  activeWorkspaceTab === "analytics"
                    ? "border-[#82181a] text-[#82181a] bg-slate-50"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50/60"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>{t("photo.tab.analytics")}</span>
              </button>
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          {/* TAB 1: UPLOAD WORKFLOW */}
          {activeWorkspaceTab === "upload" && (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Step 1 & 2: Event Selection and Dropzone */}
                <div className="space-y-6">
                  {/* Step 1 Card */}
                  <div className="bg-white border border-slate-200 rounded p-6 shadow-2xs">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{t("photo.upload.step1_title")}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{t("photo.upload.step1_desc")}</p>
                      </div>
                      <span className="text-[10px] font-bold text-[#82181a] bg-[#82181a]/10 px-2 py-0.5 rounded uppercase tracking-wider">
                        {t("photo.step1_badge")}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                        <SelectTrigger className="w-full bg-white border-slate-300 text-xs sm:text-sm rounded h-10">
                          <SelectValue placeholder={t("photo.upload.select_placeholder")} />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200">
                          {events.map((event) => (
                            <SelectItem key={event.id} value={event.id} className="text-xs sm:text-sm">
                              {event.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-slate-500">
                        {selectedEventName
                          ? `${t("photo.upload.event_selected_prefix")} "${selectedEventName}"`
                          : t("photo.upload.event_select_prompt")}
                      </p>
                    </div>
                  </div>

                  {/* Step 2 Card: Dropzone */}
                  <div className="bg-white border border-slate-200 rounded p-6 shadow-2xs">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{t("photo.upload.step2_title")}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{t("photo.upload.step2_desc")}</p>
                      </div>
                      <span className="text-[10px] font-bold text-[#82181a] bg-[#82181a]/10 px-2 py-0.5 rounded uppercase tracking-wider">
                        {t("photo.step2_badge")}
                      </span>
                    </div>

                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className="border-2 border-dashed border-slate-300 hover:border-[#82181a] rounded p-8 text-center bg-slate-50/50 hover:bg-[#82181a]/5 transition-colors cursor-pointer"
                    >
                      <div className="w-12 h-12 mx-auto rounded-full bg-[#82181a]/10 text-[#82181a] flex items-center justify-center mb-3">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">{t("photo.upload.dropzone_text")}</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{t("photo.upload.dropzone_subtext")}</p>

                      <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                        <input
                          type="file"
                          multiple
                          accept="image/*,.heic,.HEIC"
                          onChange={handleFileSelect}
                          className="hidden"
                          id="file-input"
                        />
                        <label htmlFor="file-input">
                          <Button className="bg-[#82181a] hover:bg-[#9c1f22] text-white text-xs font-semibold rounded h-9 px-4 cursor-pointer" asChild>
                            <span className="flex items-center gap-1.5">
                              <Upload className="w-3.5 h-3.5" />
                              {t("photo.upload.btn_select_files")}
                            </span>
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
                          <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded h-9 px-4 cursor-pointer bg-white" asChild>
                            <span className="flex items-center gap-1.5">
                              <FolderUp className="w-3.5 h-3.5" />
                              {t("photo.upload.btn_select_folder")}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Card: Staged Queue & Upload Status */}
                <div className="bg-white border border-slate-200 rounded p-6 shadow-2xs flex flex-col h-full">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{t("photo.upload.step3_title")}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedFiles.length > 0 ? `${selectedFiles.length} ${t("photo.upload.files_in_queue")}` : t("photo.upload.no_files")}
                      </p>
                    </div>
                    {selectedFiles.length > 0 && !isUploading && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFiles}
                        className="text-xs text-red-600 hover:bg-red-50 h-8 px-2"
                      >
                        <Trash className="w-3.5 h-3.5 mr-1" />
                        {t("photo.upload.clear_all")}
                      </Button>
                    )}
                  </div>

                  {selectedFiles.length > 0 ? (
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px] pr-1">
                      {selectedFiles.map((file, index) => {
                        const progress = uploadProgress[file.name]
                        const hasError = progress === -1
                        const isComplete = progress === 100

                        return (
                          <div key={index} className="border border-slate-200 rounded p-3 bg-slate-50/50 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center shrink-0 text-slate-600">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-800 truncate">{file.name}</p>
                                <p className="text-[11px] text-slate-400">{formatFileSize(file.size)}</p>
                                {progress !== undefined && (
                                  <Progress value={hasError ? 100 : progress} className={`h-1.5 mt-1.5 ${hasError ? "bg-red-100 [&>div]:bg-red-500" : "[&>div]:bg-[#82181a]"}`} />
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {hasError && <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">{uploadErrors[file.name] || "Failed"}</span>}
                              {isComplete && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                              {!isUploading && !isComplete && !hasError && (
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  className="text-slate-400 hover:text-red-600 p-1"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded">
                      <FolderOpen className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-600">{t("photo.upload.no_files")}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t("photo.upload.queue_empty_guide")}</p>
                    </div>
                  )}

                  {/* Primary Batch Upload Button */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-500">
                      {selectedEvent ? `${t("photo.upload.event_label")} ${selectedEventName}` : t("photo.upload.no_event_selected")}
                    </span>
                    <Button
                      onClick={handleBatchUpload}
                      disabled={isUploading || selectedFiles.length === 0 || !selectedEvent}
                      className="bg-[#82181a] hover:bg-[#9c1f22] text-white text-xs sm:text-sm font-semibold rounded h-10 px-6 shadow-2xs"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t("photo.upload.uploading")}
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          {t("photo.upload.btn_upload")} ({selectedFiles.length})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Match Notification Action Banner */}
              <div className="bg-white border border-slate-200 rounded p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <h4 className="text-sm font-bold text-slate-900">{t("photo.upload.btn_notify")}</h4>
                  </div>
                  <p className="text-xs text-slate-500 max-w-xl">
                    {t("photo.upload.notify_desc")}
                  </p>
                </div>
                <div className="flex flex-col sm:items-end gap-2">
                  <Button
                    onClick={handleNotifyMatches}
                    disabled={isNotifying || !selectedEvent || uploadedPhotos.length === 0}
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-semibold rounded h-9 px-4 bg-white"
                  >
                    {isNotifying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        {t("photo.upload.notifying")}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                        {t("photo.upload.btn_notify")}
                      </>
                    )}
                  </Button>
                  {notifyStatus && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${notifyStatus.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                      {notifyStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGE UPLOADS */}
          {activeWorkspaceTab === "manage_uploads" && (
            <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{t("photo.manage.title")}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t("photo.manage.desc")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={t("photo.manage.search_placeholder")}
                      value={manageSearchQuery}
                      onChange={(e) => setManageSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:border-[#82181a]"
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
                    {filteredUploadedPhotos.length} {t("photo.manage.total_photos")}
                  </span>
                </div>
              </div>

              {filteredUploadedPhotos.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <FolderOpen className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">{t("photo.manage.empty")}</p>
                  <p className="text-xs text-slate-400 mt-1">{t("photo.manage.empty_guide")}</p>
                </div>
              ) : (
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredUploadedPhotos.map((photo) => (
                    <div key={photo.id} className="border border-slate-200 rounded bg-white overflow-hidden shadow-2xs hover:border-[#82181a]/50 transition-colors flex flex-col">
                      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-100">
                        <img
                          src={photo.thumbnail}
                          alt={photo.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-xs px-2 py-1 rounded text-white">
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="text-white hover:text-red-400 p-0.5"
                            title={t("photo.manage.delete")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                        <div>
                          <p className="text-xs font-bold text-slate-800 truncate" title={photo.filename}>
                            {photo.filename}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                            <span className="truncate max-w-[120px]">{photo.eventName}</span>
                            <span>{new Date(photo.uploadDate).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <Badge variant={getStatusDisplay(photo.status).variant} className="gap-1 shadow-none text-[10px] font-medium">
                            {getStatusDisplay(photo.status).icon}
                            {getStatusDisplay(photo.status).label}
                          </Badge>

                          {photo.status === "failed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetryFailed(photo.id)}
                              className="h-6 px-2 text-[10px] text-amber-700 border-amber-300 hover:bg-amber-50"
                            >
                              <RefreshCw className="w-2.5 h-2.5 mr-1" />
                              {t("photo.manage.retry")}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ANALYTICS & TRENDS */}
          {activeWorkspaceTab === "analytics" && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded p-6 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 mb-6 border-b border-slate-200 gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{t("photo.analytics.chart_title")}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{t("photo.analytics.chart_desc")}</p>
                  </div>
                  <div className="flex items-center gap-1 border border-slate-200 rounded p-0.5 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setTrendDays(7)}
                      className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                        trendDays === 7 ? "bg-[#82181a] text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {t("photo.analytics.7days")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendDays(14)}
                      className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                        trendDays === 14 ? "bg-[#82181a] text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {t("photo.analytics.14days")}
                    </button>
                  </div>
                </div>

                {analyticsLoading ? (
                  <div className="py-20 text-center">
                    <Loader2 className="w-8 h-8 mx-auto text-[#82181a] animate-spin mb-2" />
                    <p className="text-xs text-slate-500">{t("photo.analytics.loading")}</p>
                  </div>
                ) : analyticsError ? (
                  <div className="p-4 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                    {analyticsError}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 mb-6">
                      <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                        <span className="text-[11px] font-semibold text-slate-500">{t("photo.analytics.views_label")} (Peak)</span>
                        <p className="text-lg font-bold text-[#82181a] mt-0.5">{peakDailyViews.toLocaleString()}</p>
                      </div>
                      <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                        <span className="text-[11px] font-semibold text-slate-500">{t("photo.analytics.downloads_label")} (Peak)</span>
                        <p className="text-lg font-bold text-[#c59b27] mt-0.5">{peakDailyDownloads.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="h-72 w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
                          <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "4px",
                              border: "1px solid #cbd5e1",
                              fontSize: "12px",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                          <Line
                            type="monotone"
                            dataKey="views"
                            name={t("photo.analytics.views_label")}
                            stroke="#82181a"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: "#82181a" }}
                            activeDot={{ r: 5 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="downloads"
                            name={t("photo.analytics.downloads_label")}
                            stroke="#c59b27"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: "#c59b27" }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>

              {/* Per-Event Performance Breakdown Table */}
              <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {t("photo.analytics.event_stats_title")}
                  </h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/40 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">{t("photo.analytics.col_event")}</th>
                        <th className="py-3 px-4 text-center">{t("events.col.date")}</th>
                        <th className="py-3 px-4 text-right">{t("photo.analytics.col_photos")}</th>
                        <th className="py-3 px-4 text-right">{t("photo.analytics.col_views")}</th>
                        <th className="py-3 px-4 text-right">{t("photo.analytics.col_downloads")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analyticsData.eventStats.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                            {t("photo.analytics.empty_events")}
                          </td>
                        </tr>
                      ) : (
                        analyticsData.eventStats.map((event) => (
                          <tr key={event.eventId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900">{event.eventName}</td>
                            <td className="py-3 px-4 text-center text-slate-500">
                              {new Date(event.eventDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-slate-700">{event.photoCount}</td>
                            <td className="py-3 px-4 text-right font-bold text-[#82181a]">{event.views.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-bold text-[#c59b27]">{event.downloads.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
