"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PhotoGrid } from "@/components/photo-grid"
import { CalendarDays, Images, Search, SlidersHorizontal, Sparkles, X } from "lucide-react"

interface Photo {
  id: string
  url: string
  eventName: string
  eventDate: string
  confidence: number
}

export default function BrowsePhotosPage() {
  const router = useRouter()
  const [allPhotos, setAllPhotos] = useState<Photo[]>([])
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([])
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"date-newest" | "date-oldest" | "confidence">("date-newest")
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
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

    const loadData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
        const authHeaders = {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        }

        const eventsRes = await fetch(`${apiUrl}/events`, { headers: authHeaders })
        const eventsData = await eventsRes.json().catch(() => null)
        const eventsPayload = Array.isArray(eventsData)
          ? eventsData
          : Array.isArray((eventsData as { events?: unknown[] } | null)?.events)
            ? ((eventsData as { events: unknown[] }).events as any[])
            : Array.isArray((eventsData as { data?: unknown[] } | null)?.data)
              ? ((eventsData as { data: unknown[] }).data as any[])
              : []

        const photosRes = await fetch(`${apiUrl}/photos`, { headers: authHeaders })
        const photosData = await photosRes.json().catch(() => null)
        const photosPayload = Array.isArray(photosData)
          ? photosData
          : Array.isArray((photosData as { photos?: unknown[] } | null)?.photos)
            ? ((photosData as { photos: unknown[] }).photos as any[])
            : Array.isArray((photosData as { data?: unknown[] } | null)?.data)
              ? ((photosData as { data: unknown[] }).data as any[])
              : []

        if (!eventsRes.ok) {
          console.warn('Failed to load events:', eventsData)
        }

        if (!photosRes.ok) {
          console.warn('Failed to load photos:', photosData)
        }

        const transformedPhotos = photosPayload.map((photo: any) => {
          const event = eventsPayload.find((e: any) => e.id === photo.eventId)
          return {
            id: photo.id,
            url: photo.storageUrl,
            eventName: event?.name || 'Unknown Event',
            eventDate: event?.date || photo.createdAt,
            confidence: 0.95,
          }
        })

        setAllPhotos(transformedPhotos)
        setIsLoading(false)
      } catch (err) {
        console.error('Failed to load data:', err)
        setIsLoading(false)
      }
    }

    loadData()
  }, [router])

  // Apply filters
  useEffect(() => {
    let results = [...allPhotos]

    // Filter by event
    if (selectedEvents.length > 0) {
      results = results.filter((photo) => selectedEvents.includes(photo.eventName))
    }

    // Filter by search query
    if (searchQuery.trim()) {
      results = results.filter((photo) => photo.eventName.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    // Sort
    if (sortBy === "date-newest") {
      results.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
    } else if (sortBy === "date-oldest") {
      results.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
    } else if (sortBy === "confidence") {
      results.sort((a, b) => b.confidence - a.confidence)
    }

    setFilteredPhotos(results)
  }, [allPhotos, selectedEvents, searchQuery, sortBy])

  const events = [...new Set(allPhotos.map((p) => p.eventName))]

  const totalEvents = useMemo(() => events.length, [events])
  const totalPhotos = allPhotos.length

  const handleToggleEvent = (eventName: string) => {
    setSelectedEvents((prev) => (prev.includes(eventName) ? prev.filter((e) => e !== eventName) : [...prev, eventName]))
  }

  const handleClearFilters = () => {
    setSelectedEvents([])
    setSearchQuery("")
    setSortBy("date-newest")
  }

  const isFiltered = selectedEvents.length > 0 || searchQuery.trim() !== "" || sortBy !== "date-newest"

  return (
    <>
      <Header showLogout />
      <main className="min-h-screen relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(130,24,26,0.12),transparent_36%),radial-gradient(circle_at_top_right,rgba(130,24,26,0.08),transparent_30%),linear-gradient(to_bottom,rgba(255,255,255,0.98),rgba(248,250,252,1))]">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent pointer-events-none" />
        <div className="absolute -top-20 right-8 h-64 w-64 rounded-full bg-[#82181a]/10 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <section className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/90 shadow-[0_18px_52px_rgba(15,23,42,0.08)] backdrop-blur-lg">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(130,24,26,0.18),rgba(130,24,26,0.03)_40%,rgba(255,255,255,0)_75%)]" />
            <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-2xl" />
            <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
              <div className="space-y-4">
                <Badge variant="secondary" className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Browse gallery
                </Badge>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Explore all campus event photos in one place
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Filter by event, search by event name, and sort by date to quickly discover the photos you need.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-background/80 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Total Photos</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{totalPhotos.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl bg-primary/15 p-2 text-primary">
                        <Images className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-background/80 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Events</p>
                        <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{totalEvents.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl bg-primary/15 p-2 text-primary">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <div className="mt-6 space-y-4">
            <Card className="border-border/60 bg-card/80 backdrop-blur-md">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by event name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>

                  <div className="flex gap-3">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="h-11 min-w-[170px] px-4 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="date-newest">Newest First</option>
                      <option value="date-oldest">Oldest First</option>
                      <option value="confidence">Best Match</option>
                    </select>

                    <Button
                      variant="outline"
                      onClick={() => setShowFilters(!showFilters)}
                      className="h-11 gap-2"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      Filters
                      {selectedEvents.length > 0 && (
                        <span className="ml-1 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                          {selectedEvents.length}
                        </span>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Images className="w-4 h-4" />
                    {filteredPhotos.length} shown
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <CalendarDays className="w-4 h-4" />
                    {totalEvents} events
                  </span>
                  {isFiltered && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="ml-auto text-primary hover:text-primary/80"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear filters
                    </Button>
                  )}
                </div>

                {showFilters && (
                  <div className="border border-border/70 rounded-xl p-4 bg-background/70">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">Filter by Event</h3>
                      <span className="text-xs text-muted-foreground">{events.length} options</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {events.map((event) => (
                        <label
                          key={event}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedEvents.includes(event)
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes(event)}
                            onChange={() => handleToggleEvent(event)}
                            className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-foreground block truncate">{event}</span>
                            <span className="text-xs text-muted-foreground">
                              {allPhotos.filter((p) => p.eventName === event).length} photos
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <Card className="border-dashed border-border/70 bg-card/70 mt-6">
              <CardContent className="p-12 text-center text-muted-foreground">Loading photos...</CardContent>
            </Card>
          ) : filteredPhotos.length > 0 ? (
            <>
              <div className="mt-6">
                <PhotoGrid photos={filteredPhotos} />
              </div>
              <div className="mt-8 text-center text-sm text-muted-foreground">
                Showing {filteredPhotos.length} of {allPhotos.length} photos
              </div>
            </>
          ) : (
            <Card className="border border-border/70 bg-card/70 mt-6">
              <CardContent className="py-12 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <p className="text-muted-foreground">No photos match your filters</p>
                {isFiltered && (
                  <Button variant="outline" onClick={handleClearFilters}>
                    <X className="w-4 h-4 mr-2" />
                    Clear filters
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  )
}
