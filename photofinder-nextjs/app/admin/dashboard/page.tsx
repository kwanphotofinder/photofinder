"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Search, Plus, Calendar, Image as ImageIcon, Trash2, BarChart3, Users, Bell, Shield, AlertCircle, CheckCircle2, Pencil, UserPlus, Crown, Camera, Inbox } from "lucide-react"
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

  // User management state
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [callerRole, setCallerRole] = useState("")
  const [newPhotographerEmail, setNewPhotographerEmail] = useState("")
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [userMgmtLoading, setUserMgmtLoading] = useState(false)
  const [userMgmtMessage, setUserMgmtMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    const adminToken = localStorage.getItem("admin_token")
    if (!adminToken) {
      router.push("/login")
      return
    }

    const storedName = localStorage.getItem("admin_name")
    if (storedName) {
      setAdminName(storedName)
    }

    const fetchData = async () => {
      try {
        const [eventsRes, photosRes, requestsRes] = await Promise.all([
          apiClient.getEvents(),
          apiClient.getAllPhotos(),
          apiClient.getRemovalRequests()
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

        // Fetch users for user management
        const usersRes = await apiClient.getAdminUsers()
        if (usersRes.data) {
          setAllUsers(usersRes.data.users || [])
          setCallerRole(usersRes.data.callerRole || "")
        }
      } catch (error) {
        console.error("Failed to fetch data", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [router])

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) return

    try {
      await apiClient.deletePhoto(photoId)
      setPhotos(photos.filter(p => p.id !== photoId))
    } catch (error) {
      console.error("Failed to delete photo", error)
      alert("Failed to delete photo")
    }
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
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    if (!confirm("Are you sure you want to reject this removal request?")) return

    try {
      await apiClient.deleteRemovalRequest(requestId)
      setRemovalRequests(removalRequests.filter(r => r.id !== requestId))
      alert("Request rejected")
    } catch (error) {
      console.error("Failed to reject request", error)
      alert("Failed to reject request")
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      DRAFT: "bg-secondary text-secondary-foreground",
      PUBLISHED: "bg-primary text-primary-foreground",
      ARCHIVED: "bg-muted text-muted-foreground",
    }
    return styles[status as keyof typeof styles] || styles.DRAFT
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
      <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(130,24,26,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(130,24,26,0.08),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.98),rgba(248,250,252,1))]">
        <div className="pointer-events-none absolute -top-20 -left-12 h-64 w-64 rounded-full bg-[#82181a]/12 blur-3xl" />
        <div className="pointer-events-none absolute top-36 right-0 h-72 w-72 rounded-full bg-[#82181a]/10 blur-3xl" />

        <div className="relative border-b border-border/60 bg-card/75 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
                <p className="text-muted-foreground mt-1">Welcome back, {adminName}</p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => router.push("/admin/events/create")}
                  className="bg-gradient-to-r from-[#82181a] to-[#a8252d] text-primary-foreground shadow-md shadow-[#82181a]/25 hover:from-[#82181a]/90 hover:to-[#a8252d]/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Event
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border border-border/70 bg-card/85 shadow-sm backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                    Active Events
                    <Calendar className="h-4 w-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{activeEvents}</div>
                  <p className="text-xs text-muted-foreground mt-1">currently published</p>
                </CardContent>
              </Card>

              <Card className="border border-border/70 bg-card/85 shadow-sm backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                    Total Events
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{events.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">all time</p>
                </CardContent>
              </Card>

              <Card className="border border-border/70 bg-card/85 shadow-sm backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                    Pending Requests
                    <Bell className="h-4 w-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{pendingRequests}</div>
                  <p className="text-xs text-muted-foreground mt-1">awaiting moderation</p>
                </CardContent>
              </Card>

              <Card className="border border-border/70 bg-card/85 shadow-sm backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                    Registered Users
                    <Users className="h-4 w-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{totalUsers}</div>
                  <p className="text-xs text-muted-foreground mt-1">all roles combined</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8 items-start">
          <Tabs defaultValue="events" orientation="vertical" className="flex w-full flex-col gap-8 md:flex-row md:items-start">
            <TabsList className="!inline-flex !h-auto sticky top-24 h-auto w-full shrink-0 flex-col items-stretch gap-2 rounded-2xl border border-border/70 bg-card/75 p-4 shadow-sm backdrop-blur-md md:w-64 lg:w-72">
              <div className="mb-2 border-b border-border/60 px-2 pb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Dashboard Menu
                </h3>
              </div>
              {[
                { value: "events", icon: Calendar, label: "Events", badge: events.length, desc: "Manage campus events" },
                { value: "photos", icon: ImageIcon, label: "Photos", badge: photos.length, desc: "View all uploads" },
                { value: "requests", icon: Shield, label: `Removal Requests`, badge: removalRequests.length, desc: "Pending review" },
                { value: "users", icon: Users, label: "User Management", desc: "Roles & access" },
                { value: "health", icon: BarChart3, label: "System Health", desc: "Metrics & logs" },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="group relative !h-auto w-full overflow-hidden rounded-xl border border-transparent px-4 py-3 text-left font-medium transition-all duration-200 hover:bg-muted data-[state=active]:border-primary/30 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-data-[state=active]:scale-y-100 transition-transform origin-left rounded-r-md"></div>
                  <tab.icon className="w-5 h-5 mr-3 shrink-0 text-muted-foreground group-data-[state=active]:text-primary transition-colors" />
                  <div className="flex flex-col flex-1 truncate">
                    <span className="text-sm font-semibold truncate">{tab.label}</span>
                    <span className="text-xs font-normal text-muted-foreground group-data-[state=active]:text-primary/70 truncate">{tab.desc}</span>
                  </div>
                  {tab.badge !== undefined && (
                    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${tab.value === "requests" && tab.badge > 0 ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}>
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 w-full min-w-0">
              <TabsContent value="events" className="mt-0 !outline-none border-0">
                <Card className="border border-border/70 bg-card/85 shadow-sm backdrop-blur-md">
                  <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Events</CardTitle>
                      <CardDescription>Manage your campus events</CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search events..."
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        className="border-border/70 bg-background/80 pl-8"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading events...</div>
                  ) : filteredEvents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-12 text-center">
                      <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">No events found</p>
                      <p className="mt-1 text-sm text-muted-foreground">Try another keyword or create a new event.</p>
                      <Button onClick={() => router.push("/admin/events/create")} className="mt-4 bg-gradient-to-r from-[#82181a] to-[#a8252d] text-primary-foreground hover:from-[#82181a]/90 hover:to-[#a8252d]/90">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Event
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredEvents.map((event, index) => (
                        <div key={event.id} className="animate-in fade-in-0 slide-in-from-bottom-2 flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 duration-300 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm md:flex-row md:items-center md:justify-between" style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-foreground">{event.name}</h3>
                              <span
                                className={`text-xs font-semibold px-2 py-1 rounded capitalize ${getStatusBadge(event.status)}`}
                              >
                                {event.status.toLowerCase()}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Date</p>
                                <p className="font-medium text-foreground">{new Date(event.date).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Created</p>
                                <p className="font-medium text-foreground">{new Date(event.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/admin/events/${event.id}/edit`)}
                              className="border-border/70 bg-background/80"
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteEvent(event.id)}
                              className="shadow-sm"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="photos" className="mt-0">
              <Card className="border border-border/70 bg-card/85 shadow-sm backdrop-blur-md">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>All Photos</CardTitle>
                      <CardDescription>Manage all uploaded photos ({filteredPhotos.length})</CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by event or filename..."
                        value={photoSearch}
                        onChange={(e) => setPhotoSearch(e.target.value)}
                        className="border-border/70 bg-background/80 pl-8"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading photos...</div>
                  ) : filteredPhotos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-12 text-center">
                      <ImageIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">No photos found</p>
                      <p className="mt-1 text-sm text-muted-foreground">Uploaded photos will appear here for moderation.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {filteredPhotos.map((photo, index) => (
                        <div key={photo.id} className="animate-in fade-in-0 zoom-in-95 group relative aspect-square overflow-hidden rounded-xl border border-border/70 bg-muted shadow-sm duration-300 transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: `${Math.min(index * 25, 250)}ms` }}>
                          <img
                            src={photo.thumbnailUrl || photo.storageUrl}
                            alt="Event photo"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/70 to-black/35 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeletePhoto(photo.id)}
                              className="h-8 w-8 p-0 shadow-md"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 truncate bg-black/60 p-2 text-xs text-white">
                            {photo.event?.name || new Date(photo.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="requests" className="mt-0">
              <Card className="border border-border/70 bg-card/85 shadow-sm backdrop-blur-md">
                <CardHeader>
                  <CardTitle>Removal Requests</CardTitle>
                  <CardDescription>Review and manage photo removal requests from users</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading requests...</div>
                  ) : removalRequests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-12 text-center">
                      <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">No pending removal requests</p>
                      <p className="mt-1 text-sm text-muted-foreground">Requests submitted by users will appear in this queue.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {removalRequests.map((request) => (
                        <div key={request.id} className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-sm md:flex-row">
                          {request.photo && (
                            <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted">
                              <img
                                src={request.photo.url}
                                alt="Requested photo"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 space-y-2">
                            <div>
                              <p className="font-semibold text-foreground">
                                {request.photo?.eventName || "Unknown Event"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Requested by <span className="font-medium">{request.userName}</span> on{" "}
                                {new Date(request.createdAt).toLocaleDateString()} at{" "}
                                {new Date(request.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                            {request.reason && (
                              <div className="p-3 bg-muted rounded-md">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reason</p>
                                <p className="text-sm text-foreground">{request.reason}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex md:flex-col gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveRequest(request.id, request.photoId)}
                              className="flex-1 bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 md:flex-none"
                            >
                              Approve & Delete
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectRequest(request.id)}
                              className="flex-1 md:flex-none"
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="mt-0">
              <div className="space-y-6">
                {userMgmtMessage && (
                  <div className={`flex gap-3 p-4 rounded-lg border ${
                    userMgmtMessage.type === "success" ? "bg-primary/10 border-primary/20" : "bg-destructive/10 border-destructive/20"
                  }`}>
                    {userMgmtMessage.type === "success" ? <CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> : <AlertCircle className="w-5 h-5 text-destructive shrink-0" />}
                    <p className={`text-sm ${userMgmtMessage.type === "success" ? "text-primary" : "text-destructive"}`}>{userMgmtMessage.text}</p>
                  </div>
                )}

                {/* Add Photographer */}
                <Card className="border border-border/70 bg-card/85 shadow-sm backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Camera className="w-5 h-5" /> Add Photographer</CardTitle>
                    <CardDescription>Add a Gmail or MFU email. The user will be directed to the photographer page on their next login.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-3">
                      <Input
                        placeholder="photographer@gmail.com"
                        value={newPhotographerEmail}
                        onChange={(e) => setNewPhotographerEmail(e.target.value)}
                        className="flex-1 border-border/70 bg-background/80"
                      />
                      <Button
                        disabled={userMgmtLoading || !newPhotographerEmail}
                        className="bg-gradient-to-r from-[#82181a] to-[#a8252d] text-primary-foreground hover:from-[#82181a]/90 hover:to-[#a8252d]/90"
                        onClick={async () => {
                          setUserMgmtLoading(true)
                          setUserMgmtMessage(null)
                          const res = await apiClient.setUserRole(newPhotographerEmail, "PHOTOGRAPHER")
                          if (res.error) {
                            setUserMgmtMessage({ type: "error", text: res.error })
                          } else {
                            setUserMgmtMessage({ type: "success", text: `${newPhotographerEmail} is now a Photographer` })
                            setNewPhotographerEmail("")
                            const usersRes = await apiClient.getAdminUsers()
                            if (usersRes.data) setAllUsers(usersRes.data.users || [])
                          }
                          setUserMgmtLoading(false)
                        }}
                      >
                        <UserPlus className="w-4 h-4 mr-2" /> Add Photographer
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Add Admin (Super Admin only) */}
                {callerRole === "SUPER_ADMIN" && (
                  <Card className="border border-border/70 bg-card/85 shadow-sm backdrop-blur-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Crown className="w-5 h-5" /> Add Admin</CardTitle>
                      <CardDescription>Only you (Super Admin) can add or remove admins.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-3">
                        <Input
                          placeholder="admin@gmail.com"
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                          className="flex-1 border-border/70 bg-background/80"
                        />
                        <Button
                          disabled={userMgmtLoading || !newAdminEmail}
                          className="bg-gradient-to-r from-[#82181a] to-[#a8252d] text-primary-foreground hover:from-[#82181a]/90 hover:to-[#a8252d]/90"
                          onClick={async () => {
                            setUserMgmtLoading(true)
                            setUserMgmtMessage(null)
                            const res = await apiClient.setUserRole(newAdminEmail, "ADMIN")
                            if (res.error) {
                              setUserMgmtMessage({ type: "error", text: res.error })
                            } else {
                              setUserMgmtMessage({ type: "success", text: `${newAdminEmail} is now an Admin` })
                              setNewAdminEmail("")
                              const usersRes = await apiClient.getAdminUsers()
                              if (usersRes.data) setAllUsers(usersRes.data.users || [])
                            }
                            setUserMgmtLoading(false)
                          }}
                        >
                          <UserPlus className="w-4 h-4 mr-2" /> Add Admin
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* User List */}
                <Card className="border border-border/70 bg-card/85 shadow-sm backdrop-blur-md">
                  <CardHeader>
                    <CardTitle>All Users</CardTitle>
                    <CardDescription>{allUsers.length} registered users</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {allUsers.map((u) => {
                        const isSuperAdmin = u.role === "SUPER_ADMIN"
                        const isAdmin = u.role === "ADMIN"
                        const isPhotographer = u.role === "PHOTOGRAPHER"
                        const canRemove = (() => {
                          if (isSuperAdmin) return false
                          if (isAdmin && callerRole !== "SUPER_ADMIN") return false
                          if (isPhotographer) return true
                          return false
                        })()

                        const roleBadge = ({
                          SUPER_ADMIN: "bg-amber-500/20 text-amber-700 border-amber-500/30",
                          ADMIN: "bg-blue-500/20 text-blue-700 border-blue-500/30",
                          PHOTOGRAPHER: "bg-green-500/20 text-green-700 border-green-500/30",
                          STUDENT: "bg-gray-500/20 text-gray-700 border-gray-500/30",
                        } as Record<string, string>)[u.role] || "bg-gray-500/20 text-gray-700 border-gray-500/30"

                        const roleLabel = {
                          SUPER_ADMIN: "Super Admin",
                          ADMIN: "Admin",
                          PHOTOGRAPHER: "Photographer",
                          STUDENT: "Student",
                        }[u.role as string] || u.role

                        return (
                          <div key={u.id} className="flex items-center justify-between rounded-lg border border-border/70 bg-card/70 p-3 transition-all duration-200 hover:border-primary/30 hover:shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground overflow-hidden">
                                {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : (u.name?.[0]?.toUpperCase() || u.email[0].toUpperCase())}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-foreground">{u.name || u.email}</div>
                                <div className="text-xs text-muted-foreground">{u.email}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${roleBadge}`}>
                                {isSuperAdmin && <Crown className="w-3 h-3 inline mr-1" />}
                                {roleLabel}
                              </span>
                              {canRemove && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  disabled={userMgmtLoading}
                                  onClick={async () => {
                                    if (!confirm(`Remove ${u.email} from ${roleLabel}? They will become a Student.`)) return
                                    setUserMgmtLoading(true)
                                    setUserMgmtMessage(null)
                                    const res = await apiClient.removeUserRole(u.id)
                                    if (res.error) {
                                      setUserMgmtMessage({ type: "error", text: res.error })
                                    } else {
                                      setUserMgmtMessage({ type: "success", text: `${u.email} has been demoted to Student` })
                                      const usersRes = await apiClient.getAdminUsers()
                                      if (usersRes.data) setAllUsers(usersRes.data.users || [])
                                    }
                                    setUserMgmtLoading(false)
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="health" className="mt-0">
              <SystemHealth />
            </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>
    </>
  )
}
