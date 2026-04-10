"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { apiClient } from "@/lib/api-client"



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
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([])
  // Fetch real events and photos from backend
  const loadData = async (photographerId?: string) => {
    // Fetch events separately so a photo error doesn't wipe the event list
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api'
      const eventsRes = await fetch(`${apiUrl}/events`);
      const eventsData = await eventsRes.json();
      const safeEvents = Array.isArray(eventsData) ? eventsData : [];
      if (!Array.isArray(eventsData)) {
        console.error('Events API returned non-array:', eventsData);
      }
      setEvents(safeEvents);
    } catch (err) {
      console.error('Failed to load events:', err);
      setEvents([]);
    }

    // Fetch this photographer's photos separately
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api'
      // Use /me/my-photos which reads uploaderId from the JWT token
      const photosRes = await fetch(`${apiUrl}/me/my-photos`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
      });
      const photosData = await photosRes.json();

      if (Array.isArray(photosData)) {
        const eventsRes = await fetch(`${apiUrl}/events`);
        const eventsData = await eventsRes.json();
        const safeEvents = Array.isArray(eventsData) ? eventsData : [];

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
      } catch (e) {
        console.error("[v0] Failed to parse user data:", e)
        setPhotographerUser(null)
        loadData();
      }
    } else {
      loadData();
    }

    setIsAuthenticated(true)
    setIsLoading(false)
  }, [router])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setSelectedFiles((prev) => [...prev, ...newFiles])
    }
  }

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setSelectedFiles((prev) => [...prev, ...newFiles])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    const imageFiles = droppedFiles.filter((file) => file.type.startsWith("image/"))
    setSelectedFiles((prev) => [...prev, ...imageFiles])
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
    const uploadPromises = selectedFiles.map(async (file, i) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("eventId", selectedEvent)
      // Attach the photographer's user ID so ownership is tracked
      if (photographerUser?.id) {
        formData.append("uploaderId", photographerUser.id)
      }

      try {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }))

        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            const current = prev[file.name] || 0
            if (current >= 90) {
              clearInterval(progressInterval)
              return prev
            }
            return { ...prev, [file.name]: current + 10 }
          })
        }, 200)

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
        const response = await fetch(`${apiUrl}/photos/upload`, {
          method: "POST",
          body: formData,
        })

        clearInterval(progressInterval)

        if (response.ok) {
          const data = await response.json()
          setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }))

          // No longer updating local state immediately, will refetch all photos
        } else {
          setUploadProgress((prev) => ({ ...prev, [file.name]: -1 }))
        }
      } catch (error) {
        console.error("[v0] Upload error:", error)
        setUploadProgress((prev) => ({ ...prev, [file.name]: -1 }))
      }
    })

    await Promise.all(uploadPromises)
    setIsUploading(false)

    // After all uploads, reload only this photographer's photos
    await loadData(photographerUser?.id);

    setTimeout(() => {
      clearAllFiles()
    }, 2000)
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
      console.log('Photo deleted and data reloaded');
    } catch (error) {
      console.error("[v0] Delete error:", error)
      alert("Failed to delete photo. Please try again.")
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

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
      </>
    )
  }

  if (error || !isAuthenticated) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background flex items-center justify-center px-4">
          <Card className="w-full max-w-md border border-border bg-muted/30 flex-col">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-destructive" />
                Authentication Required
              </CardTitle>
              <CardDescription>You need to be logged in as a photographer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => router.push("/login")} className="w-full bg-primary hover:bg-primary/90">
                Go to Login
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
            <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.9fr] lg:items-end">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Photographer workspace
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    Upload, review, and manage event photos in one polished workflow.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Keep your event uploads organized, monitor processing status, and remove anything you no longer need from a clean, focused dashboard.
                  </p>
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

          <Tabs defaultValue="upload" className="mt-8 w-full">
            <TabsList className="mb-8 grid h-auto w-full grid-cols-2 rounded-2xl border border-white/60 bg-white/80 p-1.5 shadow-lg shadow-slate-100/50 backdrop-blur-xl sm:w-fit">
              <TabsTrigger value="upload" className="rounded-xl px-6 py-3 text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-slate-50">
                Upload Photos
              </TabsTrigger>
              <TabsTrigger value="my-photos" className="rounded-xl px-6 py-3 text-sm font-medium transition-all duration-200 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-slate-50">
                My Uploaded Photos ({uploadedPhotos.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-8">
              <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
                <Card id="upload-panel" className="group overflow-hidden border border-white/60 bg-gradient-to-br from-white/90 to-white/70 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all duration-300 hover:shadow-2xl hover:shadow-slate-300/50">
                  <CardHeader className="space-y-3 border-b border-white/40 bg-gradient-to-r from-slate-50/80 to-white/60 p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shadow-sm">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-light text-slate-900">Upload Setup</CardTitle>
                        <CardDescription className="text-slate-600">Choose the event and prepare your files before sending them to the library.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 p-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-medium text-slate-700">Event Selection</label>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Step 1 of 3</span>
                      </div>
                      <select
                        value={selectedEvent}
                        onChange={(e) => setSelectedEvent(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 shadow-sm outline-none transition-all duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 hover:border-slate-300"                      >
                        <option value="">-- Select an Event --</option>
                        {events.map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-2xl border border-dashed border-slate-300/60 bg-gradient-to-br from-slate-50/50 via-white to-slate-50/30 p-6 transition-all duration-300 hover:border-slate-400/60 hover:shadow-lg hover:shadow-slate-100/50">
                      <div
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-white/60 bg-white/80 px-8 py-10 text-center shadow-inner transition-all duration-200 hover:bg-white/90"
                      >
                        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 shadow-lg">
                          <Upload className="h-8 w-8" />
                        </div>
                        <p className="text-lg font-medium text-slate-900">Drag photos here or click to select</p>
                        <p className="mt-3 max-w-sm text-sm text-slate-600 leading-relaxed">
                          Supports JPG, PNG, HEIC. You can also upload an entire folder to speed up event delivery.
                        </p>
                        <div className="mt-8 flex flex-wrap justify-center gap-4">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="file-input"
                          />
                          <label htmlFor="file-input">
                            <Button className="gap-2 rounded-full px-6 py-3 shadow-lg shadow-slate-200/50 transition-all duration-200 hover:shadow-xl hover:shadow-slate-300/60 hover:-translate-y-0.5" asChild>
                              <span>Select Files</span>
                            </Button>
                          </label>

                          <input
                            type="file"
                            {...({ webkitdirectory: "", directory: "" } as any)}
                            multiple
                            onChange={handleFolderSelect}
                            className="hidden"
                            id="folder-input"
                          />
                          <label htmlFor="folder-input">
                            <Button variant="outline" className="gap-2 rounded-full border-slate-300 px-6 py-3 shadow-lg shadow-slate-200/50 transition-all duration-200 hover:shadow-xl hover:shadow-slate-300/60 hover:-translate-y-0.5 hover:bg-slate-50" asChild>
                              <span className="flex items-center gap-2">
                                <FolderUp className="h-4 w-4" />
                                Select Folder
                              </span>
                            </Button>
                          </label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="group overflow-hidden border border-white/60 bg-gradient-to-br from-white/90 to-white/70 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all duration-300 hover:shadow-2xl hover:shadow-slate-300/50">
                  <CardHeader className="space-y-3 border-b border-white/40 bg-gradient-to-r from-slate-50/80 to-white/60 p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shadow-sm">
                        <Images className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-light text-slate-900">Selected Files</CardTitle>
                        <CardDescription className="text-slate-600">Review the queue before upload. Files are tracked individually for progress and errors.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 p-6">
                    {selectedFiles.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/60 bg-slate-50/50 px-5 py-4 shadow-sm">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{selectedFiles.length} files queued</p>
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
                              <div key={index} className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all duration-200 hover:border-slate-300/60 hover:shadow-md">
                                <div className="flex items-start gap-4">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shadow-sm">
                                    <ImageIcon className="h-6 w-6" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                                        <p className="mt-1 text-xs text-slate-600">{formatFileSize(file.size)}</p>
                                      </div>
                                      <div className="flex items-center gap-3">
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
                      <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/60 bg-slate-50/30 px-8 py-12 text-center">
                        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-lg">
                          <FolderOpen className="h-7 w-7" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">No files selected yet</h3>
                        <p className="mt-3 max-w-sm text-sm text-slate-600 leading-relaxed">
                          Choose a folder or individual images to build your upload queue. Progress will appear here once files are added.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-white/60 bg-gradient-to-br from-white/90 to-white/70 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
                <CardContent className="flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-base font-medium text-slate-900">Ready to publish your selected photos?</p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Make sure an event is selected before uploading. The button below will send every queued file.
                    </p>
                  </div>
                  <Button
                    onClick={handleBatchUpload}
                    disabled={isUploading || selectedFiles.length === 0 || !selectedEvent}
                    className="gap-3 rounded-full px-8 py-4 text-base font-medium shadow-xl shadow-slate-900/20 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-900/30 hover:-translate-y-1"
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
            </TabsContent>

            <TabsContent value="my-photos" className="space-y-8">
              <div className="flex items-end justify-between gap-6">
                <div className="space-y-2">
                  <h2 className="text-3xl font-light tracking-tight text-slate-900">My Uploaded Photos</h2>
                  <p className="text-lg text-slate-600 leading-relaxed">View and manage your uploaded event photos from a curated gallery view.</p>
                </div>
                <div className="hidden sm:flex items-center gap-3 rounded-full border border-slate-200/60 bg-white/80 px-5 py-3 text-sm text-slate-700 shadow-lg shadow-slate-100/50 backdrop-blur">
                  <Images className="h-5 w-5 text-slate-600" />
                  <span className="font-medium">{uploadedPhotos.length} photos in library</span>
                </div>
              </div>

              <div id="photo-library" className="grid gap-6 xl:grid-cols-2">
                {uploadedPhotos.map((photo) => {
                  const statusDisplay = getStatusDisplay(photo.status)
                  return (
                    <Card key={photo.id} className="group overflow-hidden border border-white/60 bg-gradient-to-br from-white/95 to-white/80 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-slate-300/60 hover:shadow-2xl hover:shadow-slate-300/60">
                      <CardContent className="p-0">
                        <div className="grid gap-0 md:grid-cols-[260px_1fr]">
                          <div className="relative min-h-[240px] bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
                            <img
                              src={photo.thumbnail || "/placeholder.svg"}
                              alt={photo.filename}
                              className="h-full w-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-1"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
                              <Badge variant={statusDisplay.variant} className="flex items-center gap-2 rounded-full border border-white/20 bg-white/90 px-4 py-2 text-xs font-medium text-slate-900 shadow-lg backdrop-blur-xl">
                                {statusDisplay.icon}
                                {statusDisplay.label}
                              </Badge>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleDeletePhoto(photo.id)}
                                className="h-10 w-10 rounded-full bg-white/90 p-0 text-slate-700 shadow-lg backdrop-blur-xl transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:scale-110"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="flex min-w-0 flex-col justify-between p-6">
                            <div className="space-y-5">
                              <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Filename</p>
                                <h3 className="truncate text-xl font-light text-slate-900 leading-tight">{photo.filename}</h3>
                                <p className="text-sm font-medium text-slate-700">{photo.eventName}</p>
                              </div>

                              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 shadow-inner">
                                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Uploaded</span>
                                  <p className="mt-2 text-sm font-medium text-slate-900">{new Date(photo.uploadDate).toLocaleDateString()}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 shadow-inner">
                                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dimensions</span>
                                  <p className="mt-2 text-sm font-medium text-slate-900">{photo.size}</p>
                                </div>
                              </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-200/60 pt-5">
                              <span className="text-xs text-slate-500">Captured: {photo.metadata.datetime}</span>
                              <Button variant="ghost" size="sm" onClick={() => handleDeletePhoto(photo.id)} className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100/60 hover:text-red-600 transition-all duration-200">
                                <Trash className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {uploadedPhotos.length === 0 && (
                <Card className="border-dashed border-slate-300/60 bg-gradient-to-br from-white/90 to-white/70 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
                  <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 shadow-lg">
                      <ImageIcon className="h-9 w-9" />
                    </div>
                    <h3 className="text-xl font-light text-slate-900">No photos uploaded yet</h3>
                    <p className="mt-3 max-w-md text-base text-slate-600 leading-relaxed">
                      Start by uploading photos from the Upload tab. Your curated gallery will appear here once files are processed.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  )
}
