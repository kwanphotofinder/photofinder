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
      <nav className="sticky top-0 z-50 border-b border-white/20 bg-white/70 backdrop-blur-xl transition-all duration-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-2 transition-transform active:scale-95">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-primary/10 p-1.5 shadow-inner">
              <img src="/Logo.png" alt="Photo Finder" className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-primary transition-colors">Photo Finder</span>
          </Link>
          <button 
            onClick={() => router.push(backUrl)} 
            className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> 
            {backText}
          </button>
        </div>
      </nav>

      <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(130,24,26,0.08),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(130,24,26,0.05),transparent_40%),linear-gradient(to_bottom,#fff,#fafafa)]">
        {/* Background Decorative Elements */}
        <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute bottom-48 -left-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          
          <div className="mb-16 text-center space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 shadow-xl shadow-primary/10 ring-1 ring-primary/20 animate-in zoom-in-50 duration-500">
              <Shield className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Privacy & Data <span className="text-primary">Handling</span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-slate-500 lg:text-xl">
                Your trust is our foundation. We believe in complete transparency and putting you in total control of your digital identity.
              </p>
            </div>
          </div>

          <div className="grid gap-10">
            
            {/* Section 1: Data Collection & Processing */}
            <section className="group relative">
              <div className="absolute -inset-y-4 -inset-x-4 z-0 scale-95 rounded-3xl bg-slate-50 opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
                    <Search className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">1. Data Collection & AI Processing</h2>
                </div>
                <div className="ml-16 space-y-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                  <p>
                    To provide our service, we collect basic profile information (Name, Email, Profile Picture) from your Google Account. 
                  </p>
                  <p>
                    When you upload a <span className="font-semibold text-slate-900">Reference Selfie</span> or when a photographer uploads <span className="font-semibold text-slate-900">Event Photos</span>, our AI system analyzes the faces and converts them into encrypted mathematical strings of 512 numbers (facial embeddings). 
                  </p>
                  <div className="mt-6 overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <ArrowLeft className="h-3 w-3 rotate-180" />
                      </div>
                      <div>
                        <h4 className="font-bold text-primary">Our Human-Centric Promise</h4>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                          We only use this mathematical data to compare your selfie against event photos. We do not sell data, we do not track attendance, and it is never shared with third parties.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Data Retention & Auto-Deletion */}
            <section className="group relative">
              <div className="absolute -inset-y-4 -inset-x-4 z-0 scale-95 rounded-3xl bg-slate-50 opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">2. Data Retention & Auto-Deletion</h2>
                </div>
                <div className="ml-16 space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all group-hover:border-primary/20 group-hover:shadow-md">
                      <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-500">Temporary</span>
                      <h4 className="mt-3 font-bold text-slate-900">Event Photos</h4>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        Permanently deleted from our servers & Cloudinary no later than <span className="font-semibold text-primary">30 days</span> after an event is published.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all group-hover:border-primary/20 group-hover:shadow-md">
                      <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">Secure</span>
                      <h4 className="mt-3 font-bold text-slate-900">Reference Selfie</h4>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        Kept securely so you don't have to re-upload for every event. It remains only until <span className="font-semibold text-slate-900">you manually delete it</span>.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-100/50 p-6 text-sm text-slate-600 italic">
                    Note: Manual searches are processed in memory (RAM) and immediately discarded. They are never saved to any database.
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Your Rights */}
            <section className="group relative">
              <div className="absolute -inset-y-4 -inset-x-4 z-0 scale-95 rounded-3xl bg-slate-50 opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
                    <Trash2 className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">3. Your Rights & Control</h2>
                </div>
                <div className="ml-16 space-y-4">
                  <div className="flex gap-4">
                    <div className="mt-1 flex h-2 w-2 grow-0 shrink-0 rounded-full bg-primary" />
                    <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                      <span className="font-bold text-slate-900">Right to be Forgotten:</span> You can request photo removal by clicking "Request Removal" on any photo. This alerts a University Admin for immediate deletion.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="mt-1 flex h-2 w-2 grow-0 shrink-0 rounded-full bg-primary" />
                    <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                      <span className="font-bold text-slate-900">Instant Face Purge:</span> Deleting your "Default Selfie" in the dashboard instantly erases the image file and all associated AI data permanently.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4: Security */}
            <section className="group relative">
              <div className="absolute -inset-y-4 -inset-x-4 z-0 scale-95 rounded-3xl bg-slate-50 opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
                    <EyeOff className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">4. Security & Access</h2>
                </div>
                <div className="ml-16">
                  <p className="text-base leading-relaxed text-slate-600 sm:text-lg text-balance">
                    Data is protected by industry-standard encryption. Access is strictly limited to verified students, the photographer of the event, and authorized system administrators.
                  </p>
                </div>
              </div>
            </section>

          </div>
          
          <footer className="mt-24 border-t border-slate-100 pt-12 text-center">
            <p className="text-sm font-medium text-slate-400">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <div className="mt-8 flex justify-center gap-4 grayscale opacity-50">
              <img src="/Logo.png" alt="PhotoFinder Logo" className="h-6 w-auto" />
            </div>
          </footer>

        </div>
      </main>
    </>
  )
}
