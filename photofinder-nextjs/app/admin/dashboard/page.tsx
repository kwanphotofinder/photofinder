"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useMemo } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Search, Plus, Calendar, Image as ImageIcon, Trash2, BarChart3, Users, Bell, Shield, AlertCircle, CheckCircle2, Pencil, UserPlus, Crown, Camera, Inbox, Ban, Unlock, UserMinus, ChevronDown, Loader2 } from "lucide-react"
import { SystemHealth } from "@/components/system-health"
import { apiClient } from "@/lib/api-client"

export default function AdminDashboardPage() {
  const router = useRouter()
  const [adminName, setAdminName] = useState("")
  const [events, setEvents] = useState<any[]>([])
  const [photos, setPhotos] = useState<any[]>([])
  const [removalRequests, setRemovalRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [eventSearch, setEventSearch] = useState("")
  const [photoSearch, setPhotoSearch] = useState("")
  const [lowConfidencePhotos, setLowConfidencePhotos] = useState<any[]>([])
  const [lowConfidenceThreshold, setLowConfidenceThreshold] = useState(0.65)
  const [lowConfidenceSearch, setLowConfidenceSearch] = useState("")
  const [lowConfidenceLoading, setLowConfidenceLoading] = useState(false)
  const [selectedLowConfidencePhoto, setSelectedLowConfidencePhoto] = useState<any | null>(null)
  const [isLowConfidenceModalOpen, setIsLowConfidenceModalOpen] = useState(false)

  // User management state
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [userSearchQuery, setUserSearchQuery] = useState("")
  const [callerRole, setCallerRole] = useState("")
  const [callerEmail, setCallerEmail] = useState("")
  const [newPhotographerEmail, setNewPhotographerEmail] = useState("")
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [userMgmtLoading, setUserMgmtLoading] = useState(false)
  const [userMgmtMessage, setUserMgmtMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [requestProcessingId, setRequestProcessingId] = useState<string | null>(null)

  const filteredAndSortedUsers = useMemo(() => {
    let result = allUsers
    if (userSearchQuery.trim()) {
      const lowerQuery = userSearchQuery.toLowerCase()
      result = result.filter(
        (u) =>
          (u.name?.toLowerCase() || "").includes(lowerQuery) ||
          u.email.toLowerCase().includes(lowerQuery)
      )
    }

    // Sort: SUPER_ADMIN first, then ADMIN, then others. Original order otherwise.
    return result.sort((a, b) => {
      const getRank = (role: string) => {
        if (role === "SUPER_ADMIN") return 1
        if (role === "ADMIN") return 2
        return 3
      }
      return getRank(a.role) - getRank(b.role)
    })
  }, [allUsers, userSearchQuery])

  const filteredLowConfidencePhotos = useMemo(() => {
    const q = lowConfidenceSearch.trim().toLowerCase()
    return lowConfidencePhotos.filter((photo) => {
      if (!q) return true

      return (
        (photo.eventName || "").toLowerCase().includes(q) ||
        (photo.storageUrl || "").toLowerCase().includes(q)
      )
    })
  }, [lowConfidencePhotos, lowConfidenceSearch])

  const unresolvedLowConfidenceCount = useMemo(() => {
    return lowConfidencePhotos.length
  }, [lowConfidencePhotos])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("dev") === "true" || (!localStorage.getItem("admin_token") && process.env.NODE_ENV === "development")) {
        if (!localStorage.getItem("admin_token")) {
          localStorage.setItem("admin_token", "dev_admin_token");
          localStorage.setItem("user_role", "admin");
          localStorage.setItem("admin_name", "เจ้าหน้าที่ทะเบียน มฟล.");
          localStorage.setItem("user_email", "reg.admin@mfu.ac.th");
        }
      }
    }

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

    const storedName = localStorage.getItem("admin_name")
    if (storedName) {
      setAdminName(storedName)
    }

    const fetchData = async () => {
      try {
        const [eventsRes, photosRes, requestsRes, lowConfidenceRes] = await Promise.all([
          apiClient.getEvents(),
          apiClient.getAllPhotos(),
          apiClient.getRemovalRequests(),
          apiClient.getLowConfidencePhotos(lowConfidenceThreshold),
        ])

        if (eventsRes.data && Array.isArray(eventsRes.data)) {
          setEvents(eventsRes.data)
        }
        if (photosRes.data && Array.isArray(photosRes.data)) {
          setPhotos(photosRes.data)
        }
        if (requestsRes.data && Array.isArray(requestsRes.data)) {
          setRemovalRequests(requestsRes.data)
        }
        if (lowConfidenceRes.data?.items && Array.isArray(lowConfidenceRes.data.items)) {
          setLowConfidencePhotos(lowConfidenceRes.data.items)
        }

        // Fetch users for user management
        const usersRes = await apiClient.getAdminUsers()
        if (usersRes.data) {
          setAllUsers(usersRes.data.users || [])
          setCallerRole(usersRes.data.callerRole || "")
          setCallerEmail(usersRes.data.callerEmail || "")
        }
      } catch (error) {
        console.error("Failed to fetch data", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [router, lowConfidenceThreshold])

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) return

    try {
      await apiClient.deletePhoto(photoId)
      setPhotos(photos.filter(p => p.id !== photoId))
      setLowConfidencePhotos(lowConfidencePhotos.filter((p) => p.id !== photoId))
    } catch (error) {
      console.error("Failed to delete photo", error)
      alert("Failed to delete photo")
    }
  }

  const refreshLowConfidenceQueue = async () => {
    try {
      setLowConfidenceLoading(true)
      const res = await apiClient.getLowConfidencePhotos(lowConfidenceThreshold)
      if (res.error) {
        throw new Error(res.error)
      }

      if (res.data?.items && Array.isArray(res.data.items)) {
        setLowConfidencePhotos(res.data.items)
      }
    } catch (error) {
      console.error("Failed to refresh low-confidence queue", error)
      alert("Failed to refresh low-confidence queue")
    } finally {
      setLowConfidenceLoading(false)
    }
  }

  const dismissLowConfidenceItem = async (photoId: string) => {
    try {
      setLowConfidenceLoading(true)
      const res = await apiClient.dismissLowConfidencePhoto(photoId)
      if (res.error) {
        throw new Error(res.error)
      }

      setLowConfidencePhotos((prev) => prev.filter((photo) => photo.id !== photoId))

      // Refresh approved/visible photos so newly approved items appear in All Photos immediately.
      const photosRes = await apiClient.getAllPhotos()
      if (photosRes.error) {
        throw new Error(photosRes.error)
      }
      if (photosRes.data && Array.isArray(photosRes.data)) {
        setPhotos(photosRes.data)
      }
    } catch (error) {
      console.error("Failed to dismiss low-confidence photo", error)
      alert("Failed to dismiss this item")
    } finally {
      setLowConfidenceLoading(false)
    }
  }

  const openLowConfidenceModal = (photo: any) => {
    setSelectedLowConfidencePhoto(photo)
    setIsLowConfidenceModalOpen(true)
  }

  const closeLowConfidenceModal = () => {
    setIsLowConfidenceModalOpen(false)
    setSelectedLowConfidencePhoto(null)
  }

  const handleDismissFromModal = async () => {
    if (!selectedLowConfidencePhoto) return
    await dismissLowConfidenceItem(selectedLowConfidencePhoto.id)
    closeLowConfidenceModal()
  }

  const handleDeleteFromModal = async () => {
    if (!selectedLowConfidencePhoto) return
    await handleDeletePhoto(selectedLowConfidencePhoto.id)
    closeLowConfidenceModal()
  }

  const handleGoToEventEditFromModal = () => {
    if (!selectedLowConfidencePhoto?.eventId) return
    router.push(`/admin/events/${selectedLowConfidencePhoto.eventId}/edit`)
    closeLowConfidenceModal()
  }

  const handlePreviewFromModal = () => {
    if (!selectedLowConfidencePhoto?.storageUrl) return
    window.open(selectedLowConfidencePhoto.storageUrl, "_blank", "noopener,noreferrer")
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event? This will also delete all associated photos.")) return

    try {
      await apiClient.deleteEvent(eventId)
      setEvents(events.filter(e => e.id !== eventId))
      // Also remove photos associated with this event from the local state
      setPhotos(photos.filter(p => p.eventId !== eventId))
    } catch (error) {
      console.error("Failed to delete event", error)
      alert("Failed to delete event")
    }
  }

  const handleApproveRequest = async (requestId: string, photoId: string) => {
    if (!confirm("Are you sure you want to approve this removal request and delete the photo?")) return

    setRequestProcessingId(requestId)
    try {
      // Delete the request first to avoid foreign-key constraint conflicts when deleting the photo.
      await apiClient.deleteRemovalRequest(requestId)
      // Then delete the photo
      await apiClient.deletePhoto(photoId)
      // Update local state
      setPhotos(photos.filter(p => p.id !== photoId))
      setRemovalRequests(removalRequests.filter(r => r.id !== requestId))
      alert("Photo removed successfully")
    } catch (error) {
      console.error("Failed to approve request", error)
      alert("Failed to approve request")
    } finally {
      setRequestProcessingId(null)
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    if (!confirm("Are you sure you want to reject this removal request?")) return

    setRequestProcessingId(requestId)
    try {
      await apiClient.deleteRemovalRequest(requestId)
      setRemovalRequests(removalRequests.filter(r => r.id !== requestId))
      alert("Request rejected")
    } catch (error) {
      console.error("Failed to reject request", error)
      alert("Failed to reject request")
    } finally {
      setRequestProcessingId(null)
    }
  }

  const handleBlurRequest = async (requestId: string, photoId: string, bboxes: string) => {
    if (!confirm("Are you sure you want to blur the faces in this photo? This cannot be undone.")) return

    setRequestProcessingId(requestId)
    try {
      const token = localStorage.getItem("auth_token")
      const res = await fetch(`/api/photos/${photoId}/blur`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ bboxes })
      })
      
      if (!res.ok) throw new Error("Failed to blur photo")

      // Delete the request
      await apiClient.deleteRemovalRequest(requestId)
      
      // Update local state
      setRemovalRequests(removalRequests.filter(r => r.id !== requestId))
      alert("Photo blurred successfully and request resolved.")
    } catch (error) {
      console.error("Failed to blur request", error)
      alert("Failed to blur request")
    } finally {
      setRequestProcessingId(null)
    }
  }

  const handleCleanUpOldSelfies = async () => {
    if (!confirm("WARNING: This will permanently delete ALL old profile selfies and force all users to re-verify their identity. Are you absolutely sure?")) return

    try {
      const authToken = localStorage.getItem("auth_token")
      const res = await fetch("/api/admin/clean-old-selfies", { 
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      })
      const result = await res.json()
      if (res.ok) {
        alert(result.message)
      } else {
        alert("Error: " + result.error)
      }
    } catch (error) {
      alert("Failed to run clean-up script.")
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium"
      case "DRAFT":
        return "bg-slate-100 text-slate-700 border border-slate-200 font-medium"
      case "ARCHIVED":
        return "bg-zinc-100 text-zinc-600 border border-zinc-200 font-medium"
      default:
        return "bg-slate-100 text-slate-700 border border-slate-200"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return "เผยแพร่แล้ว (Published)"
      case "DRAFT":
        return "ฉบับร่าง (Draft)"
      case "ARCHIVED":
        return "จัดเก็บถาวร (Archived)"
      default:
        return status
    }
  }

  const formatDayMonthYear = (dateValue: string | Date) => {
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return "-"

    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = String(date.getFullYear())
    return `${day}/${month}/${year}`
  }

  const activeEvents = events.filter((e) => e.status === "PUBLISHED").length
  const pendingRequests = removalRequests.length
  const totalUsers = allUsers.length

  const filteredEvents = events.filter(e =>
    e.name.toLowerCase().includes(eventSearch.toLowerCase())
  )

  const filteredPhotos = photos.filter(p =>
    p.event?.name?.toLowerCase().includes(photoSearch.toLowerCase()) ||
    p.storageUrl?.toLowerCase().includes(photoSearch.toLowerCase())
  )

  return (
    <>
      <Header userRole="admin" />
      <main className="min-h-screen bg-[#f8fafc] text-slate-800 pb-16">
        {/* Official REG MFU Administrative Sub-bar */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#82181A] uppercase tracking-wider mb-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  ส่วนทะเบียนและประมวลผล • มหาวิทยาลัยแม่ฟ้าหลวง (Division of Registrar, MFU)
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  ระบบบริหารจัดการภาพถ่ายและกิจกรรม (PhotoFinder Admin)
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  ผู้ดูแลระบบ: <span className="font-semibold text-slate-800">{adminName || "Officer"}</span> ({callerEmail || "admin@mfu.ac.th"})
                  <span className="mx-2">•</span>
                  สิทธิ์: <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#82181A]/10 text-[#82181A] border border-[#82181A]/20">{callerRole === "SUPER_ADMIN" ? "ผู้ดูแลระบบสูงสุด (Super Admin)" : "เจ้าหน้าที่ส่วนทะเบียน (Admin)"}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => router.push("/admin/events/create")}
                  className="bg-[#82181A] hover:bg-[#6e1416] text-white rounded-md shadow-xs text-sm font-medium px-4 h-9"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  สร้างกิจกรรมใหม่
                </Button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
              {/* Active Events */}
              <div className="bg-white rounded-lg border border-slate-200 border-t-4 border-t-[#82181A] p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">กิจกรรมที่เปิดค้นหา</span>
                  <Calendar className="h-4 w-4 text-[#82181A]" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-slate-900">{activeEvents}</span>
                  <span className="text-xs text-slate-500">กิจกรรม</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">สถานะเผยแพร่ให้นักศึกษาค้นหา (Active)</p>
              </div>

              {/* Total Events */}
              <div className="bg-white rounded-lg border border-slate-200 border-t-4 border-t-slate-600 p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">กิจกรรมทั้งหมด</span>
                  <BarChart3 className="h-4 w-4 text-slate-600" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-slate-900">{events.length}</span>
                  <span className="text-xs text-slate-500">รายการ</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">รวมฉบับร่างและจัดเก็บถาวร (All Time)</p>
              </div>

              {/* Pending Requests */}
              <div className={`bg-white rounded-lg border border-slate-200 border-t-4 ${pendingRequests > 0 ? "border-t-rose-600" : "border-t-amber-500"} p-4 shadow-xs`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">คำขอลบ / เบลอภาพ</span>
                  <Shield className={`h-4 w-4 ${pendingRequests > 0 ? "text-rose-600" : "text-amber-500"}`} />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-slate-900">{pendingRequests}</span>
                  <span className="text-xs text-slate-500">คำขอ</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">รอการพิจารณาตามสิทธิ์ PDPA</p>
              </div>

              {/* Total Users */}
              <div className="bg-white rounded-lg border border-slate-200 border-t-4 border-t-[#C59B27] p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">ผู้ใช้งานในระบบ</span>
                  <Users className="h-4 w-4 text-[#C59B27]" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-slate-900">{totalUsers}</span>
                  <span className="text-xs text-slate-500">บัญชี</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">ผู้ดูแล, ช่างภาพ และนักศึกษา</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Work Area */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Tabs defaultValue="events" orientation="vertical" className="flex w-full flex-col gap-6 md:flex-row md:items-start">
            {/* Sidebar Navigation */}
            <TabsList className="sticky top-20 w-full shrink-0 flex-col items-stretch gap-1 rounded-lg border border-slate-200 bg-white p-2.5 shadow-xs md:w-64 lg:w-72 !h-auto">
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                งานทะเบียนภาพและกิจกรรม
              </div>
              <TabsTrigger
                value="events"
                className="w-full justify-start gap-2.5 rounded-md px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 data-[state=active]:bg-[#82181A] data-[state=active]:text-white data-[state=active]:font-semibold transition-colors"
              >
                <Calendar className="h-4 w-4 shrink-0" />
                <span className="truncate">รายการกิจกรรม (Events)</span>
                <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 group-data-[state=active]:bg-[#C59B27] group-data-[state=active]:text-white">
                  {events.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="photos"
                className="w-full justify-start gap-2.5 rounded-md px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 data-[state=active]:bg-[#82181A] data-[state=active]:text-white data-[state=active]:font-semibold transition-colors"
              >
                <ImageIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">คลังภาพถ่ายทั้งหมด (Photos)</span>
                <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 group-data-[state=active]:bg-[#C59B27] group-data-[state=active]:text-white">
                  {photos.length}
                </span>
              </TabsTrigger>

              <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-t border-slate-100 mt-2">
                งานพิจารณาและกำกับดูแล
              </div>
              <TabsTrigger
                value="low-confidence"
                className="w-full justify-start gap-2.5 rounded-md px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 data-[state=active]:bg-[#82181A] data-[state=active]:text-white data-[state=active]:font-semibold transition-colors"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="truncate">คิวตรวจสอบ AI (Review)</span>
                {unresolvedLowConfidenceCount > 0 ? (
                  <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    {unresolvedLowConfidenceCount}
                  </span>
                ) : (
                  <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    0
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="requests"
                className="w-full justify-start gap-2.5 rounded-md px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 data-[state=active]:bg-[#82181A] data-[state=active]:text-white data-[state=active]:font-semibold transition-colors"
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span className="truncate">คำขอลบภาพ (Requests)</span>
                {removalRequests.length > 0 ? (
                  <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                    {removalRequests.length}
                  </span>
                ) : (
                  <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    0
                  </span>
                )}
              </TabsTrigger>

              <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-t border-slate-100 mt-2">
                งานบริหารระบบและสิทธิ์
              </div>
              <TabsTrigger
                value="users"
                className="w-full justify-start gap-2.5 rounded-md px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 data-[state=active]:bg-[#82181A] data-[state=active]:text-white data-[state=active]:font-semibold transition-colors"
              >
                <Users className="h-4 w-4 shrink-0" />
                <span className="truncate">จัดการผู้ใช้งาน (Users)</span>
                <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {allUsers.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="health"
                className="w-full justify-start gap-2.5 rounded-md px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 data-[state=active]:bg-[#82181A] data-[state=active]:text-white data-[state=active]:font-semibold transition-colors"
              >
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span className="truncate">สถานะระบบ (Health)</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab Contents */}
            <div className="flex-1 w-full min-w-0">
              {/* TAB 1: EVENTS */}
              <TabsContent value="events" className="mt-0 !outline-none border-0">
                <Card className="border border-slate-200 bg-white rounded-lg shadow-xs overflow-hidden">
                  <CardHeader className="border-b border-slate-200 py-4 px-6 bg-slate-50/50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900">
                          รายการกิจกรรมทั้งหมด (Campus Events)
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          จัดการและตรวจสอบกิจกรรมที่เปิดให้นักศึกษาค้นหาภาพ ({filteredEvents.length} รายการ)
                        </CardDescription>
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="ค้นหากิจกรรม..."
                          value={eventSearch}
                          onChange={(e) => setEventSearch(e.target.value)}
                          className="h-9 border-slate-300 pl-8 text-xs focus:border-[#82181A] focus:ring-[#82181A]/20"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="text-center py-12 text-sm text-slate-400">กำลังโหลดข้อมูลกิจกรรม...</div>
                    ) : filteredEvents.length === 0 ? (
                      <div className="py-16 text-center text-slate-500">
                        <Inbox className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700">ไม่พบข้อมูลกิจกรรม</p>
                        <p className="mt-1 text-xs text-slate-400">ลองเปลี่ยนคำค้นหา หรือสร้างกิจกรรมใหม่</p>
                        <Button onClick={() => router.push("/admin/events/create")} className="mt-4 bg-[#82181A] hover:bg-[#6e1416] text-white text-xs h-8 px-4 rounded-md">
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          สร้างกิจกรรมใหม่
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {filteredEvents.map((event) => (
                          <div key={event.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2.5 mb-1.5">
                                <h3 className="text-sm font-bold text-slate-900 truncate">{event.name}</h3>
                                <span className={`text-[11px] px-2 py-0.5 rounded ${getStatusBadge(event.status)}`}>
                                  {getStatusLabel(event.status)}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
                                <div>
                                  <span className="text-slate-400">วันที่จัดกิจกรรม:</span> <span className="font-medium text-slate-700">{formatDayMonthYear(event.date)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400">บันทึกเมื่อ:</span> <span className="font-medium text-slate-700">{new Date(event.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/admin/events/${event.id}/edit`)}
                                className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md"
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                                แก้ไข
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteEvent(event.id)}
                                className="h-8 px-3 text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-none rounded-md"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                                ลบ
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 2: PHOTOS */}
              <TabsContent value="photos" className="mt-0">
                <Card className="border border-slate-200 bg-white rounded-lg shadow-xs overflow-hidden">
                  <CardHeader className="border-b border-slate-200 py-4 px-6 bg-slate-50/50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900">
                          คลังภาพถ่ายทั้งหมด (Photo Repository)
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          ภาพถ่ายกิจกรรมในระบบทั้งหมด ({filteredPhotos.length} ภาพ)
                        </CardDescription>
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="ค้นหาตามชื่อกิจกรรมหรือชื่อไฟล์..."
                          value={photoSearch}
                          onChange={(e) => setPhotoSearch(e.target.value)}
                          className="h-9 border-slate-300 pl-8 text-xs focus:border-[#82181A] focus:ring-[#82181A]/20"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {isLoading ? (
                      <div className="text-center py-12 text-sm text-slate-400">กำลังโหลดภาพถ่าย...</div>
                    ) : filteredPhotos.length === 0 ? (
                      <div className="py-16 text-center text-slate-500">
                        <ImageIcon className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700">ไม่พบภาพถ่ายในระบบ</p>
                        <p className="mt-1 text-xs text-slate-400">ภาพที่ช่างภาพอัปโหลดจะปรากฏที่นี่</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {filteredPhotos.map((photo) => (
                          <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-100 hover:shadow-xs transition-shadow">
                            <img
                              src={photo.thumbnailUrl || photo.storageUrl}
                              alt="Event photo"
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeletePhoto(photo.id)}
                                className="h-8 px-3 text-xs bg-rose-600 hover:bg-rose-700 font-medium rounded-md shadow-none"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                ลบภาพ
                              </Button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 truncate bg-slate-900/80 px-2 py-1 text-[11px] text-white">
                              {photo.event?.name || new Date(photo.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 3: LOW CONFIDENCE */}
              <TabsContent value="low-confidence" className="mt-0">
                <Card className="border border-slate-200 bg-white rounded-lg shadow-xs overflow-hidden">
                  <CardHeader className="border-b border-slate-200 py-4 px-6 bg-slate-50/50">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900">
                          คิวตรวจสอบภาพค่าความมั่นใจต่ำ (AI Moderation Queue)
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          ตรวจสอบภาพที่ AI ตรวจจับใบหน้าได้ค่าความมั่นใจต่ำกว่าเกณฑ์มาตรฐาน
                        </CardDescription>
                      </div>
                      <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                        <Input
                          placeholder="ค้นหากิจกรรมหรือ URL..."
                          value={lowConfidenceSearch}
                          onChange={(e) => setLowConfidenceSearch(e.target.value)}
                          className="w-full sm:w-56 h-9 border-slate-300 text-xs focus:border-[#82181A]"
                        />
                        <div className="relative">
                          <select
                            value={String(lowConfidenceThreshold)}
                            onChange={(e) => setLowConfidenceThreshold(Number(e.target.value))}
                            className="h-9 appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-xs font-medium text-slate-700 focus:border-[#82181A]"
                          >
                            <option value="0.65">เกณฑ์ (Threshold): 0.65</option>
                            <option value="0.55">เกณฑ์ (Threshold): 0.55</option>
                            <option value="0.45">เกณฑ์ (Threshold): 0.45</option>
                          </select>
                          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </span>
                        </div>
                        <Button variant="outline" onClick={refreshLowConfidenceQueue} disabled={lowConfidenceLoading} className="h-9 px-3 text-xs border-slate-300 text-slate-700 rounded-md">
                          {lowConfidenceLoading ? "กำลังรีเฟรช..." : "รีเฟรช"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="text-center py-12 text-sm text-slate-400">กำลังโหลดคิวตรวจสอบ...</div>
                    ) : filteredLowConfidencePhotos.length === 0 ? (
                      <div className="py-16 text-center text-slate-500">
                        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
                        <p className="text-sm font-semibold text-slate-700">ไม่มีภาพค้างในคิวตรวจสอบ</p>
                        <p className="mt-1 text-xs text-slate-400">ภาพทั้งหมดผ่านเกณฑ์ความมั่นใจตามระดับที่กำหนด</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {filteredLowConfidencePhotos.map((photo) => (
                          <div
                            key={photo.id}
                            className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/80 transition-colors"
                          >
                            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                              <img
                                src={photo.thumbnailUrl || photo.storageUrl}
                                alt="Low confidence photo"
                                className="h-full w-full object-cover"
                              />
                            </div>

                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="font-bold text-sm text-slate-900 truncate">{photo.eventName || "กิจกรรมไม่ระบุชื่อ"}</p>
                              <p className="text-xs text-slate-500 font-mono truncate">{photo.storageUrl}</p>
                              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  คะแนนต่ำสุด: {photo.minConfidence !== null ? Number(photo.minConfidence).toFixed(3) : "N/A"}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                  ใบหน้าความมั่นใจต่ำ: {photo.lowConfidenceFaces}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                  ใบหน้าทั้งหมด: {photo.totalFaces}
                                </span>
                              </div>
                            </div>

                            <div className="flex md:flex-col gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openLowConfidenceModal(photo)}
                                className="h-8 px-3 text-xs border-slate-200 text-slate-700 hover:bg-slate-100 rounded-md font-medium"
                              >
                                ตรวจสอบภาพ (Review)
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Modal Review */}
                <Dialog open={isLowConfidenceModalOpen} onOpenChange={(open) => {
                  setIsLowConfidenceModalOpen(open)
                  if (!open) setSelectedLowConfidencePhoto(null)
                }}>
                  <DialogContent className="max-w-2xl border-slate-200 bg-white shadow-xl rounded-lg p-6">
                    <DialogHeader className="border-b border-slate-200 pb-3">
                      <DialogTitle className="text-base font-bold text-slate-900">การตรวจสอบภาพถ่ายที่มีค่าความมั่นใจต่ำ</DialogTitle>
                      <DialogDescription className="text-xs text-slate-500">
                        กิจกรรม: {selectedLowConfidencePhoto?.eventName || "ไม่ระบุชื่อ"}
                      </DialogDescription>
                    </DialogHeader>

                    {selectedLowConfidencePhoto && (
                      <div className="space-y-4 py-3">
                        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-950/5 flex items-center justify-center">
                          <img
                            src={selectedLowConfidencePhoto.storageUrl}
                            alt="Low confidence preview"
                            className="max-h-[360px] w-full object-contain"
                          />
                        </div>

                        <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-200">
                          <p className="font-mono break-all text-[11px] text-slate-500">{selectedLowConfidencePhoto.storageUrl}</p>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              คะแนนต่ำสุด (Min Confidence): {selectedLowConfidencePhoto.minConfidence !== null ? Number(selectedLowConfidencePhoto.minConfidence).toFixed(3) : "N/A"}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-white text-slate-700 border border-slate-200">
                              ใบหน้าความมั่นใจต่ำ: {selectedLowConfidencePhoto.lowConfidenceFaces}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-white text-slate-700 border border-slate-200">
                              ใบหน้าทั้งหมด: {selectedLowConfidencePhoto.totalFaces}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <DialogFooter className="border-t border-slate-200 pt-3 gap-2 sm:justify-between">
                      <Button variant="outline" size="sm" onClick={handlePreviewFromModal} className="h-8 px-3 text-xs border-slate-200 text-slate-700 rounded-md">
                        เปิดภาพต้นฉบับ
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleDismissFromModal}
                          disabled={lowConfidenceLoading}
                          className="h-8 px-3 text-xs bg-emerald-700 text-white hover:bg-emerald-800 rounded-md shadow-none font-medium"
                        >
                          {lowConfidenceLoading ? "กำลังอนุมัติ..." : "อนุมัติผ่านเกณฑ์"}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDeleteFromModal} className="h-8 px-3 text-xs bg-rose-600 hover:bg-rose-700 rounded-md shadow-none font-medium">
                          ลบภาพทิ้ง
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleGoToEventEditFromModal} className="h-8 px-3 text-xs border-slate-200 text-slate-700 rounded-md font-medium">
                          ไปที่หน้ากิจกรรม
                        </Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* TAB 4: REMOVAL REQUESTS */}
              <TabsContent value="requests" className="mt-0">
                <Card className="border border-slate-200 bg-white rounded-lg shadow-xs overflow-hidden">
                  <CardHeader className="border-b border-slate-200 py-4 px-6 bg-slate-50/50">
                    <CardTitle className="text-base font-bold text-slate-900">คำขอลบหรือเบลอภาพถ่าย (Removal & Privacy Requests)</CardTitle>
                    <CardDescription className="text-xs text-slate-500">คำร้องขอใช้สิทธิ์ความเป็นส่วนตัวจากนักศึกษาและผู้ใช้งานระบบ ตามมาตรฐาน PDPA</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="text-center py-12 text-sm text-slate-400">กำลังโหลดรายการคำขอ...</div>
                    ) : removalRequests.length === 0 ? (
                      <div className="py-16 text-center text-slate-500">
                        <Shield className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700">ไม่มีคำขอลบภาพค้างในระบบ</p>
                        <p className="mt-1 text-xs text-slate-400">เมื่อมีนักศึกษายื่นคำร้องขอความเป็นส่วนตัว ข้อมูลจะปรากฏที่นี่</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {removalRequests.map((request) => (
                          <div key={request.id} className="p-4 flex flex-col md:flex-row gap-4 hover:bg-slate-50/80 transition-colors">
                            {request.photo && (
                              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                                <img
                                  src={request.photo.url}
                                  alt="Requested photo"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 space-y-2">
                              <div>
                                <h4 className="text-sm font-bold text-slate-900">
                                  {request.photo?.eventName || "ไม่ระบุกิจกรรม"}
                                </h4>
                                <p className="text-xs text-slate-500">
                                  ผู้ยื่นคำขอ: <span className="font-semibold text-slate-700">{request.userName}</span> เมื่อ{" "}
                                  {new Date(request.createdAt).toLocaleDateString()} เวลา{" "}
                                  {new Date(request.createdAt).toLocaleTimeString()}
                                </p>
                              </div>
                              {request.reason && (
                                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">เหตุผลความจำเป็น (Reason):</p>
                                  <p className="text-xs text-slate-700">{request.reason}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex md:flex-col gap-2 shrink-0 justify-center">
                              <Button
                                size="sm"
                                onClick={() => handleApproveRequest(request.id, request.photoId)}
                                disabled={requestProcessingId === request.id}
                                className="h-8 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-none font-medium"
                              >
                                {requestProcessingId === request.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    กำลังประมวลผล...
                                  </>
                                ) : (
                                  "อนุมัติและลบภาพ"
                                )}
                              </Button>
                              {request.faceCoordinates && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleBlurRequest(request.id, request.photoId, request.faceCoordinates)}
                                  disabled={requestProcessingId === request.id}
                                  className="h-8 px-3 text-xs border-[#82181A] text-[#82181A] hover:bg-[#82181A] hover:text-white rounded-md font-medium"
                                >
                                  {requestProcessingId === request.id ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                      กำลังประมวลผล...
                                    </>
                                  ) : (
                                    "อนุมัติและเบลอใบหน้า"
                                  )}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectRequest(request.id)}
                                disabled={requestProcessingId === request.id}
                                className="h-8 px-3 text-xs border-slate-200 text-slate-700 hover:bg-slate-100 rounded-md font-medium"
                              >
                                {requestProcessingId === request.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    กำลังประมวลผล...
                                  </>
                                ) : (
                                  "ปฏิเสธคำขอ"
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB 5: USER MANAGEMENT */}
              <TabsContent value="users" className="mt-0">
                <div className="space-y-4">
                  {userMgmtMessage && (
                    <div className={`flex gap-3 p-3 rounded-md border text-xs ${
                      userMgmtMessage.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}>
                      {userMgmtMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                      <p>{userMgmtMessage.text}</p>
                    </div>
                  )}

                  {/* Add Photographer */}
                  <Card className="border border-slate-200 bg-white rounded-lg shadow-xs overflow-hidden">
                    <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Camera className="w-4 h-4 text-[#82181A]" />
                        แต่งตั้งช่างภาพ (Assign Photographer)
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        ระบุอีเมล Google หรืออีเมลมหาวิทยาลัย (@mfu.ac.th, @lamduan.mfu.ac.th) เพื่อให้สิทธิ์ในการอัปโหลดภาพกิจกรรม
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="photographer@lamduan.mfu.ac.th หรือ gmail"
                          value={newPhotographerEmail}
                          onChange={(e) => setNewPhotographerEmail(e.target.value)}
                          className="flex-1 h-9 border-slate-300 text-xs focus:border-[#82181A]"
                        />
                        <Button
                          disabled={userMgmtLoading || !newPhotographerEmail}
                          className="bg-[#82181A] hover:bg-[#6e1416] text-white h-9 px-4 text-xs rounded-md shadow-none font-medium"
                          onClick={async () => {
                            setUserMgmtLoading(true)
                            setUserMgmtMessage(null)
                            const res = await apiClient.setUserRole(newPhotographerEmail, "PHOTOGRAPHER")
                            if (res.error) {
                              setUserMgmtMessage({ type: "error", text: res.error })
                            } else {
                              setUserMgmtMessage({ type: "success", text: `แต่งตั้ง ${newPhotographerEmail} เป็นช่างภาพเรียบร้อยแล้ว` })
                              setNewPhotographerEmail("")
                              const usersRes = await apiClient.getAdminUsers()
                              if (usersRes.data) setAllUsers(usersRes.data.users || [])
                            }
                            setUserMgmtLoading(false)
                          }}
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                          แต่งตั้งสิทธิ์
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Add Admin (Super Admin only) */}
                  {callerRole === "SUPER_ADMIN" && (
                    <Card className="border border-slate-200 bg-white rounded-lg shadow-xs overflow-hidden">
                      <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Crown className="w-4 h-4 text-[#C59B27]" />
                          แต่งตั้งผู้ดูแลระบบ (Assign Admin)
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          เฉพาะผู้ดูแลระบบสูงสุด (Super Admin) เท่านั้นที่สามารถเพิ่มหรือปรับสิทธิ์ผู้ดูแลระบบได้
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="flex gap-2">
                          <Input
                            placeholder="admin@mfu.ac.th"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            className="flex-1 h-9 border-slate-300 text-xs focus:border-[#82181A]"
                          />
                          <Button
                            disabled={userMgmtLoading || !newAdminEmail}
                            className="bg-[#C59B27] hover:bg-[#b0881f] text-white h-9 px-4 text-xs rounded-md shadow-none font-medium"
                            onClick={async () => {
                              setUserMgmtLoading(true)
                              setUserMgmtMessage(null)
                              const res = await apiClient.setUserRole(newAdminEmail, "ADMIN")
                              if (res.error) {
                                setUserMgmtMessage({ type: "error", text: res.error })
                              } else {
                                setUserMgmtMessage({ type: "success", text: `แต่งตั้ง ${newAdminEmail} เป็นแอดมินเรียบร้อยแล้ว` })
                                setNewAdminEmail("")
                                const usersRes = await apiClient.getAdminUsers()
                                if (usersRes.data) setAllUsers(usersRes.data.users || [])
                              }
                              setUserMgmtLoading(false)
                            }}
                          >
                            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                            แต่งตั้งแอดมิน
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* User List Table */}
                  <Card className="border border-slate-200 bg-white rounded-lg shadow-xs overflow-hidden">
                    <CardHeader className="py-4 px-6 border-b border-slate-200 bg-slate-50/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-base font-bold text-slate-900">ทะเบียนรายชื่อผู้ใช้งานทั้งหมด (Registered Accounts)</CardTitle>
                          <CardDescription className="text-xs text-slate-500">ผู้ใช้งานในระบบจำนวน {allUsers.length} รายการ</CardDescription>
                        </div>
                        <div className="relative w-full max-w-xs">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            type="search"
                            placeholder="ค้นหาชื่อหรืออีเมล..."
                            className="h-9 pl-8 border-slate-300 text-xs focus:border-[#82181A]"
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-100 border-b border-slate-200 hover:bg-slate-100">
                              <TableHead className="w-[45%] text-[11px] font-bold text-slate-600 uppercase tracking-wider h-10">ข้อมูลผู้ใช้งาน (User Details)</TableHead>
                              <TableHead className="w-[15%] text-[11px] font-bold text-slate-600 uppercase tracking-wider h-10">สถานะ (Status)</TableHead>
                              <TableHead className="w-[20%] text-[11px] font-bold text-slate-600 uppercase tracking-wider h-10">บทบาท (Role)</TableHead>
                              <TableHead className="text-right text-[11px] font-bold text-slate-600 uppercase tracking-wider h-10">จัดการ (Actions)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAndSortedUsers.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="h-36 text-center text-slate-400">
                                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                  <p className="text-sm font-semibold text-slate-700">ไม่พบรายชื่อผู้ใช้งาน</p>
                                  <p className="text-xs">ลองค้นหาด้วยคำค้นอื่น</p>
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredAndSortedUsers.map((u) => {
                                const isSuperAdmin = u.role === "SUPER_ADMIN"
                                const isAdminRole = u.role === "ADMIN"
                                const isPhotographer = u.role === "PHOTOGRAPHER"
                                const isStudentEmail = u.email.endsWith("@lamduan.mfu.ac.th") || u.email.endsWith("@mfu.ac.th")
                                
                                const canDemote = (() => {
                                  if (isSuperAdmin) return false
                                  if (!isStudentEmail) return false
                                  if (isAdminRole) return callerRole === "SUPER_ADMIN"
                                  if (isPhotographer) return true
                                  return false
                                })()
                                const canRemove = (() => {
                                  if (isSuperAdmin) return false
                                  if (isAdminRole) return callerRole === "SUPER_ADMIN"
                                  if (isPhotographer) return true
                                  return false
                                })()
                                const canPermanentlyRemove = callerRole === "SUPER_ADMIN" && !isSuperAdmin
                                
                                const canToggleStatus = (() => {
                                  if (callerRole === "SUPER_ADMIN" && u.email !== callerEmail) return true
                                  if (u.role === "SUPER_ADMIN") return false
                                  if (u.role === "ADMIN" && callerRole !== "SUPER_ADMIN") return false
                                  return true
                                })()
        
                                const roleBadge = ({
                                  SUPER_ADMIN: "bg-amber-50 text-amber-800 border-amber-300 font-semibold",
                                  ADMIN: "bg-[#82181A]/10 text-[#82181A] border-[#82181A]/20 font-semibold",
                                  PHOTOGRAPHER: "bg-emerald-50 text-emerald-700 border-emerald-200 font-medium",
                                  STUDENT: "bg-slate-100 text-slate-700 border-slate-200 font-medium",
                                } as Record<string, string>)[u.role] || "bg-slate-100 text-slate-700 border-slate-200"
        
                                const roleLabel = {
                                  SUPER_ADMIN: "Super Admin",
                                  ADMIN: "Admin",
                                  PHOTOGRAPHER: "Photographer",
                                  STUDENT: "Student",
                                }[u.role as string] || u.role
        
                                return (
                                  <TableRow key={u.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 h-14">
                                    <TableCell className="font-medium align-middle">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 overflow-hidden ring-1 ring-slate-300">
                                          {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name || "Avatar"} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : (u.name?.[0]?.toUpperCase() || u.email[0].toUpperCase())}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-xs font-bold text-slate-900 truncate">{u.name || "ไม่ระบุชื่อ"}</span>
                                          <span className="text-[11px] text-slate-500 truncate">{u.email}</span>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="align-middle">
                                      {!u.isActive ? (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold">
                                          <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                          ระงับสิทธิ์ (Blocked)
                                        </div>
                                      ) : (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                          ปกติ (Active)
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="align-middle">
                                      <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border text-[11px] ${roleBadge}`}>
                                        {isSuperAdmin && <Crown className="w-3 h-3 text-amber-600" />}
                                        {roleLabel}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right align-middle">
                                      <div className="flex justify-end gap-1.5">
                                        {canToggleStatus && u.email !== callerEmail && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className={`h-7 px-2.5 text-[11px] font-medium border rounded ${u.isActive ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
                                            disabled={userMgmtLoading}
                                            onClick={async () => {
                                              if (!confirm(`ยืนยันการ ${u.isActive ? 'ระงับการใช้งาน' : 'ปลดการระงับ'} ${u.email}?`)) return
                                              setUserMgmtLoading(true)
                                              setUserMgmtMessage(null)
                                              const res = await apiClient.setUserStatus(u.id, !u.isActive)
                                              if (res.error) {
                                                setUserMgmtMessage({ type: "error", text: res.error })
                                              } else {
                                                setUserMgmtMessage({ type: "success", text: `${u.email} ได้รับการ${u.isActive ? 'ระงับการใช้งาน' : 'ปลดการระงับ'}เรียบร้อยแล้ว` })
                                                const usersRes = await apiClient.getAdminUsers()
                                                if (usersRes.data) setAllUsers(usersRes.data.users || [])
                                              }
                                              setUserMgmtLoading(false)
                                            }}
                                          >
                                            {u.isActive ? <Ban className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
                                            {u.isActive ? "ระงับสิทธิ์" : "ปลดระงับ"}
                                          </Button>
                                        )}
                                        
                                        {canDemote && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2.5 text-[11px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 rounded"
                                            disabled={userMgmtLoading}
                                            onClick={async () => {
                                              if (!confirm(`ลดสิทธิ์ ${u.email} จาก ${roleLabel} กลับเป็น นักศึกษา?`)) return
                                              setUserMgmtLoading(true)
                                              setUserMgmtMessage(null)
                                              const res = await apiClient.removeUserRole(u.id)
                                              if (res.error) {
                                                setUserMgmtMessage({ type: "error", text: res.error })
                                              } else {
                                                setUserMgmtMessage({ type: "success", text: `ปรับลดสิทธิ์ ${u.email} เป็นนักศึกษาเรียบร้อยแล้ว` })
                                                const usersRes = await apiClient.getAdminUsers()
                                                if (usersRes.data) setAllUsers(usersRes.data.users || [])
                                              }
                                              setUserMgmtLoading(false)
                                            }}
                                          >
                                            <UserMinus className="w-3 h-3 mr-1" />
                                            ลดสิทธิ์
                                          </Button>
                                        )}
    
                                        {canPermanentlyRemove && (
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            className="h-7 px-2.5 text-[11px] font-medium bg-rose-600 hover:bg-rose-700 rounded"
                                            disabled={userMgmtLoading}
                                            onClick={async () => {
                                              const confirmation = prompt(
                                                `ลบบัญชีถาวร (PERMANENT REMOVAL)\n\nพิมพ์ REMOVE เพื่อยืนยันการลบผู้ใช้ ${u.email} ออกจากระบบอย่างถาวร:\n\nการกระทำนี้ไม่สามารถย้อนกลับได้`
                                              )
                                              if (confirmation !== "REMOVE") return
    
                                              setUserMgmtLoading(true)
                                              setUserMgmtMessage(null)
                                              const res = await apiClient.removeAdmin(u.id)
                                              if (res.error) {
                                                setUserMgmtMessage({ type: "error", text: res.error })
                                              } else {
                                                setUserMgmtMessage({ type: "success", text: `ลบบัญชี ${u.email} ออกจากระบบถาวรเรียบร้อยแล้ว` })
                                                const usersRes = await apiClient.getAdminUsers()
                                                if (usersRes.data) setAllUsers(usersRes.data.users || [])
                                              }
                                              setUserMgmtLoading(false)
                                            }}
                                          >
                                            <Trash2 className="w-3 h-3 mr-1" />
                                            ลบ
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* TAB 6: SYSTEM HEALTH */}
              <TabsContent value="health" className="mt-0">
                <div className="space-y-4">
                  <Card className="border border-rose-200 bg-white rounded-lg shadow-xs overflow-hidden">
                    <CardHeader className="py-3 px-5 border-b border-rose-100 bg-rose-50/50">
                      <CardTitle className="text-sm font-bold text-rose-900 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        พื้นที่ควบคุมความปลอดภัยระดับสูง (Administrative Danger Zone)
                      </CardTitle>
                      <CardDescription className="text-xs text-rose-700">
                        การดำเนินการที่ส่งผลกระทบต่อข้อมูลจำนวนมากในระดับฐานข้อมูล
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 border border-rose-200 bg-rose-50/30 rounded-md gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-900">ล้างข้อมูลภาพถ่ายยืนยันตัวตนเก่า (Wipe Old Profile Selfies)</p>
                          <p className="text-xs text-slate-500 mt-0.5">ลบภาพเซลฟีต้นแบบเก่าทั้งหมด เพื่อบังคับให้นักศึกษาทำการสแกนยืนยันตัวตนใหม่ด้วยระบบ Identity Guard</p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={handleCleanUpOldSelfies} className="h-8 px-3 text-xs bg-rose-600 hover:bg-rose-700 rounded-md font-medium shrink-0 shadow-none">
                          ล้างข้อมูลและบังคับสแกนใหม่
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                    <SystemHealth />
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>
    </>
  )
}
