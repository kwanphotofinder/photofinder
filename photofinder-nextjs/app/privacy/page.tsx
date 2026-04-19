"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Shield, Clock, Trash2, EyeOff, Search, ArrowLeft, ShieldCheck, Database, Lock, Fingerprint } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"

export default function PrivacyPolicyPage() {
  const router = useRouter()
  const [backUrl, setBackUrl] = useState("/")
  const [backText, setBackText] = useState("Back to Home")

  useEffect(() => {
    // Check if the user is already logged in
    const adminToken = localStorage.getItem("admin_token")
    const authToken = localStorage.getItem("auth_token")
    const userRole = (localStorage.getItem("user_role") || "student").toLowerCase()

    if (adminToken) {
      setBackUrl("/admin/dashboard")
      setBackText("Back to Dashboard")
    } else if (authToken) {
      if (userRole === "photographer") {
        setBackUrl("/photographer")
        setBackText("Back to Upload Photos")
      } else {
        setBackUrl("/dashboard")
        setBackText("Back to Dashboard")
      }
    }
  }, [])

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/Logo2.png" alt="Photo Finder" className="h-14 w-auto" />
          </Link>
          <button 
            onClick={() => router.push(backUrl)} 
            className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> {backText}
          </button>
        </div>
      </nav>

      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(130,24,26,0.1),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(130,24,26,0.05),_transparent_40%),linear-gradient(to_bottom,_#fff,_#f8f9fa)] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-12">
          
          <div className="text-center space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 shadow-inner ring-1 ring-primary/20">
              <ShieldCheck className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-3">
              <Badge variant="secondary" className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
                Transparency & Trust
              </Badge>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                Privacy & Data Handling
              </h1>
              <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                At PhotoFinder, your privacy is our top priority. We use AI facial recognition solely to help you find your campus photos. We believe in complete transparency and putting you in control of your data.
              </p>
            </div>
          </div>

          <div className="grid gap-6">
            
            {/* Section 1: Data Collection & Processing */}
            <Card className="overflow-hidden border border-white/60 bg-white/70 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all hover:bg-white/90">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Database className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">1. Data Collection & Processing</CardTitle>
                    <CardDescription className="text-sm font-medium">What we collect and why we need it</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-6 text-slate-600">
                <p className="leading-relaxed">
                  To provide our service, we collect basic profile information (Name, Email, Profile Picture) from your Google Account. 
                </p>
                <div className="flex gap-4 rounded-xl bg-slate-50 p-4">
                  <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <p className="text-sm leading-relaxed">
                    When you upload a <strong className="text-slate-900">Reference Selfie</strong> or when a photographer uploads <strong className="text-slate-900">Event Photos</strong>, our AI system analyzes the faces in the images and converts them into an encrypted mathematical string of 512 numbers (a facial embedding).
                  </p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-center gap-2 font-bold mb-2 text-primary">
                    <Shield className="h-5 w-5" />
                    Our Promise
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">
                    We only use this mathematical data to compare your selfie against event photos to find matches. We do not sell this data, we do not use it to track attendance, and it is never shared with third parties.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Data Retention & Auto-Deletion */}
            <Card className="overflow-hidden border border-white/60 bg-white/70 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all hover:bg-white/90">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">2. Retention & Auto-Deletion</CardTitle>
                    <CardDescription className="text-sm font-medium">How long we keep your data</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="flex gap-4">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Event Photos (Strictly Temporary)</h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      All photos uploaded to a specific campus event are temporary. The entire event—including all associated photos, facial embeddings, and metadata—will be permanently and automatically deleted from our servers and Cloudinary storage no later than <strong className="text-slate-900">30 days</strong> after the event is published. We do not archive event photos long-term.
                    </p>
                  </div>
                </div>

                <div className="full h-px bg-slate-100" />

                <div className="flex gap-4">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Your Reference Selfie</h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      The selfie you upload to find yourself is kept securely in your profile so you don't have to re-upload it for every event. It remains there until you manually delete it.
                    </p>
                  </div>
                </div>

                <div className="full h-px bg-slate-100" />

                <div className="flex gap-4">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <div className="h-2 w-2 rounded-full bg-slate-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Manual Searches</h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      If you choose to search for photos without saving a default selfie, the image you upload is processed in memory (RAM) and immediately discarded. It is never saved to our database or storage.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Your Rights */}
            <Card className="overflow-hidden border border-white/60 bg-white/70 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all hover:bg-white/90">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Trash2 className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">3. Your Rights & Control</CardTitle>
                    <CardDescription className="text-sm font-medium">You have the "Right to be Forgotten"</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <Search className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Remove Event Photos</h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      If you see a photo of yourself in the system that you do not want there, simply click the <strong className="text-slate-900">"Request Removal"</strong> button on the photo. This alerts a University Administrator who will permanently delete the photo from our servers.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                    <Trash2 className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Delete Your Face Data</h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      You have full control over your reference selfie. If you click <strong className="text-slate-900">"Reset Profile"</strong> in your dashboard or withdraw consent in Settings, the image file and its associated mathematical AI data are instantly and permanently erased from our system.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Security */}
            <Card className="overflow-hidden border border-white/60 bg-white/70 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all hover:bg-white/90">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">4. Security & Access</CardTitle>
                    <CardDescription className="text-sm font-medium">How we protect your information</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-6 text-slate-600">
                <p className="leading-relaxed">
                  Your data is protected by industry-standard encryption. Access to event photos is restricted to verified university students, the photographer who uploaded the event, and designated system administrators. 
                </p>
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-700">
                  If you have any questions about our privacy practices, please contact your university administration.
                </div>
              </CardContent>
            </Card>

          </div>
          
          <div className="text-center pt-8 text-sm font-medium text-slate-400">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>

        </div>
      </main>
    </>
  )
}
