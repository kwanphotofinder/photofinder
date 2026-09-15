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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus, Calendar, Image as ImageIcon, Trash2, BarChart3, Users, Bell, Shield, AlertCircle, CheckCircle2, Pencil, UserPlus, Crown, Camera, Inbox, Ban, Unlock, UserMinus, ChevronDown, Loader2, FileText, Download, Filter, RefreshCw } from "lucide-react"
import { SystemHealth } from "@/components/system-health"
import { apiClient } from "@/lib/api-client"
import { useLanguage } from "@/lib/language-context"
import { ConfirmationModal } from "@/components/confirmation-modal"

export default function AdminDashboardPage() {
  const router = useRouter()
  const { t } = useLanguage()
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
  const [userPage, setUserPage] = useState(1)
  const USERS_PER_PAGE = 10
  const [callerRole, setCallerRole] = useState("")
  const [callerEmail, setCallerEmail] = useState("")
  const [newPhotographerEmail, setNewPhotographerEmail] = useState("")
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [userMgmtLoading, setUserMgmtLoading] = useState(false)
  const [userMgmtMessage, setUserMgmtMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [requestProcessingId, setRequestProcessingId] = useState<string | null>(null)

  // Audit Logs state (Super Admin Only)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditLogsTotal, setAuditLogsTotal] = useState(0)
  const [auditLogsLoading, setAuditLogsLoading] = useState(false)
  const [auditCategoryFilter, setAuditCategoryFilter] = useState("ALL")
  const [auditSearchQuery, setAuditSearchQuery] = useState("")
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const [isExportingCsv, setIsExportingCsv] = useState(false)

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

  const paginatedUsers = useMemo(() => {
    const startIndex = (userPage - 1) * USERS_PER_PAGE
    return filteredAndSortedUsers.slice(startIndex, startIndex + USERS_PER_PAGE)
  }, [filteredAndSortedUsers, userPage])

  const userTotalPages = Math.max(1, Math.ceil(filteredAndSortedUsers.length / USERS_PER_PAGE))

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

          // Fetch initial audit logs if caller is SUPER_ADMIN
          if (usersRes.data.callerRole === "SUPER_ADMIN") {
            const auditRes = await apiClient.getAuditLogs({ page: 1, limit: 25 })
            if (auditRes.data) {
              setAuditLogs(auditRes.data.logs || [])
              setAuditLogsTotal(auditRes.data.total || 0)
              setAuditTotalPages(auditRes.data.totalPages || 1)
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch data", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [router, lowConfidenceThreshold])

  const fetchAuditLogs = async (cat = auditCategoryFilter, search = auditSearchQuery, page = auditPage) => {
    setAuditLogsLoading(true)
    try {
      const res = await apiClient.getAuditLogs({
        category: cat !== "ALL" ? cat : undefined,
        search: search.trim() || undefined,
        page,
        limit: 25,
      })
      if (res.data) {
        setAuditLogs(res.data.logs || [])
        setAuditLogsTotal(res.data.total || 0)
        setAuditTotalPages(res.data.totalPages || 1)
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err)
    } finally {
      setAuditLogsLoading(false)
    }
  }

  const handleExportAuditLogsCsv = async () => {
    setIsExportingCsv(true)
    try {
      const token = localStorage.getItem("auth_token")
      const query = new URLSearchParams({ format: "csv" })
      if (auditCategoryFilter !== "ALL") query.set("category", auditCategoryFilter)
      if (auditSearchQuery.trim()) query.set("search", auditSearchQuery.trim())

      const res = await fetch(`/api/admin/audit-logs?${query.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) throw new Error("Failed to export audit logs")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `photofinder_audit_logs_${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("Export error:", err)
      alert("Failed to export audit logs. Please try again.")
    } finally {
      setIsExportingCsv(false)
    }
  }

  // Confirmation Modal States
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null)
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false)

  const [eventToDelete, setEventToDelete] = useState<string | null>(null)
  const [isDeletingEvent, setIsDeletingEvent] = useState(false)

  const [approveRequestItem, setApproveRequestItem] = useState<{ requestId: string; photoId: string } | null>(null)
  const [rejectRequestItem, setRejectRequestItem] = useState<string | null>(null)
  const [blurRequestItem, setBlurRequestItem] = useState<{ requestId: string; photoId: string; bboxes: string } | null>(null)

  const [showCleanOldSelfiesModal, setShowCleanOldSelfiesModal] = useState(false)
  const [isCleaningSelfies, setIsCleaningSelfies] = useState(false)

  const [userStatusToToggle, setUserStatusToToggle] = useState<any | null>(null)
  const [userToDemote, setUserToDemote] = useState<any | null>(null)
  const [userToRemove, setUserToRemove] = useState<any | null>(null)

  const confirmDeletePhoto = async () => {
    if (!photoToDelete) return

    setIsDeletingPhoto(true)
    try {
      await apiClient.deletePhoto(photoToDelete)
      setPhotos(prev => prev.filter(p => p.id !== photoToDelete))
      setLowConfidencePhotos(prev => prev.filter((p) => p.id !== photoToDelete))
      setPhotoToDelete(null)
    } catch (error) {
      console.error("Failed to delete photo", error)
      alert("Failed to delete photo")
    } finally {
      setIsDeletingPhoto(false)
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
    setPhotoToDelete(selectedLowConfidencePhoto.id)
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

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return

    setIsDeletingEvent(true)
    try {
      await apiClient.deleteEvent(eventToDelete)
      setEvents(events.filter(e => e.id !== eventToDelete))
      setPhotos(photos.filter(p => p.eventId !== eventToDelete))
      setEventToDelete(null)
    } catch (error) {
      console.error("Failed to delete event", error)
      alert("Failed to delete event")
    } finally {
      setIsDeletingEvent(false)
    }
  }

  const confirmApproveRequest = async () => {
    if (!approveRequestItem) return

    const { requestId, photoId } = approveRequestItem
    setRequestProcessingId(requestId)
    try {
      await apiClient.deleteRemovalRequest(requestId)
      await apiClient.deletePhoto(photoId)
      setPhotos(photos.filter(p => p.id !== photoId))
      setRemovalRequests(removalRequests.filter(r => r.id !== requestId))
      setApproveRequestItem(null)
      alert("Photo removed successfully")
    } catch (error) {
      console.error("Failed to approve request", error)
      alert("Failed to approve request")
    } finally {
      setRequestProcessingId(null)
    }
  }

  const confirmRejectRequest = async () => {
    if (!rejectRequestItem) return

    const requestId = rejectRequestItem
    setRequestProcessingId(requestId)
    try {
      await apiClient.deleteRemovalRequest(requestId)
      setRemovalRequests(removalRequests.filter(r => r.id !== requestId))
      setRejectRequestItem(null)
      alert("Request rejected")
    } catch (error) {
      console.error("Failed to reject request", error)
      alert("Failed to reject request")
    } finally {
      setRequestProcessingId(null)
    }
  }

  const confirmBlurRequest = async () => {
    if (!blurRequestItem) return

    const { requestId, photoId, bboxes } = blurRequestItem
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
      const data = await res.json()

      // Delete the request
      await apiClient.deleteRemovalRequest(requestId)
      
      // Update local state for removal requests
      setRemovalRequests(prev => prev.filter(r => r.id !== requestId))

      // Update local photos state immediately without needing a page refresh
      if (data.deleted) {
        setPhotos(prev => prev.filter(p => p.id !== photoId))
        alert("Solo photo had 1 face and was deleted to save storage.")
      } else if (data.url) {
        setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, storageUrl: data.url } : p))
        alert("Photo blurred successfully and request resolved.")
      } else {
        alert("Photo blurred successfully and request resolved.")
      }
      setBlurRequestItem(null)
    } catch (error) {
      console.error("Failed to blur request", error)
      alert("Failed to blur request")
    } finally {
      setRequestProcessingId(null)
    }
  }

  const confirmCleanUpOldSelfies = async () => {
    setIsCleaningSelfies(true)
    try {
      const authToken = localStorage.getItem("auth_token")
      const res = await fetch("/api/admin/clean-old-selfies", { 
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      })
      const result = await res.json()
      setShowCleanOldSelfiesModal(false)
      if (res.ok) {
        alert(result.message)
      } else {
        alert("Error: " + result.error)
      }
    } catch (error) {
      alert("Failed to run clean-up script.")
    } finally {
      setIsCleaningSelfies(false)
    }
  }

  const confirmToggleUserStatus = async () => {
    if (!userStatusToToggle) return
    setUserMgmtLoading(true)
    setUserMgmtMessage(null)
    try {
      const res = await apiClient.setUserStatus(userStatusToToggle.id, !userStatusToToggle.isActive)
      if (res.error) {
        setUserMgmtMessage({ type: "error", text: res.error })
      } else {
        setUserMgmtMessage({ type: "success", text: `Updated status for ${userStatusToToggle.email}` })
        const usersRes = await apiClient.getAdminUsers()
        if (usersRes.data) setAllUsers(usersRes.data.users || [])
      }
      setUserStatusToToggle(null)
    } catch (err) {
      setUserMgmtMessage({ type: "error", text: "Failed to update user status" })
    } finally {
      setUserMgmtLoading(false)
    }
  }

  const confirmDemoteUser = async () => {
    if (!userToDemote) return
    setUserMgmtLoading(true)
    setUserMgmtMessage(null)
    try {
      const res = await apiClient.removeUserRole(userToDemote.id)
      if (res.error) {
        setUserMgmtMessage({ type: "error", text: res.error })
      } else {
        setUserMgmtMessage({ type: "success", text: `Demoted ${userToDemote.email} to student` })
        const usersRes = await apiClient.getAdminUsers()
        if (usersRes.data) setAllUsers(usersRes.data.users || [])
      }
      setUserToDemote(null)
    } catch (err) {
      setUserMgmtMessage({ type: "error", text: "Failed to demote user" })
    } finally {
      setUserMgmtLoading(false)
    }
  }

  const confirmRemoveUser = async () => {
    if (!userToRemove) return
    setUserMgmtLoading(true)
    setUserMgmtMessage(null)
    try {
      const res = await apiClient.removeAdmin(userToRemove.id)
      if (res.error) {
        setUserMgmtMessage({ type: "error", text: res.error })
      } else {
        setUserMgmtMessage({ type: "success", text: `Deleted user ${userToRemove.email}` })
        const usersRes = await apiClient.getAdminUsers()
        if (usersRes.data) setAllUsers(usersRes.data.users || [])
      }
      setUserToRemove(null)
    } catch (err) {
      setUserMgmtMessage({ type: "error", text: "Failed to delete user" })
    } finally {
      setUserMgmtLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      DRAFT: "bg-[#fffbe6] border border-[#ffe58f] text-[#d48806]",
      PUBLISHED: "bg-[#f6ffed] border border-[#b7eb8f] text-[#389e0d]",
      ARCHIVED: "bg-slate-100 border border-slate-200 text-slate-600",
    }
    return styles[status as keyof typeof styles] || styles.DRAFT
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


      <main className="min-h-screen bg-[#f0f2f5] pb-12">
        {/* Academic Portal Header Banner */}
        <div className="bg-white border-b border-slate-200 shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-1.5 bg-[#82181a] rounded-xs"></div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t("dash.title")}</h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    {t("dash.welcome")} <span className="font-semibold text-slate-800">{adminName || "Administrator"}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => router.push("/admin/events/create")}
                  className="bg-[#82181a] hover:bg-[#9c1f22] text-white text-xs sm:text-sm font-medium rounded shadow-2xs h-9 px-3.5"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  {t("dash.btn.create_event")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/admin/settings")}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm rounded h-9 px-3.5 bg-white"
                >
                  {t("dash.btn.settings")}
                </Button>
              </div>
            </div>

            {/* Summary Metric Cards (REG MFU Style with Top Border Stripe) */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
              <div className="bg-white rounded border border-slate-200 border-t-4 border-t-[#82181a] p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>{t("dash.metric.active_events")}</span>
                  <div className="w-8 h-8 rounded bg-[#82181a]/10 flex items-center justify-center text-[#82181a]">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-900">{activeEvents}</div>
                <p className="text-xs text-slate-500 mt-1">{t("dash.metric.out_of")} {events.length} {t("dash.metric.events_unit")}</p>
              </div>

              <div className="bg-white rounded border border-slate-200 border-t-4 border-t-[#c59b27] p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>{t("dash.metric.total_events")}</span>
                  <div className="w-8 h-8 rounded bg-[#c59b27]/15 flex items-center justify-center text-[#9a781c]">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-900">{events.length}</div>
                <p className="text-xs text-slate-500 mt-1">{t("dash.metric.in_db")}</p>
              </div>

              <div className="bg-white rounded border border-slate-200 border-t-4 border-t-[#ef4444] p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>{t("dash.metric.pending_requests")}</span>
                  <div className="w-8 h-8 rounded bg-red-50 flex items-center justify-center text-red-600">
                    <Bell className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-900">{pendingRequests}</div>
                <p className="text-xs text-slate-500 mt-1">{t("dash.metric.awaiting_review")}</p>
              </div>

              <div className="bg-white rounded border border-slate-200 border-t-4 border-t-[#2563eb] p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>{t("dash.metric.total_users")}</span>
                  <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-blue-600">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-900">{totalUsers}</div>
                <p className="text-xs text-slate-500 mt-1">{t("dash.metric.all_roles")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area: Sidebar Menu + Tab Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Tabs defaultValue="events" orientation="vertical" className="flex w-full flex-col gap-6 md:flex-row md:items-start">
            {/* REG MFU / Ant Design Style Left Navigation Menu */}
            <TabsList className="!inline-flex !h-auto sticky top-20 w-full shrink-0 flex-col items-stretch gap-1 rounded border border-slate-200 bg-white p-2 shadow-2xs md:w-64">
              <div className="mb-2 px-3 py-2 border-b border-slate-100">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t("menu.title")}
                </h3>
              </div>
              {[
                { value: "events", icon: Calendar, label: t("menu.events"), badge: events.length },
                { value: "photos", icon: ImageIcon, label: t("menu.photos"), badge: photos.length },
                { value: "low-confidence", icon: AlertCircle, label: t("menu.low_confidence"), badge: unresolvedLowConfidenceCount },
                { value: "requests", icon: Shield, label: t("menu.requests"), badge: removalRequests.length },
                { value: "users", icon: Users, label: t("menu.users"), badge: allUsers.length },
                { value: "health", icon: BarChart3, label: t("menu.health") },
                ...(callerRole === "SUPER_ADMIN"
                  ? [{ value: "audit", icon: FileText, label: t("menu.audit_logs"), badge: auditLogsTotal > 0 ? auditLogsTotal : undefined }]
                  : []),
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="group flex items-center justify-between w-full rounded px-3 py-2.5 text-left text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent data-[state=active]:border-[#82181a] data-[state=active]:bg-[#82181a]/8 data-[state=active]:text-[#82181a] data-[state=active]:font-bold data-[state=active]:shadow-none"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <tab.icon className="w-4 h-4 shrink-0 text-slate-500 group-data-[state=active]:text-[#82181a]" />
                    <span className="truncate">{tab.label}</span>
                  </div>
                  {tab.badge !== undefined && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${tab.value === "requests" && tab.badge > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 w-full min-w-0">
              {/* TAB: EVENTS */}
              <TabsContent value="events" className="mt-0 !outline-none border-0">
                <Card className="border border-slate-200 bg-white rounded shadow-2xs overflow-hidden">
                  <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-800">{t("events.title")}</CardTitle>
                        <CardDescription className="text-xs text-slate-500 mt-0.5">{t("events.desc")}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-72">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            placeholder={t("events.search_placeholder")}
                            value={eventSearch}
                            onChange={(e) => setEventSearch(e.target.value)}
                            className="h-8 border-slate-300 bg-white pl-8 text-xs rounded"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => router.push("/admin/events/create")}
                          className="h-8 bg-[#82181a] hover:bg-[#9c1f22] text-white text-xs px-2.5 rounded shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> {t("events.create_btn")}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="text-center py-12 text-slate-500 text-xs">{t("events.loading")}</div>
                    ) : filteredEvents.length === 0 ? (
                      <div className="py-12 text-center text-slate-500">
                        <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700">{t("events.not_found")}</p>
                        <p className="text-xs text-slate-500 mt-1">{t("events.not_found_desc")}</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                              <TableHead className="text-xs font-bold text-slate-700 uppercase h-10">{t("events.col.name")}</TableHead>
                              <TableHead className="text-xs font-bold text-slate-700 uppercase h-10">{t("events.col.date")}</TableHead>
                              <TableHead className="text-xs font-bold text-slate-700 uppercase h-10">{t("events.col.created")}</TableHead>
                              <TableHead className="text-xs font-bold text-slate-700 uppercase h-10">{t("events.col.status")}</TableHead>
                              <TableHead className="text-right text-xs font-bold text-slate-700 uppercase h-10">{t("events.col.actions")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredEvents.map((event) => (
                              <TableRow key={event.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors h-14">
                                <TableCell className="font-semibold text-slate-800 text-xs">
                                  {event.name}
                                </TableCell>
                                <TableCell className="text-slate-600 text-xs">
                                  {formatDayMonthYear(event.date)}
                                </TableCell>
                                <TableCell className="text-slate-500 text-xs">
                                  {new Date(event.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded capitalize ${getStatusBadge(event.status)}`}>
                                    {event.status === "PUBLISHED" ? t("events.status.published") : event.status === "DRAFT" ? t("events.status.draft") : t("events.status.archived")}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1.5">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => router.push(`/admin/events/${event.id}/edit`)}
                                      className="h-7 px-2.5 text-xs border-slate-300 text-slate-700 hover:text-[#82181a] hover:border-[#82181a] bg-white rounded"
                                    >
                                      <Pencil className="w-3.5 h-3.5 mr-1" />
                                      {t("events.btn.edit")}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEventToDelete(event.id)}
                                      className="h-7 px-2.5 text-xs border-red-200 text-red-600 hover:bg-red-50 bg-white rounded"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                                      {t("events.btn.delete")}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: PHOTOS */}
              <TabsContent value="photos" className="mt-0">
                <Card className="border border-slate-200 bg-white rounded shadow-2xs overflow-hidden">
                  <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-800">{t("photos.title")}</CardTitle>
                        <CardDescription className="text-xs text-slate-500 mt-0.5">{t("photos.desc")} ({filteredPhotos.length} {t("photos.items_count")})</CardDescription>
                      </div>
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          placeholder={t("photos.search_placeholder")}
                          value={photoSearch}
                          onChange={(e) => setPhotoSearch(e.target.value)}
                          className="h-8 border-slate-300 bg-white pl-8 text-xs rounded"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {isLoading ? (
                      <div className="text-center py-12 text-slate-500 text-xs">{t("photos.loading")}</div>
                    ) : filteredPhotos.length === 0 ? (
                      <div className="py-12 text-center text-slate-500">
                        <ImageIcon className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700">{t("photos.not_found")}</p>
                        <p className="text-xs text-slate-500 mt-1">{t("photos.not_found_desc")}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {filteredPhotos.map((photo) => (
                          <div key={photo.id} className="group relative aspect-square overflow-hidden rounded border border-slate-200 bg-slate-100 shadow-2xs">
                            <img
                              src={photo.thumbnailUrl || photo.storageUrl}
                              alt="Event photo"
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setPhotoToDelete(photo.id)}
                                className="h-8 w-8 p-0 rounded shadow-xs"
                                title="Delete Photo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 truncate bg-black/70 p-1.5 text-[11px] text-white">
                              {photo.event?.name || new Date(photo.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TAB: LOW-CONFIDENCE QUEUE */}
              <TabsContent value="low-confidence" className="mt-0">
                <Card className="border border-slate-200 bg-white rounded shadow-2xs overflow-hidden">
                  <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-800">{t("lc.title")}</CardTitle>
                        <CardDescription className="text-xs text-slate-500 mt-0.5">{t("lc.desc")}</CardDescription>
                      </div>
                      <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                        <Input
                          placeholder={t("lc.search_placeholder")}
                          value={lowConfidenceSearch}
                          onChange={(e) => setLowConfidenceSearch(e.target.value)}
                          className="h-8 w-full sm:w-56 border-slate-300 bg-white text-xs rounded"
                        />
                        <select
                          value={String(lowConfidenceThreshold)}
                          onChange={(e) => setLowConfidenceThreshold(Number(e.target.value))}
                          className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700"
                        >
                          <option value="0.65">{t("lc.threshold")} 0.65</option>
                          <option value="0.55">{t("lc.threshold")} 0.55</option>
                          <option value="0.45">{t("lc.threshold")} 0.45</option>
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={refreshLowConfidenceQueue}
                          disabled={lowConfidenceLoading}
                          className="h-8 border-slate-300 text-xs rounded bg-white"
                        >
                          {lowConfidenceLoading ? t("lc.refreshing") : t("lc.refresh")}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {isLoading ? (
                      <div className="text-center py-12 text-slate-500 text-xs">{t("lc.loading")}</div>
                    ) : filteredLowConfidencePhotos.length === 0 ? (
                      <div className="py-12 text-center text-slate-500">
                        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
                        <p className="text-sm font-semibold text-slate-700">{t("lc.clear")}</p>
                        <p className="text-xs text-slate-500 mt-1">{t("lc.clear_desc")}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredLowConfidencePhotos.map((photo) => (
                          <div
                            key={photo.id}
                            className="flex flex-col gap-4 rounded border border-slate-200 bg-white p-3.5 transition-colors hover:border-slate-300 md:flex-row"
                          >
                            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                              <img
                                src={photo.thumbnailUrl || photo.storageUrl}
                                alt="Low confidence photo"
                                className="h-full w-full object-cover"
                              />
                            </div>

                            <div className="flex-1 space-y-1.5">
                              <p className="text-sm font-bold text-slate-800">{photo.eventName || "Untitled"}</p>
                              <p className="text-xs text-slate-500 break-all">{photo.storageUrl}</p>
                              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                                <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 font-semibold text-amber-800 text-[11px]">
                                  {t("lc.min_confidence")} {photo.minConfidence !== null ? Number(photo.minConfidence).toFixed(3) : "N/A"}
                                </span>
                                <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-slate-600 text-[11px]">
                                  {t("lc.lc_faces")} {photo.lowConfidenceFaces}
                                </span>
                                <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-slate-600 text-[11px]">
                                  {t("lc.total_faces")} {photo.totalFaces}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 md:flex-col md:justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openLowConfidenceModal(photo)}
                                className="h-8 px-3 text-xs border-slate-300 rounded bg-white hover:text-[#82181a] hover:border-[#82181a]"
                              >
                                {t("lc.btn.review")}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Low Confidence Review Modal */}
                <Dialog open={isLowConfidenceModalOpen} onOpenChange={(open) => {
                  setIsLowConfidenceModalOpen(open)
                  if (!open) setSelectedLowConfidencePhoto(null)
                }}>
                  <DialogContent className="max-w-3xl rounded-md border border-slate-200 bg-white">
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold text-slate-800">{t("lc.modal.title")}</DialogTitle>
                      <DialogDescription className="text-xs text-slate-500">
                        {selectedLowConfidencePhoto?.eventName || "Untitled"}
                      </DialogDescription>
                    </DialogHeader>

                    {selectedLowConfidencePhoto && (
                      <div className="space-y-3">
                        <div className="overflow-hidden rounded border border-slate-200 bg-slate-900">
                          <img
                            src={selectedLowConfidencePhoto.storageUrl}
                            alt="Low confidence preview"
                            className="h-[360px] w-full object-contain"
                          />
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-600">
                          <p className="break-all text-[11px] text-slate-400">{selectedLowConfidencePhoto.storageUrl}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 font-semibold text-amber-800">
                              {t("lc.min_confidence")} {selectedLowConfidencePhoto.minConfidence !== null ? Number(selectedLowConfidencePhoto.minConfidence).toFixed(3) : "N/A"}
                            </span>
                            <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-slate-600">
                              {t("lc.lc_faces")} {selectedLowConfidencePhoto.lowConfidenceFaces}
                            </span>
                            <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-slate-600">
                              {t("lc.total_faces")} {selectedLowConfidencePhoto.totalFaces}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <DialogFooter className="gap-2 sm:justify-between border-t border-slate-100 pt-3 mt-3">
                      <Button variant="outline" size="sm" onClick={handlePreviewFromModal} className="h-8 text-xs rounded border-slate-300">
                        {t("lc.modal.preview_btn")}
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleDismissFromModal}
                          disabled={lowConfidenceLoading}
                          className="h-8 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {lowConfidenceLoading ? t("lc.modal.approving") : t("lc.modal.approve_btn")}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDeleteFromModal} className="h-8 text-xs rounded">
                          {t("lc.modal.delete_btn")}
                        </Button>
                        <Button size="sm" onClick={handleGoToEventEditFromModal} className="h-8 text-xs rounded bg-[#82181a] hover:bg-[#9c1f22] text-white">
                          {t("lc.modal.goto_event")}
                        </Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* TAB: REMOVAL REQUESTS */}
              <TabsContent value="requests" className="mt-0">
                <Card className="border border-slate-200 bg-white rounded shadow-2xs overflow-hidden">
                  <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
                    <CardTitle className="text-base font-bold text-slate-800">{t("req.title")}</CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">{t("req.desc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    {isLoading ? (
                      <div className="text-center py-12 text-slate-500 text-xs">{t("req.loading")}</div>
                    ) : removalRequests.length === 0 ? (
                      <div className="py-12 text-center text-slate-500">
                        <Shield className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700">{t("req.clear")}</p>
                        <p className="text-xs text-slate-500 mt-1">{t("req.clear_desc")}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {removalRequests.map((request) => (
                          <div key={request.id} className="flex flex-col gap-4 rounded border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 md:flex-row">
                            {request.photo && (
                              <div className="h-28 w-28 flex-shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                                <img
                                  src={request.photo.url}
                                  alt="Requested photo"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1 space-y-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-slate-800">
                                    {request.photo?.eventName || "Untitled"}
                                  </p>
                                  {request.photo?.faceCount !== undefined && (
                                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                                      request.photo.faceCount <= 1
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : "bg-blue-100 text-blue-800 border border-blue-200"
                                    }`}>
                                      {request.photo.faceCount <= 1 ? "Solo Photo (1 Face)" : `Group Photo (${request.photo.faceCount} Faces)`}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {t("req.requested_by")} <span className="font-semibold text-slate-700">{request.userName}</span> {t("req.on_date")}{" "}
                                  {new Date(request.createdAt).toLocaleDateString()} {t("req.at_time")}{" "}
                                  {new Date(request.createdAt).toLocaleTimeString()}
                                </p>
                              </div>
                              {request.reason && (
                                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs">
                                  <p className="font-bold text-slate-500 uppercase tracking-wide text-[10px] mb-0.5">{t("req.reason_label")}</p>
                                  <p className="text-slate-800">{request.reason}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex md:flex-col gap-2 justify-center shrink-0">
                              {/* If group photo (2+ faces), prioritize Blur Face */}
                              {request.photo && request.photo.faceCount > 1 && request.faceCoordinates ? (
                                <Button
                                  size="sm"
                                  onClick={() => setBlurRequestItem({ requestId: request.id, photoId: request.photoId, bboxes: request.faceCoordinates })}
                                  disabled={requestProcessingId === request.id}
                                  className="h-8 text-xs rounded bg-[#82181a] hover:bg-[#6b1416] text-white disabled:opacity-60"
                                >
                                  {requestProcessingId === request.id ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                      {t("req.processing")}
                                    </>
                                  ) : (
                                    t("req.btn.approve_blur")
                                  )}
                                </Button>
                              ) : (
                                /* If solo photo (1 face) or no coordinates, approve Delete */
                                <Button
                                  size="sm"
                                  onClick={() => setApproveRequestItem({ requestId: request.id, photoId: request.photoId })}
                                  disabled={requestProcessingId === request.id}
                                  className="h-8 text-xs rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                                >
                                  {requestProcessingId === request.id ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                      {t("req.processing")}
                                    </>
                                  ) : (
                                    t("req.btn.approve_delete")
                                  )}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRejectRequestItem(request.id)}
                                disabled={requestProcessingId === request.id}
                                className="h-8 text-xs rounded border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                {requestProcessingId === request.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    {t("req.processing")}
                                  </>
                                ) : (
                                  t("req.btn.reject")
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

              {/* TAB: USER MANAGEMENT */}
              <TabsContent value="users" className="mt-0">
                <div className="space-y-4">
                  {userMgmtMessage && (
                    <div className={`flex gap-2.5 p-3 rounded border text-xs ${
                      userMgmtMessage.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
                    }`}>
                      {userMgmtMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                      <p>{userMgmtMessage.text}</p>
                    </div>
                  )}

                  {/* Add Photographer */}
                  <Card className="border border-slate-200 bg-white rounded shadow-2xs">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Camera className="w-4 h-4 text-[#82181a]" /> {t("users.add_photographer.title")}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        {t("users.add_photographer.desc")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder={t("users.add_photographer.placeholder")}
                          value={newPhotographerEmail}
                          onChange={(e) => setNewPhotographerEmail(e.target.value)}
                          className="h-8 text-xs border-slate-300 rounded"
                        />
                        <Button
                          disabled={userMgmtLoading || !newPhotographerEmail}
                          className="h-8 text-xs bg-[#82181a] hover:bg-[#9c1f22] text-white rounded shrink-0"
                          onClick={async () => {
                            setUserMgmtLoading(true)
                            setUserMgmtMessage(null)
                            const res = await apiClient.setUserRole(newPhotographerEmail, "PHOTOGRAPHER")
                            if (res.error) {
                              setUserMgmtMessage({ type: "error", text: res.error })
                            } else {
                              setUserMgmtMessage({ type: "success", text: `Assigned ${newPhotographerEmail} as photographer` })
                              setNewPhotographerEmail("")
                              const usersRes = await apiClient.getAdminUsers()
                              if (usersRes.data) setAllUsers(usersRes.data.users || [])
                            }
                            setUserMgmtLoading(false)
                          }}
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1.5" /> {t("users.add_photographer.btn")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Add Admin (Super Admin only) */}
                  {callerRole === "SUPER_ADMIN" && (
                    <Card className="border border-slate-200 bg-white rounded shadow-2xs">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Crown className="w-4 h-4 text-[#c59b27]" /> {t("users.add_admin.title")}
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          {t("users.add_admin.desc")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder={t("users.add_admin.placeholder")}
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            className="h-8 text-xs border-slate-300 rounded"
                          />
                          <Button
                            disabled={userMgmtLoading || !newAdminEmail}
                            className="h-8 text-xs bg-[#82181a] hover:bg-[#9c1f22] text-white rounded shrink-0"
                            onClick={async () => {
                              setUserMgmtLoading(true)
                              setUserMgmtMessage(null)
                              const res = await apiClient.setUserRole(newAdminEmail, "ADMIN")
                              if (res.error) {
                                setUserMgmtMessage({ type: "error", text: res.error })
                              } else {
                                setUserMgmtMessage({ type: "success", text: `Assigned ${newAdminEmail} as admin` })
                                setNewAdminEmail("")
                                const usersRes = await apiClient.getAdminUsers()
                                if (usersRes.data) setAllUsers(usersRes.data.users || [])
                              }
                              setUserMgmtLoading(false)
                            }}
                          >
                            <UserPlus className="w-3.5 h-3.5 mr-1.5" /> {t("users.add_admin.btn")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* User List in REG MFU Table Format */}
                  <Card className="border border-slate-200 bg-white rounded shadow-2xs overflow-hidden">
                    <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-base font-bold text-slate-800">{t("users.title")}</CardTitle>
                          <CardDescription className="text-xs text-slate-500 mt-0.5">{allUsers.length} {t("users.desc")}</CardDescription>
                        </div>
                        <div className="relative w-full sm:w-72">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            type="search"
                            placeholder={t("users.search_placeholder")}
                            className="h-8 pl-8 text-xs border-slate-300 rounded bg-white"
                            value={userSearchQuery}
                            onChange={(e) => {
                              setUserSearchQuery(e.target.value)
                              setUserPage(1)
                            }}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                              <TableHead className="w-[40%] text-xs font-bold text-slate-700 uppercase h-10">{t("users.col.details")}</TableHead>
                              <TableHead className="w-[18%] text-xs font-bold text-slate-700 uppercase h-10">{t("users.col.status")}</TableHead>
                              <TableHead className="w-[20%] text-xs font-bold text-slate-700 uppercase h-10">{t("users.col.role")}</TableHead>
                              <TableHead className="text-right text-xs font-bold text-slate-700 uppercase h-10">{t("users.col.actions")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAndSortedUsers.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-slate-500 text-xs">
                                  <Users className="h-6 w-6 mx-auto mb-2 text-slate-400" />
                                  <p className="font-medium text-slate-700">{t("users.not_found")}</p>
                                  <p className="mt-0.5">{t("users.not_found_desc")}</p>
                                </TableCell>
                              </TableRow>
                            ) : (
                              paginatedUsers.map((u) => {
                                const isSuperAdmin = u.role === "SUPER_ADMIN"
                                const isAdmin = u.role === "ADMIN"
                                const isPhotographer = u.role === "PHOTOGRAPHER"
                                const isStudentEmail = u.email.endsWith("@lamduan.mfu.ac.th") || u.email.endsWith("@mfu.ac.th")
                                
                                const canDemote = (() => {
                                  if (isSuperAdmin) return false
                                  if (!isStudentEmail) return false
                                  if (isAdmin) return callerRole === "SUPER_ADMIN"
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
                                  SUPER_ADMIN: "bg-amber-50 text-amber-800 border-amber-300",
                                  ADMIN: "bg-blue-50 text-blue-700 border-blue-200",
                                  PHOTOGRAPHER: "bg-emerald-50 text-emerald-800 border-emerald-300",
                                  STUDENT: "bg-slate-100 text-slate-700 border-slate-300",
                                } as Record<string, string>)[u.role] || "bg-slate-100 text-slate-700 border-slate-300"
        
                                const roleLabel = {
                                  SUPER_ADMIN: t("role.super_admin"),
                                  ADMIN: t("role.admin"),
                                  PHOTOGRAPHER: t("role.photographer"),
                                  STUDENT: t("role.student"),
                                }[u.role as string] || u.role
        
                                return (
                                  <TableRow key={u.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors h-14">
                                    <TableCell className="align-middle">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 overflow-hidden shrink-0">
                                          {u.avatarUrl ? (
                                            <img src={u.avatarUrl} alt={u.name || "Avatar"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          ) : (
                                            u.name?.[0]?.toUpperCase() || u.email[0].toUpperCase()
                                          )}
                                        </div>
                                        <div className="flex flex-col max-w-[200px] sm:max-w-xs truncate">
                                          <span className="text-xs font-bold text-slate-800 truncate">{u.name || "User"}</span>
                                          <span className="text-[11px] text-slate-500 truncate">{u.email}</span>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="align-middle">
                                      {!u.isActive ? (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 font-medium text-[11px]">
                                          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                          {t("users.status.blocked")}
                                        </div>
                                      ) : (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium text-[11px]">
                                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                          {t("users.status.active")}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="align-middle">
                                      <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border text-[11px] font-semibold ${roleBadge}`}>
                                        {isSuperAdmin && <Crown className="w-3 h-3" />}
                                        {roleLabel}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right align-middle">
                                      <div className="flex justify-end gap-1.5">
                                        {canToggleStatus && u.email !== callerEmail && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className={`h-7 px-2 text-xs rounded border ${u.isActive ? "bg-amber-50/50 text-amber-700 border-amber-200 hover:bg-amber-100" : "bg-emerald-50/50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
                                            disabled={userMgmtLoading}
                                            onClick={() => setUserStatusToToggle(u)}
                                            title={u.isActive ? t("users.btn.block") : t("users.btn.unblock")}
                                          >
                                            {u.isActive ? <Ban className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
                                            {u.isActive ? t("users.btn.block") : t("users.btn.unblock")}
                                          </Button>
                                        )}
                                        
                                        {canDemote && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs rounded border-slate-300 text-slate-700 hover:bg-slate-100"
                                            disabled={userMgmtLoading}
                                            onClick={() => setUserToDemote(u)}
                                            title={t("users.btn.demote")}
                                          >
                                            <UserMinus className="w-3 h-3 mr-1" />
                                            {t("users.btn.demote")}
                                          </Button>
                                        )}
    
                                        {canPermanentlyRemove && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs rounded border-red-200 text-red-600 hover:bg-red-50"
                                            disabled={userMgmtLoading}
                                            onClick={() => setUserToRemove(u)}
                                            title={t("users.btn.delete")}
                                          >
                                            <Trash2 className="w-3 h-3 mr-1" />
                                            {t("users.btn.delete")}
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

                      {/* Pagination Footer */}
                      {userTotalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-600">
                          <span>
                            Showing {paginatedUsers.length} of {filteredAndSortedUsers.length} users (Page {userPage} of {userTotalPages})
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setUserPage((prev) => Math.max(1, prev - 1))}
                              disabled={userPage <= 1}
                              className="h-7 text-xs px-2.5 rounded border-slate-300"
                            >
                              Previous
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setUserPage((prev) => Math.min(userTotalPages, prev + 1))}
                              disabled={userPage >= userTotalPages}
                              className="h-7 text-xs px-2.5 rounded border-slate-300"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Danger Zone: Wipe Old Reference Selfies */}
                  <Card className="border border-slate-200 border-t-4 border-t-red-600 bg-white rounded shadow-2xs">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm font-bold text-red-700 flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-red-600" /> {t("health.danger.title")}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        {t("health.danger.desc")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-red-200 bg-red-50/50 rounded gap-3">
                        <div>
                          <p className="font-bold text-xs text-slate-800">{t("health.danger.wipe_title")}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{t("health.danger.wipe_desc")}</p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowCleanOldSelfiesModal(true)}
                          className="h-8 text-xs rounded shrink-0 bg-red-600 hover:bg-red-700"
                        >
                          {t("health.danger.wipe_btn")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* TAB: SYSTEM HEALTH */}
              <TabsContent value="health" className="mt-0">
                <div className="space-y-4">
                  <Card className="border border-slate-200 bg-white rounded shadow-2xs p-4">
                    <SystemHealth />
                  </Card>
                </div>
              </TabsContent>

              {/* TAB: AUDIT LOGS (Super Admin Only) */}
              {callerRole === "SUPER_ADMIN" && (
                <TabsContent value="audit" className="mt-0">
                  <div className="space-y-4">
                    <Card className="border border-slate-200 bg-white rounded shadow-2xs overflow-hidden">
                      {/* Top Header */}
                      <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#82181a]" />
                              {t("audit.title")}
                              {auditLogsTotal > 0 && (
                                <span className="text-[11px] font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                                  {auditLogsTotal}
                                </span>
                              )}
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500 mt-0.5">
                              {t("audit.desc")}
                            </CardDescription>
                          </div>
                          
                          {/* Export CSV Button (Primary Action) */}
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={handleExportAuditLogsCsv}
                              disabled={isExportingCsv || auditLogs.length === 0}
                              className="h-8 bg-[#82181a] hover:bg-[#9c1f22] text-white text-xs px-3 rounded shrink-0 font-medium"
                            >
                              {isExportingCsv ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                  Exporting...
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5 mr-1.5" />
                                  {t("audit.export_csv")}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      {/* PDPA 90-Day Retention Notice Banner */}
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50/70 border-b border-amber-200/60 text-xs text-amber-800">
                        <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-medium text-[11px] leading-tight">{t("audit.retention_notice")}</span>
                      </div>

                      {/* Filter & Search Toolbar */}
                      <div className="px-4 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                          {/* Search Input */}
                          <div className="relative w-full sm:max-w-[280px]">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <Input
                              type="search"
                              placeholder={t("audit.search_placeholder")}
                              value={auditSearchQuery}
                              onChange={(e) => {
                                setAuditSearchQuery(e.target.value)
                                setAuditPage(1)
                                fetchAuditLogs(auditCategoryFilter, e.target.value, 1)
                              }}
                              className="h-8 pl-8 text-xs border-slate-300 rounded bg-white w-full shadow-2xs"
                            />
                          </div>

                          {/* Category Dropdown Filter */}
                          <Select
                            value={auditCategoryFilter}
                            onValueChange={(val) => {
                              setAuditCategoryFilter(val)
                              setAuditPage(1)
                              fetchAuditLogs(val, auditSearchQuery, 1)
                            }}
                          >
                            <SelectTrigger size="sm" className="w-full sm:w-[180px] h-8 text-xs border-slate-300 bg-white rounded shadow-2xs">
                              <div className="flex items-center">
                                <Filter className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                                <SelectValue placeholder={t("audit.category_all")} />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="text-xs">
                              <SelectItem value="ALL">{t("audit.category_all")}</SelectItem>
                              <SelectItem value="BIOMETRICS">{t("audit.category_biometrics")}</SelectItem>
                              <SelectItem value="USER_MGMT">{t("audit.category_users")}</SelectItem>
                              <SelectItem value="CONTENT">{t("audit.category_content")}</SelectItem>
                              <SelectItem value="SECURITY">{t("audit.category_security")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Refresh Button */}
                        <div className="flex items-center justify-end shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchAuditLogs(auditCategoryFilter, auditSearchQuery, auditPage)}
                            disabled={auditLogsLoading}
                            className="h-8 px-3 text-xs rounded border-slate-300 hover:bg-slate-50 flex items-center shadow-2xs"
                            title="Refresh logs"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${auditLogsLoading ? "animate-spin" : ""}`} />
                            Refresh
                          </Button>
                        </div>
                      </div>

                      {/* CardContent: Full Bleed Table (p-0) */}
                      <CardContent className="p-0">
                        {/* Mobile Card View (hidden on md and larger) */}
                        <div className="divide-y divide-slate-100 block md:hidden">
                          {auditLogsLoading ? (
                            <div className="py-12 text-center text-slate-500">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#82181a] mb-2" />
                              <p className="text-xs">Loading audit logs...</p>
                            </div>
                          ) : auditLogs.length === 0 ? (
                            <div className="py-12 text-center text-slate-500">
                              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                              <p className="text-xs font-medium text-slate-700">{t("audit.empty")}</p>
                            </div>
                          ) : (
                            auditLogs.map((log) => {
                              const isDestructive = ["WIPE_ALL_SELFIES", "PERMANENTLY_REMOVE_USER", "DELETE_PHOTO", "BLOCK_USER"].includes(log.action)
                              const isWarning = ["SET_USER_ROLE", "UNBLOCK_USER", "BLUR_PHOTO_FACE"].includes(log.action)
                              const isBiometrics = ["WIPE_ALL_SELFIES", "REGISTER_FACE", "FACE_SEARCH"].includes(log.action)

                              return (
                                <div key={log.id} className="p-4 space-y-2 text-xs bg-white">
                                  <div className="flex items-center justify-between gap-2">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        isDestructive
                                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                                          : isWarning
                                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                                          : isBiometrics
                                          ? "bg-sky-50 text-sky-700 border border-sky-200"
                                          : "bg-slate-100 text-slate-700 border border-slate-200"
                                      }`}
                                    >
                                      {log.action}
                                    </span>
                                    <span className="font-mono text-[10px] text-slate-400">
                                      {new Date(log.createdAt).toLocaleString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-500 font-medium">Actor:</span>
                                    <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                                      {log.actorEmail} ({log.actorRole || "USER"})
                                    </span>
                                  </div>
                                  {log.targetLabel && (
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-slate-500 font-medium">Target:</span>
                                      <span className="text-slate-700 truncate max-w-[200px]">{log.targetLabel}</span>
                                    </div>
                                  )}
                                  {log.details && (
                                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 leading-relaxed">
                                      {log.details}
                                    </p>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>

                        {/* Desktop & Tablet Table View */}
                        <div className="hidden md:block overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">
                                <TableHead className="w-[15%] text-xs font-bold text-slate-700 uppercase h-10 px-4">{t("audit.col_time")}</TableHead>
                                <TableHead className="w-[23%] text-xs font-bold text-slate-700 uppercase h-10 px-4">{t("audit.col_actor")}</TableHead>
                                <TableHead className="w-[18%] text-xs font-bold text-slate-700 uppercase h-10 px-4">{t("audit.col_action")}</TableHead>
                                <TableHead className="w-[18%] text-xs font-bold text-slate-700 uppercase h-10 px-4">{t("audit.col_target")}</TableHead>
                                <TableHead className="w-[26%] text-xs font-bold text-slate-700 uppercase h-10 px-4">{t("audit.col_details")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-slate-100">
                              {auditLogsLoading ? (
                                <TableRow>
                                  <TableCell colSpan={5} className="h-44 text-center text-slate-500 text-xs">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#82181a] mb-2" />
                                    <p className="text-xs">Loading audit logs...</p>
                                  </TableCell>
                                </TableRow>
                              ) : auditLogs.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={5} className="h-44 text-center text-slate-500 text-xs">
                                    <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                    <p className="font-semibold text-slate-700">{t("audit.empty")}</p>
                                    <p className="text-slate-400 text-[11px] mt-0.5">No administrative actions have been logged for this filter.</p>
                                  </TableCell>
                                </TableRow>
                              ) : (
                                auditLogs.map((log) => {
                                  const isDestructive = ["WIPE_ALL_SELFIES", "PERMANENTLY_REMOVE_USER", "DELETE_PHOTO", "BLOCK_USER"].includes(log.action)
                                  const isWarning = ["SET_USER_ROLE", "UNBLOCK_USER", "BLUR_PHOTO_FACE"].includes(log.action)
                                  const isBiometrics = ["WIPE_ALL_SELFIES", "REGISTER_FACE", "FACE_SEARCH"].includes(log.action)

                                  return (
                                    <TableRow key={log.id} className="hover:bg-slate-50/70 text-xs transition-colors">
                                      {/* Timestamp */}
                                      <TableCell className="px-4 py-3">
                                        <div className="flex flex-col">
                                          <span className="text-xs font-medium text-slate-800">
                                            {new Date(log.createdAt).toLocaleDateString(undefined, {
                                              month: "short",
                                              day: "numeric",
                                              year: "numeric",
                                            })}
                                          </span>
                                          <span className="text-[10px] font-mono text-slate-400">
                                            {new Date(log.createdAt).toLocaleTimeString(undefined, {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                              second: "2-digit",
                                              hour12: false,
                                            })}
                                          </span>
                                        </div>
                                      </TableCell>

                                      {/* Actor */}
                                      <TableCell className="px-4 py-3">
                                        <div className="flex flex-col min-w-0">
                                          <span className="font-semibold text-slate-800 truncate text-xs" title={log.actorEmail}>
                                            {log.actorEmail}
                                          </span>
                                          {log.actorRole && (
                                            <span className="text-[10px] font-mono text-slate-400">
                                              {log.actorRole}
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>

                                      {/* Action */}
                                      <TableCell className="px-4 py-3">
                                        <span
                                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                            isDestructive
                                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                                              : isWarning
                                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                                              : isBiometrics
                                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                                              : "bg-slate-100 text-slate-700 border border-slate-200"
                                          }`}
                                        >
                                          {log.action}
                                        </span>
                                      </TableCell>

                                      {/* Target */}
                                      <TableCell className="px-4 py-3">
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-xs font-medium text-slate-800 truncate" title={log.targetLabel || log.targetType || "—"}>
                                            {log.targetLabel || log.targetType || "—"}
                                          </span>
                                          {log.targetLabel && log.targetType && (
                                            <span className="text-[10px] text-slate-400 font-mono">
                                              {log.targetType}
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>

                                      {/* Details */}
                                      <TableCell className="px-4 py-3 text-slate-600 text-xs leading-relaxed">
                                        <span title={log.details || ""}>
                                          {log.details || "—"}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Pagination Footer */}
                        {auditTotalPages > 1 && (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-600">
                            <span>
                              Showing {auditLogs.length} of {auditLogsTotal} logs (Page {auditPage} of {auditTotalPages})
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const next = Math.max(1, auditPage - 1)
                                  setAuditPage(next)
                                  fetchAuditLogs(auditCategoryFilter, auditSearchQuery, next)
                                }}
                                disabled={auditPage <= 1}
                                className="h-7 text-xs px-2.5 rounded border-slate-300"
                              >
                                Previous
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const next = Math.min(auditTotalPages, auditPage + 1)
                                  setAuditPage(next)
                                  fetchAuditLogs(auditCategoryFilter, auditSearchQuery, next)
                                }}
                                disabled={auditPage >= auditTotalPages}
                                className="h-7 text-xs px-2.5 rounded border-slate-300"
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              )}
            </div>
          </Tabs>
        </div>
      </main>

      {/* Delete Photo Confirmation Modal */}
      <ConfirmationModal
        open={!!photoToDelete}
        onOpenChange={(open) => !open && setPhotoToDelete(null)}
        title="Delete Photo"
        description="Are you sure you want to delete this photo? This will permanently remove the photo file and all facial match embeddings."
        confirmText="Delete Photo"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeletingPhoto}
        onConfirm={confirmDeletePhoto}
      />

      {/* Delete Event Confirmation Modal */}
      <ConfirmationModal
        open={!!eventToDelete}
        onOpenChange={(open) => !open && setEventToDelete(null)}
        title="Delete Event"
        description="Are you sure you want to delete this event? This will also permanently remove all photos associated with this event."
        confirmText="Delete Event"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeletingEvent}
        onConfirm={confirmDeleteEvent}
      />

      {/* Approve Removal Request (Delete Photo) Modal */}
      <ConfirmationModal
        open={!!approveRequestItem}
        onOpenChange={(open) => !open && setApproveRequestItem(null)}
        title="Approve Removal Request (Delete Photo)"
        description="Are you sure you want to approve this privacy removal request? The photo will be permanently deleted from the system and event gallery."
        confirmText="Approve & Delete Photo"
        cancelText="Cancel"
        variant="destructive"
        isLoading={!!requestProcessingId}
        onConfirm={confirmApproveRequest}
      />

      {/* Reject Removal Request Modal */}
      <ConfirmationModal
        open={!!rejectRequestItem}
        onOpenChange={(open) => !open && setRejectRequestItem(null)}
        title="Reject Removal Request"
        description="Are you sure you want to reject this removal request? The photo will remain published in the event gallery."
        confirmText="Reject Request"
        cancelText="Cancel"
        variant="warning"
        isLoading={!!requestProcessingId}
        onConfirm={confirmRejectRequest}
      />

      {/* Blur Face on Photo Modal */}
      <ConfirmationModal
        open={!!blurRequestItem}
        onOpenChange={(open) => !open && setBlurRequestItem(null)}
        title="Blur Face on Photo"
        description="Are you sure you want to apply AI facial blurring to this photo? The requested face will be permanently blurred."
        confirmText="Blur Photo"
        cancelText="Cancel"
        variant="destructive"
        isLoading={!!requestProcessingId}
        onConfirm={confirmBlurRequest}
      />

      {/* Clean Up Old Selfies Modal */}
      <ConfirmationModal
        open={showCleanOldSelfiesModal}
        onOpenChange={setShowCleanOldSelfiesModal}
        title="Permanently Wipe All Old Selfies"
        description="WARNING: This will permanently delete ALL registered student profile selfies and facial vectors from the database. All students will be required to re-verify identity."
        confirmText="Wipe All Selfies"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isCleaningSelfies}
        requireMatchText="WIPE"
        matchPlaceholder="Type WIPE to confirm"
        onConfirm={confirmCleanUpOldSelfies}
      />

      {/* Block / Unblock User Modal */}
      <ConfirmationModal
        open={!!userStatusToToggle}
        onOpenChange={(open) => !open && setUserStatusToToggle(null)}
        title={userStatusToToggle?.isActive ? "Block User" : "Unblock User"}
        description={
          userStatusToToggle?.isActive
            ? `Are you sure you want to block access for ${userStatusToToggle?.email}? They will not be able to log in.`
            : `Are you sure you want to unblock access for ${userStatusToToggle?.email}?`
        }
        confirmText={userStatusToToggle?.isActive ? "Block User" : "Unblock User"}
        cancelText="Cancel"
        variant={userStatusToToggle?.isActive ? "destructive" : "default"}
        isLoading={userMgmtLoading}
        onConfirm={confirmToggleUserStatus}
      />

      {/* Demote User Modal */}
      <ConfirmationModal
        open={!!userToDemote}
        onOpenChange={(open) => !open && setUserToDemote(null)}
        title="Demote User Role"
        description={`Are you sure you want to demote ${userToDemote?.email} back to standard student role? They will lose access to privileged dashboards.`}
        confirmText="Demote User"
        cancelText="Cancel"
        variant="warning"
        isLoading={userMgmtLoading}
        onConfirm={confirmDemoteUser}
      />

      {/* Permanently Remove User Modal */}
      <ConfirmationModal
        open={!!userToRemove}
        onOpenChange={(open) => !open && setUserToRemove(null)}
        title="Permanently Remove User"
        description={`Warning: This action will permanently remove ${userToRemove?.email} from the administrator/photographer roster.`}
        confirmText="Delete User"
        cancelText="Cancel"
        variant="destructive"
        isLoading={userMgmtLoading}
        requireMatchText="REMOVE"
        matchPlaceholder="Type REMOVE to confirm"
        onConfirm={confirmRemoveUser}
      />
    </>
  )
}
