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
      setUniversityId(localStorage.getItem("university_id") || "")

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
        const storedId = localStorage.getItem("university_id") || 'guest'
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
      <main className="min-h-screen bg-gradient-to-b from-background to-secondary/5">
        
        {/* Banner Section */}
        <div className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Welcome back, {userName || "Student"}!</h1>
              <p className="text-muted-foreground mt-2 text-lg">Your personal facial recognition hub.</p>
            </div>
            <Button
              onClick={() => router.push("/search")}
              className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all"
              size="lg"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Manual Face Search
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
          
          {/* Reference Selfie Section */}
          <section className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
             <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                {!hasReferenceFace ? (
                  <>
                     <div className="h-32 w-32 bg-secondary rounded-full flex items-center justify-center text-muted-foreground">
                        <UserCircle className="w-16 h-16 opacity-50" />
                     </div>
                     <div className="flex-1">
                        <h2 className="text-2xl font-semibold mb-2">Set up Auto-Match</h2>
                        <p className="text-muted-foreground mb-4">Upload a clear selfie once. We will automatically find every photo of you across all university events when you log in.</p>
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleUploadSelfie} />
                        <Button 
                           onClick={() => fileInputRef.current?.click()} 
                           disabled={isUploading}
                           className="bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all w-full md:w-auto"
                        >
                           {isUploading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing Face...</> : <><UploadCloud className="w-5 h-5 mr-2" /> Upload Default Selfie</>}
                        </Button>
                     </div>
                  </>
                ) : (
                  <>
                     <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-primary/20 shadow-md">
                        <img src={referenceFaceUrl} alt="Reference" className="h-full w-full object-cover" />
                     </div>
                     <div className="flex-1">
                        <h2 className="text-2xl font-semibold mb-2 flex items-center justify-center md:justify-start">
                           <Sparkles className="w-5 h-5 text-primary mr-2" /> Auto-Match is Active
                        </h2>
                        <p className="text-muted-foreground mb-4">We found {autoMatches.length} photos matching your face across all events!</p>
                        <Button onClick={handleDeleteSelfie} variant="destructive" size="sm">
                           <Trash2 className="w-4 h-4 mr-2" /> Delete Default Selfie
                        </Button>
                     </div>
                  </>
                )}
             </div>
          </section>

          {/* AutoMatches Grid */}
          {hasReferenceFace && (
             <section>
                <div className="mb-6 flex items-center justify-between border-b pb-2">
                   <h2 className="text-2xl font-bold">Auto-Matched Photos</h2>
                </div>
                {isLoading ? (
                  <p className="text-muted-foreground text-center py-8">Loading your matches...</p>
                ) : autoMatches.length > 0 ? (
                  <PhotoGrid photos={autoMatches} showRank={true} />
                ) : (
                  <Card className="bg-secondary/20 border-dashed border-2 py-12 text-center">
                    <p className="text-muted-foreground">No matches found for your face yet. We'll keep checking future events!</p>
                  </Card>
                )}
             </section>
          )}

          {/* Legacy Saved Photos */}
          <section>
             <div className="mb-6 flex items-center justify-between border-b pb-2">
                <h2 className="text-2xl font-bold">Manually Saved Photos</h2>
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
