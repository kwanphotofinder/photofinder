"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UploadLoader } from "@/components/upload-loader"

interface IdentityVerificationProps {
  onSuccess: (frontSelfie: string) => void
  onCancel: () => void
}

type VerificationStep = "start" | "liveness" | "capture-selfie" | "verifying" | "success" | "error"

interface LivenessDetectionResult {
  blink: boolean;
  head_turn: boolean;
  head_turn_direction: "left" | "right" | null;
  face_detected: boolean;
  confidence: number;
}

const challengeSteps = [
  { key: "blink", label: "Blink", icon: Eye },
  { key: "turn_left", label: "Turn left", icon: ArrowLeft },
  { key: "turn_right", label: "Turn right", icon: ArrowRight },
]

export function IdentityVerification({ onSuccess, onCancel }: IdentityVerificationProps) {
  const [step, setStep] = useState<VerificationStep>("start")
  const [error, setError] = useState<string | null>(null)
  
  // Liveness state
  const [livenessData, setLivenessData] = useState<LivenessDetectionResult | null>(null)
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([])
  const [anchorImage, setAnchorImage] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Refs for video processing
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isRunningRef = useRef(false)
  const frameInFlightRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const [videoMounted, setVideoMounted] = useState(false)
  
  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    setVideoMounted(!!node)
  }, [])

  const currentChallenge = challengeSteps[currentChallengeIndex] ?? challengeSteps[challengeSteps.length - 1]

  const stopLivenessDetection = useCallback(() => {
    isRunningRef.current = false
    frameInFlightRef.current = false
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  const stopCamera = useCallback(() => {
    stopLivenessDetection()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [stopLivenessDetection])

  // Cleanup on unmount
  useEffect(() => {
    return stopCamera
  }, [stopCamera])

  const startCamera = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      setStep("liveness")
    } catch (err) {
      setError("Unable to access camera. Please check permissions.")
      setStep("error")
    }
  }

  // Attach stream and start detection when video element mounts
  useEffect(() => {
    if ((step === "liveness" || step === "capture-selfie") && videoMounted && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
        videoRef.current.play().then(() => {
          if (step === "liveness") {
            startLivenessDetection()
          }
        }).catch(console.error)
      }
    }
  }, [step, videoMounted])

  const startLivenessDetection = () => {
    if (isRunningRef.current) return
    isRunningRef.current = true

    const processFrame = async () => {
      if (!isRunningRef.current || !videoRef.current || !canvasRef.current) return

      if (frameInFlightRef.current) {
        animationFrameRef.current = requestAnimationFrame(processFrame)
        return
      }

      const ctx = canvasRef.current.getContext("2d")
      if (!ctx) return

      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)

      try {
        frameInFlightRef.current = true

        const blob = await new Promise<Blob | null>((resolve) => {
          canvasRef.current?.toBlob((b) => resolve(b), "image/jpeg", 0.9)
        })

        if (!isRunningRef.current || !blob) {
          frameInFlightRef.current = false
          return
        }

        const formData = new FormData()
        formData.append("frame", blob, "frame.jpg")

        const controller = new AbortController()
        abortControllerRef.current = controller

        const response = await fetch("/api/student/liveness-detect", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        })

        if (response.ok && isRunningRef.current) {
          const data = await response.json()
          setLivenessData(data)
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Liveness detection error:", err)
        }
      } finally {
        frameInFlightRef.current = false
        abortControllerRef.current = null
      }

      if (isRunningRef.current) {
        animationFrameRef.current = requestAnimationFrame(processFrame)
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame)
  }

  // Monitor Liveness Data to progress challenges sequentially
  useEffect(() => {
    if (step !== "liveness" || !livenessData || !livenessData.face_detected) return

    const nextIndex = challengeSteps.findIndex((s) => !completedChallenges.includes(s.key))
    if (nextIndex === -1) return // Already completed all

    const activeChallenge = challengeSteps[nextIndex]
    let challengePassed = false

    if (activeChallenge.key === "blink" && livenessData.blink) {
      challengePassed = true
    } else if (activeChallenge.key === "turn_left" && livenessData.head_turn_direction === "left") {
      challengePassed = true
    } else if (activeChallenge.key === "turn_right" && livenessData.head_turn_direction === "right") {
      challengePassed = true
    }

    if (challengePassed) {
      const nextCompleted = [...completedChallenges, activeChallenge.key]
      setCompletedChallenges(nextCompleted)
      
      const newNextIndex = challengeSteps.findIndex((s) => !nextCompleted.includes(s.key))
      setCurrentChallengeIndex(newNextIndex === -1 ? challengeSteps.length - 1 : newNextIndex)

      if (nextCompleted.length === challengeSteps.length) {
        // Challenges complete: Capture anchor image silently
        if (canvasRef.current && videoRef.current) {
          const ctx = canvasRef.current.getContext("2d")
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
            setAnchorImage(canvasRef.current.toDataURL("image/jpeg", 0.9))
            stopLivenessDetection()
            setStep("capture-selfie")
          }
        }
      }
    }
  }, [livenessData, step, completedChallenges, challengeSteps])

  const captureFinalSelfie = async () => {
    if (!anchorImage || !videoRef.current || !canvasRef.current) return

    setStep("verifying")
    try {
      const ctx = canvasRef.current.getContext("2d")
      if (!ctx) return
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
      const selfieDataUrl = canvasRef.current.toDataURL("image/jpeg", 0.9)

      const authToken = localStorage.getItem("auth_token")
      const response = await fetch("/api/verify-identity", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          anchorImage,
          selfieImage: selfieDataUrl,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setStep("success")
        setTimeout(() => {
          stopCamera()
          onSuccess(selfieDataUrl)
        }, 2000)
      } else {
        throw new Error(data.error || "Identity mismatch.")
      }
    } catch (err: any) {
      const newRetryCount = retryCount + 1
      setRetryCount(newRetryCount)
      
      if (newRetryCount >= 3) {
        setError("Too many failed attempts. Restarting liveness test...")
        setStep("error")
        setTimeout(() => {
          setAnchorImage(null)
          setRetryCount(0)
          setCompletedChallenges([])
          setCurrentChallengeIndex(0)
          startCamera() // Restart liveness
        }, 3000)
      } else {
        setError(`${err.message} (Attempt ${newRetryCount}/3)`)
        setStep("error")
        setTimeout(() => {
          setError(null)
          setStep("capture-selfie")
        }, 3000)
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6 max-w-md mx-auto bg-card rounded-2xl border shadow-xl">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Identity Guard</h2>
        <p className="text-sm text-muted-foreground min-h-[40px]">
          {step === "start" && "Prove you're human to secure your account."}
          {step === "liveness" && (
            <span className="flex items-center justify-center gap-2 font-medium text-primary">
              <currentChallenge.icon className="w-4 h-4 animate-pulse" />
              {currentChallenge.label}
            </span>
          )}
          {step === "capture-selfie" && "Liveness Verified! Look straight and pose."}
          {step === "verifying" && "Checking identity..."}
          {step === "success" && "Identity Verified Successfully!"}
          {step === "error" && (
            <span className="text-destructive font-semibold">
              {error || "Verification failed."}
            </span>
          )}
        </p>
      </div>

      <div className="relative w-72 h-72 rounded-full overflow-hidden border-4 border-primary shadow-inner bg-black flex items-center justify-center">
        <AnimatePresence mode="wait">
          {(step === "start" || step === "error") && !streamRef.current ? (
            <motion.div
              key="icon"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center w-full h-full text-white/20"
            >
              {step === "error" ? <AlertCircle className="w-24 h-24 text-destructive/80" /> : <Camera className="w-24 h-24" />}
            </motion.div>
          ) : step === "success" ? (
            <motion.div
              key="success"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full h-full flex items-center justify-center bg-green-500/10"
            >
              <CheckCircle2 className="w-24 h-24 text-green-500" />
            </motion.div>
          ) : (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full relative"
            >
              <video
                ref={handleVideoRef}
                className="w-full h-full object-cover transform -scale-x-100"
                autoPlay
                muted
                playsInline
              />
              <div className="absolute inset-0 border-[40px] border-black/40 rounded-full pointer-events-none" />
              
              {/* Liveness Overlay */}
              {step === "liveness" && livenessData && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${livenessData.face_detected ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
                    {livenessData.face_detected ? "Face Detected" : "No Face"}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Direction Indicators for Liveness */}
        {step === "liveness" && currentChallenge.key === "turn_left" && (
          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="absolute left-6 text-primary animate-pulse pointer-events-none">
            <ArrowLeft className="w-12 h-12 drop-shadow-lg" />
          </motion.div>
        )}
        {step === "liveness" && currentChallenge.key === "turn_right" && (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="absolute right-6 text-primary animate-pulse pointer-events-none">
            <ArrowRight className="w-12 h-12 drop-shadow-lg" />
          </motion.div>
        )}

        <canvas ref={canvasRef} width={640} height={480} className="hidden" />
      </div>

      <div className="w-full pt-4 space-y-3">
        {/* Progress bar for liveness */}
        {step === "liveness" && (
          <div className="flex gap-1 justify-center mb-4">
            {challengeSteps.map((s, i) => (
              <div key={s.key} className={`h-1.5 rounded-full w-8 transition-colors duration-300 ${completedChallenges.includes(s.key) ? 'bg-green-500' : i === currentChallengeIndex ? 'bg-primary animate-pulse' : 'bg-slate-200 dark:bg-slate-800'}`} />
            ))}
          </div>
        )}

        {step === "start" && (
          <Button onClick={startCamera} className="w-full h-12 text-base font-bold">
            Start Verification
          </Button>
        )}
        
        {step === "capture-selfie" && (
          <Button onClick={captureFinalSelfie} className="w-full h-12 text-base font-bold bg-green-600 hover:bg-green-700">
            <Camera className="mr-2 w-5 h-5" /> Capture Final Selfie
          </Button>
        )}
      </div>

      {(step === "start" || step === "capture-selfie") && (
        <button onClick={() => { stopCamera(); onCancel() }} className="text-xs text-muted-foreground hover:underline font-medium">
          Cancel and return
        </button>
      )}

      <UploadLoader
        isVisible={step === "verifying"}
        message="Verifying your identity..."
      />
    </div>
  )
}
