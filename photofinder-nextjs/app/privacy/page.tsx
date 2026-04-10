"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Shield, Clock, Trash2, EyeOff, Search, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function PrivacyPolicyPage() {
  const router = useRouter()
  const [backUrl, setBackUrl] = useState("/")
  const [backText, setBackText] = useState("Back to Home")

  useEffect(() => {
    // Check if the user is already logged in
    const adminToken = localStorage.getItem("admin_token")
    const authToken = localStorage.getItem("auth_token")

    if (adminToken) {
      setBackUrl("/admin/dashboard")
      setBackText("Back to Dashboard")
    } else if (authToken) {
      setBackUrl("/dashboard")
      setBackText("Back to Dashboard")
    }
  }, [])

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/30 dark:bg-black/30 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/Logo.png" alt="Photo Finder" className="h-14 w-auto" />
          </Link>
          <button 
            onClick={() => router.push(backUrl)} 
            className="text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> {backText}
          </button>
        </div>
      </nav>
      <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div className="text-center space-y-4 mb-12">
            <div className="mx-auto w-16 h-16 bg-primary/10 flex items-center justify-center rounded-2xl mb-6">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Privacy Policy & Data Handling</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              At PhotoFinder, your privacy is our top priority. We use AI facial recognition solely to help you find your campus photos. We believe in complete transparency and putting you in control of your data.
            </p>
          </div>

          <div className="grid gap-6">
            
            {/* Section 1: Data Collection & Processing */}
            <Card className="border-border/50 shadow-sm bg-card/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Search className="w-5 h-5 text-primary" />
                  1. Data Collection & AI Processing
                </CardTitle>
                <CardDescription>What we collect and why we need it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  To provide our service, we collect basic profile information (Name, Email, Profile Picture) from your Google Account. 
                </p>
                <p>
                  When you upload a <strong>Reference Selfie</strong> or when a photographer uploads <strong>Event Photos</strong>, our AI system analyzes the faces in the images and converts them into an encrypted mathematical string of 512 numbers (a facial embedding). 
                </p>
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 mt-4 text-foreground text-sm font-medium">
                  <strong>Our Promise:</strong> We only use this mathematical data to compare your selfie against event photos to find matches. We do not sell this data, we do not use it to track attendance, and it is never shared with third parties.
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Data Retention & Auto-Deletion */}
            <Card className="border-border/50 shadow-sm bg-card/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Clock className="w-5 h-5 text-primary" />
                  2. Data Retention & Auto-Deletion
                </CardTitle>
                <CardDescription>How long we keep your data.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <ul className="space-y-4 list-none pl-0">
                  <li className="flex gap-3">
                    <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                    <div>
                      <strong className="text-foreground">Event Photos (Strictly Temporary):</strong> All photos uploaded to a specific campus event are temporary. The entire event—including all associated photos, facial embeddings, and metadata—will be permanently and automatically deleted from our servers and Cloudinary storage no later than <strong>30 days</strong> after the event is published. We do not archive event photos long-term.
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                    <div>
                      <strong className="text-foreground">Your Reference Selfie:</strong> The selfie you upload to find yourself is kept securely in your profile so you don't have to re-upload it for every event. It remains there until you manually delete it.
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                    <div>
                      <strong className="text-foreground">Manual Searches:</strong> If you choose to search for photos without saving a default selfie, the image you upload is processed in memory (RAM) and immediately discarded. It is never saved to our database or storage.
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 3: Your Rights */}
            <Card className="border-border/50 shadow-sm bg-card/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Trash2 className="w-5 h-5 text-primary" />
                  3. Your Rights & Control
                </CardTitle>
                <CardDescription>You have the "Right to be Forgotten".</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <ul className="space-y-4 list-none pl-0">
                  <li className="flex gap-3">
                    <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                    <div>
                      <strong className="text-foreground">Remove Event Photos:</strong> If you see a photo of yourself in the system that you do not want there, simply click the <strong>"Request Removal"</strong> button on the photo. This alerts a University Administrator who will permanently delete the photo from our servers.
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                    <div>
                      <strong className="text-foreground">Delete Your Face Data:</strong> You have full control over your reference selfie. If you click <strong>"Delete Default Selfie"</strong> in your student dashboard, the image file and its associated mathematical AI data are instantly and permanently erased from our system.
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 4: Security */}
            <Card className="border-border/50 shadow-sm bg-card/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <EyeOff className="w-5 h-5 text-primary" />
                  4. Security & Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Your data is protected by industry-standard encryption. Access to event photos is restricted to verified university students, the photographer who uploaded the event, and designated system administrators. 
                </p>
                <p>
                  If you have any questions about our privacy practices, please contact your university administration.
                </p>
              </CardContent>
            </Card>

          </div>
          
          <div className="text-center pt-8 text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>

        </div>
      </main>
    </>
  )
}
