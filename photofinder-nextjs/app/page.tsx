"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, Upload, Shield } from "lucide-react"
import { CinematicLoader } from "@/components/cinematic-loader"
import { motion, AnimatePresence } from "framer-motion"

export default function LandingPage() {
  const router = useRouter()
  const [showLoader, setShowLoader] = useState(true)

  useEffect(() => {
    // Silently wake up the AI service in the background
    fetch('/api/ai-health').catch(() => {})
  }, [])

  return (
    <AnimatePresence mode="wait">
      {showLoader ? (
        <CinematicLoader key="loader" onComplete={() => setShowLoader(false)} />
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20"
        >
          {/* Navigation */}
          <nav className="sticky top-0 z-50 bg-white/30 dark:bg-black/30 backdrop-blur-md border-b border-white/20 shadow-sm transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <img src="/Logo2.png" alt="Photo Finder" className="h-14 w-auto" />
              </div>
            </div>
          </nav>

          {/* Hero Section */}
          <section className="relative min-h-[520px] md:min-h-[640px] flex items-center justify-center overflow-hidden">
            {/* Background Image */}
            <div
              className="absolute inset-0 z-0"
              style={{
                backgroundImage: 'url(/background.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            >
              {/* Layered overlays improve readability while preserving the photo ambience */}
              <div className="absolute inset-0 bg-black/45" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/65" />
            </div>

            {/* Content */}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
              <div className="text-center space-y-7 mb-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
                <div className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs sm:text-sm font-medium tracking-wide text-white/95 backdrop-blur-md">
                  AI-Powered Campus Photo Discovery
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight text-balance">Find Your Moments</h1>
                <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto text-pretty">
                  Discover and download your photos from campus events using AI-powered face recognition
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                  <Button
                    onClick={() => router.push("/login")}
                    size="lg"
                    className="w-full sm:w-auto bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/35 font-semibold shadow-xl transition-all duration-300 hover:scale-[1.02] px-8 py-6 text-base"
                  >
                    Explore the App
                  </Button>
                  <Button
                    onClick={() => router.push("/privacy")}
                    size="lg"
                    variant="ghost"
                    className="w-full sm:w-auto hover:bg-white/10 text-white border border-transparent hover:border-white/20 font-semibold transition-all duration-300 px-8 py-6 text-base"
                  >
                    Privacy Policy
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="relative bg-gradient-to-br from-background via-background to-secondary/10 overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />
            </div>

            <div className="container px-5 py-24 mx-auto relative">
              <div className="text-center mb-20">
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-6 py-2 text-sm font-medium tracking-wide text-primary backdrop-blur-sm mb-6">
                  How It Works
                </div>
                <h1 className="sm:text-4xl text-3xl font-bold title-font text-foreground mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Simple Steps to Your Photos
                </h1>
                <p className="text-base leading-relaxed xl:w-2/4 lg:w-3/4 mx-auto text-muted-foreground max-w-2xl">
                  Our platform makes it incredibly easy to find your photos from any
                  event. Just follow these simple steps.
                </p>
                <div className="flex mt-8 justify-center">
                  <div className="w-24 h-1 rounded-full bg-gradient-to-r from-primary to-primary/60 inline-flex"></div>
                </div>
              </div>

              <div className="flex flex-wrap sm:-m-4 -mx-4 -mb-10 -mt-4 md:space-y-0 space-y-8">
                <div className="p-4 md:w-1/3 flex flex-col text-center items-center group">
                  <div className="relative mb-8">
                    <div className="w-24 h-24 inline-flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary mb-5 flex-shrink-0 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 border border-primary/10">
                      <Upload className="w-12 h-12" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                      1
                    </div>
                  </div>
                  <div className="flex-grow">
                    <h2 className="text-foreground text-xl title-font font-semibold mb-3 group-hover:text-primary transition-colors duration-300">
                      Upload a Selfie
                    </h2>
                    <p className="leading-relaxed text-base text-muted-foreground max-w-xs">
                      Provide a clear photo of yourself so our AI can work its
                      magic. This is your private reference photo.
                    </p>
                  </div>
                </div>

                <div className="p-4 md:w-1/3 flex flex-col text-center items-center group">
                  <div className="relative mb-8">
                    <div className="w-24 h-24 inline-flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary mb-5 flex-shrink-0 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 border border-primary/10">
                      <Camera className="w-12 h-12" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                      2
                    </div>
                  </div>
                  <div className="flex-grow">
                    <h2 className="text-foreground text-xl title-font font-semibold mb-3 group-hover:text-primary transition-colors duration-300">
                      Browse Events
                    </h2>
                    <p className="leading-relaxed text-base text-muted-foreground max-w-xs">
                      Our AI automatically scans all event photos and finds matches
                      for you in your private dashboard.
                    </p>
                  </div>
                </div>

                <div className="p-4 md:w-1/3 flex flex-col text-center items-center group">
                  <div className="relative mb-8">
                    <div className="w-24 h-24 inline-flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary mb-5 flex-shrink-0 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 border border-primary/10">
                      <Shield className="w-12 h-12" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                      3
                    </div>
                  </div>
                  <div className="flex-grow">
                    <h2 className="text-foreground text-xl title-font font-semibold mb-3 group-hover:text-primary transition-colors duration-300">
                      Enjoy Your Photos
                    </h2>
                    <p className="leading-relaxed text-base text-muted-foreground max-w-xs">
                      Download your favorite moments. Your data is secure and you
                      can request removal at any time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
