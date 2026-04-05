"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, UploadCloud, UserCircle, Loader2, Trash2 } from "lucide-react"
import { PhotoGrid } from "@/components/photo-grid"

interface Photo {
  id: string
  url: string
  eventName: string
  eventDate: string
  confidence: number
}

export default function DashboardPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [userName, setUserName] = useState("")
  const [universityId, setUniversityId] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  
  const [hasReferenceFace, setHasReferenceFace] = useState(false)
  const [referenceFaceUrl, setReferenceFaceUrl] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  
  const [autoMatches, setAutoMatches] = useState<Photo[]>([])
  const [savedPhotos, setSavedPhotos] = useState<Photo[]>([])

  useEffect(() => {
    const fetchDashboardData = async () => {
      const authToken = localStorage.getItem("auth_token")
      if (!authToken) {
        router.push("/login")
        return
      }

      setUserName(localStorage.getItem("user_name") || "")
      setUniversityId(localStorage.getItem("user_id") || "")

      try {
        // 1. Fetch Reference Face status
        const faceRes = await fetch('/api/me/reference-face', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
        const faceData = await faceRes.json()
        
        if (faceRes.ok && faceData.hasReference) {
          setHasReferenceFace(true)
          setReferenceFaceUrl(faceData.userFace.imageUrl)
          
          // 2. If they have a face, fetch the auto-matches automatically!
          const matchRes = await fetch('/api/me/matches', {
             headers: { 'Authorization': `Bearer ${authToken}` }
          })
          const matchData = await matchRes.json()
          if (matchRes.ok) setAutoMatches(matchData.results)
        }

        // 3. Keep old behavior: Load manually saved photos
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
        const storedId = localStorage.getItem("user_id") || 'guest'
        const savedRes = await fetch(`${apiUrl}/saved-photos/${storedId}`)
        if (savedRes.ok) {
           const savedData = await savedRes.json()
           setSavedPhotos(savedData.map((item: any) => ({
             id: item.photo.id, url: item.photo.storageUrl,
             eventName: item.photo.event?.name || 'Unknown',
             eventDate: item.photo.event?.date || item.photo.createdAt,
             confidence: 0.95,
           })))
        }

      } catch (err) {
        console.error('Failed to load dashboard:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [router])

  const handleUploadSelfie = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const authToken = localStorage.getItem("auth_token")
      const response = await fetch('/api/me/reference-face', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        alert(data.error || 'Failed to analyze face. Please try a clearer selfie.')
      } else {
        alert('Face saved successfully! We are fetching your matches now...')
        window.location.reload() // Reload to fetch matches smoothly
      }
    } catch (error) {
      alert('Network error. Please try again.')
      console.error(error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteSelfie = async () => {
     if(!confirm('Are you sure you want to delete your auto-search default face?')) return;
     try {
       const authToken = localStorage.getItem("auth_token")
       await fetch('/api/me/reference-face', { 
         method: 'DELETE',
         headers: { 'Authorization': `Bearer ${authToken}` }
       })
       window.location.reload()
     } catch (e) {
       console.error(e)
     }
  }

  return (
    <>
      <Header userRole="student" />
      <main className="min-h-screen bg-background relative overflow-hidden">
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50 pointer-events-none" />
        <div className="absolute top-40 -left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl opacity-50 pointer-events-none" />

        {/* Banner Section */}
        <div className="relative border-b border-border/40">
          <div
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-8 rounded-3xl overflow-hidden relative my-6"
            style={{
              backgroundImage: 'url(/background.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
            <div className="space-y-4 text-center md:text-left relative z-10">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                Welcome back, <span className="text-primary">{userName || "Student"}</span>
              </h1>
              <p className="text-white/85 text-lg max-w-xl">
                Your personal AI photo hub. Upload a selfie once, and let us find all your memories automatically.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto relative z-10">
              <Button
                onClick={() => router.push("/search")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground border-none transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                size="lg"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Manual Quick Search
              </Button>
              <p className="text-xs text-center text-white/70">Looking for a specific event?</p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 relative z-10">
          
          {/* Reference Selfie Section */}
           <section className="relative rounded-3xl border border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden shadow-2xl transition-all duration-300 hover:shadow-primary/5">
             <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
             <div className="p-8 md:p-10 flex flex-col md:flex-row items-center gap-10 text-center md:text-left relative">
                {!hasReferenceFace ? (
                  <>
                  <div className="group relative h-40 w-40 flex-shrink-0">
                     <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-colors" />
                     <div className="relative h-full w-full bg-gradient-to-br from-secondary to-secondary/60 rounded-full flex items-center justify-center text-muted-foreground border-2 border-dashed border-border group-hover:border-primary/50 transition-colors">
                        <UserCircle className="w-20 h-20 opacity-40 group-hover:opacity-60 transition-opacity" />
                     </div>
                  </div>
                     <div className="flex-1 space-y-4">
                    <h2 className="text-3xl font-bold tracking-tight">Activate Auto-Match</h2>
                    <p className="text-muted-foreground text-lg max-w-2xl">
                      Stop searching manually. Upload a clear selfie as your reference and our AI will automatically scan all events and deliver your photos right here.
                    </p>
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUploadSelfie} />
                        <div className="pt-2">
                          <Button 
                             onClick={() => fileInputRef.current?.click()} 
                             disabled={isUploading}
                             size="lg"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all w-full md:w-auto h-14 px-8 text-lg"
                          >
                             {isUploading ? <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Analyzing Face...</> : <><UploadCloud className="w-6 h-6 mr-3" /> Upload Reference Selfie</>}
                          </Button>
                        </div>
                     </div>
                  </>
                ) : (
                  <>
                    <div className="relative h-40 w-40 flex-shrink-0">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                        <div className="relative h-full w-full rounded-full overflow-hidden border-4 border-background shadow-xl ring-4 ring-primary/20">
                            <img src={referenceFaceUrl} alt="Reference" className="h-full w-full object-cover" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-2 shadow-lg border-2 border-background">
                            <Sparkles className="w-5 h-5" />
                        </div>
                     </div>
                     <div className="flex-1 space-y-3">
                      <h2 className="text-3xl font-bold tracking-tight flex items-center justify-center md:justify-start gap-3">
                           Auto-Match is Active
                        </h2>
                      <p className="text-muted-foreground text-lg">
                          Our AI is actively monitoring all events for your face. <br className="hidden md:block" />
                          Currently found <strong className="text-foreground">{autoMatches.length}</strong> matching photos.
                      </p>
                      <div className="pt-4">
                        <Button onClick={handleDeleteSelfie} variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 h-10">
                           <Trash2 className="w-4 h-4 mr-2" /> Reset Reference Photo
                        </Button>
                      </div>
                     </div>
                  </>
                )}
             </div>
          </section>

          {/* AutoMatches Grid */}
          {hasReferenceFace && (
             <section>
                 <div className="mb-6 flex items-center justify-between border-b border-border/60 pb-3">
                   <h2 className="text-2xl font-bold tracking-tight">Auto-Matched Photos</h2>
                </div>
                {isLoading ? (
                  <p className="text-muted-foreground text-center py-8">Loading your matches...</p>
                ) : autoMatches.length > 0 ? (
                  <PhotoGrid photos={autoMatches} showRank={true} />
                ) : (
                  <Card className="bg-secondary/20 border-dashed border-2 py-12 text-center rounded-2xl">
                    <p className="text-muted-foreground">No matches found for your face yet. We will keep checking future events.</p>
                  </Card>
                )}
             </section>
          )}

          {/* Legacy Saved Photos */}
          <section>
             <div className="mb-6 flex items-center justify-between border-b border-border/60 pb-3">
               <h2 className="text-2xl font-bold tracking-tight">Manually Saved Photos</h2>
             </div>
             {savedPhotos.length > 0 ? (
                <PhotoGrid photos={savedPhotos} />
             ) : (
                <p className="text-muted-foreground italic">You haven't manually saved any random photos.</p>
             )}
          </section>

        </div>
      </main>
    </>
  )
}
