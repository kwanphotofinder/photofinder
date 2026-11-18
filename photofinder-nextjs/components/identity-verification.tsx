"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, Eye, StopCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UploadLoader } from "@/components/upload-loader"
import { useLanguage } from "@/lib/language-context"

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
  blink_state?: string | null;
}

// Liveness frames only need enough pixels for landmark detection. Smaller
// uploads make the first "Face Detected" response arrive much sooner.
const LIVENESS_FRAME_MAX_WIDTH = 480

const createLivenessSessionId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const challengeSteps = [
  { key: "blink", labelKey: "liveness.challenge_blink", icon: Eye },
  { key: "turn_left", labelKey: "liveness.challenge_turn_left", icon: ArrowLeft },
  { key: "turn_right", labelKey: "liveness.challenge_turn_right", icon: ArrowRight },
]

export function IdentityVerification({ onSuccess, onCancel }: IdentityVerificationProps) {
  const { t } = useLanguage()
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
  const livenessCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const livenessSessionIdRef = useRef<string | null>(null)
  // Temporal blink state round-tripped with the AI service (so it can run multi-worker).
  const blinkStateRef = useRef<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const frameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const livenessRunIdRef = useRef(0)
  const isRunningRef = useRef(false)
  const frameInFlightRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const [videoMounted, setVideoMounted] = useState(false)

  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    setVideoMounted(!!node)
  }, [])

  const currentChallenge = challengeSteps[currentChallengeIndex] ?? challengeSteps[challengeSteps.length - 1]

  const stopLivenessDetection = useCallback(() => {
    isRunningRef.current = false
    livenessRunIdRef.current += 1
    frameInFlightRef.current = false
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (frameTimeoutRef.current) {
      clearTimeout(frameTimeoutRef.current)
      frameTimeoutRef.current = null
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
    return () => {
      stopCamera()
      audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [stopCamera])

  const prepareCompletionSound = async () => {
    if (typeof window === "undefined") return

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume()
      }
    } catch (error) {
      console.warn("Unable to prepare verification completion sound:", error)
    }
  }

  const playStepCompletionSound = useCallback(() => {
    const audioContext = audioContextRef.current
    if (!audioContext || audioContext.state !== "running") return

    const now = audioContext.currentTime
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(880, now)
    oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.12)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.24)
  }, [])

  const startCamera = async () => {
    try {
      stopCamera()
      setError(null)
      await prepareCompletionSound()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
      })
      streamRef.current = stream
      setStep("liveness")
    } catch (err) {
      setError(t("liveness.err_camera"))
      setStep("error")
    }
  }

  // Attach stream and start detection when video element mounts
  useEffect(() => {
    if ((step === "liveness" || step === "capture-selfie") && videoMounted && videoRef.current && streamRef.current) {
      const video = videoRef.current
      const stream = streamRef.current
      let cancelled = false

      const startVideo = async () => {
        if (video.srcObject !== stream) {
          video.srcObject = stream
        }

        if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
          await new Promise<void>((resolve) => {
            video.addEventListener("loadedmetadata", () => resolve(), { once: true })
          })
        }

        await video.play()

        if (cancelled || video.videoWidth === 0 || video.videoHeight === 0) return

        if (canvasRef.current) {
          canvasRef.current.width = video.videoWidth
          canvasRef.current.height = video.videoHeight
        }

        if (step === "liveness") {
          startLivenessDetection()
        }
      }

      startVideo().catch((error) => {
        if (!cancelled) console.error("Unable to start camera video:", error)
      })

      return () => {
        cancelled = true
      }
    }
  }, [step, videoMounted])

  const startLivenessDetection = () => {
    if (isRunningRef.current) return
    isRunningRef.current = true
    const runId = ++livenessRunIdRef.current
    livenessSessionIdRef.current = createLivenessSessionId()
    blinkStateRef.current = null // fresh blink tracking for this attempt

    const processFrame = async () => {
      let nextFrameDelayMs = 120
      if (runId !== livenessRunIdRef.current || !isRunningRef.current || !videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      if (
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        if (runId === livenessRunIdRef.current && isRunningRef.current) {
          animationFrameRef.current = requestAnimationFrame(processFrame)
        }
        return
      }

      if (frameInFlightRef.current) {
        if (runId === livenessRunIdRef.current && isRunningRef.current) {
          animationFrameRef.current = requestAnimationFrame(processFrame)
        }
        return
      }

      if (!livenessCanvasRef.current) {
        livenessCanvasRef.current = document.createElement("canvas")
      }
      const canvas = livenessCanvasRef.current
      const scale = Math.min(1, LIVENESS_FRAME_MAX_WIDTH / video.videoWidth)
      const frameWidth = Math.round(video.videoWidth * scale)
      const frameHeight = Math.round(video.videoHeight * scale)
      if (canvas.width !== frameWidth || canvas.height !== frameHeight) {
        canvas.width = frameWidth
        canvas.height = frameHeight
      }

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      ctx.drawImage(video, 0, 0, frameWidth, frameHeight)

      try {
        frameInFlightRef.current = true

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
        })

        if (runId !== livenessRunIdRef.current || !isRunningRef.current || !blob) {
          frameInFlightRef.current = false
          return
        }

        const formData = new FormData()
        formData.append("frame", blob, "frame.jpg")
        if (livenessSessionIdRef.current) {
          formData.append("session_id", livenessSessionIdRef.current)
        }
        if (blinkStateRef.current) {
          formData.append("blink_state", blinkStateRef.current)
        }

        const controller = new AbortController()
        abortControllerRef.current = controller

        const authToken = localStorage.getItem("auth_token")
        const response = await fetch("/api/student/liveness-detect", {
          method: "POST",
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
          body: formData,
          signal: controller.signal,
        })

        if (response.ok && isRunningRef.current) {
          const data = await response.json()
          // Persist the updated blink state for the next frame (only when present, so a
          // no-face frame doesn't wipe progress).
          if (typeof data.blink_state === "string") {
            blinkStateRef.current = data.blink_state
          }
          setLivenessData(data)
        } else if (response.status === 429) {
          // Respect the limiter instead of hammering it; resume after the window.
          const retryAfter = Number(response.headers.get("Retry-After")) || 1
          nextFrameDelayMs = Math.min(retryAfter, 10) * 1000
        }
      } catch (err: any) {
        if (runId === livenessRunIdRef.current && err.name !== "AbortError") {
          console.error("Liveness detection error:", err)
        }
      } finally {
        if (runId !== livenessRunIdRef.current) return

        frameInFlightRef.current = false
        abortControllerRef.current = null
      }

      if (runId === livenessRunIdRef.current && isRunningRef.current) {
        // 120ms throttle keeps mobile CPU cool and network smooth (~8 FPS)
        frameTimeoutRef.current = setTimeout(() => {
          frameTimeoutRef.current = null
          if (runId === livenessRunIdRef.current && isRunningRef.current) {
            animationFrameRef.current = requestAnimationFrame(processFrame)
          }
        }, nextFrameDelayMs)
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
      playStepCompletionSound()
      const nextCompleted = [...completedChallenges, activeChallenge.key]
      setCompletedChallenges(nextCompleted)

      const newNextIndex = challengeSteps.findIndex((s) => !nextCompleted.includes(s.key))
      setCurrentChallengeIndex(newNextIndex === -1 ? challengeSteps.length - 1 : newNextIndex)

      if (nextCompleted.length === challengeSteps.length) {
        // Challenges complete: Capture anchor image silently with true aspect ratio
        if (canvasRef.current && videoRef.current) {
          const video = videoRef.current
          const canvas = canvasRef.current
          const videoW = video.videoWidth || 640
          const videoH = video.videoHeight || 480
          canvas.width = videoW
          canvas.height = videoH

          const ctx = canvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(video, 0, 0, videoW, videoH)
            setAnchorImage(canvas.toDataURL("image/jpeg", 0.9))
            stopLivenessDetection()
            setStep("capture-selfie")
          }
        }
      }
    }
  }, [livenessData, step, completedChallenges, challengeSteps, playStepCompletionSound])

  const captureFinalSelfie = async () => {
    if (!anchorImage || !videoRef.current || !canvasRef.current) return

    setStep("verifying")
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const videoW = video.videoWidth || 1280
      const videoH = video.videoHeight || 720
      canvas.width = videoW
      canvas.height = videoH

      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.drawImage(video, 0, 0, videoW, videoH)
      const selfieDataUrl = canvas.toDataURL("image/jpeg", 0.9)

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
        throw new Error(data.error || t("liveness.err_identity_mismatch"))
      }
    } catch (err: any) {
      const newRetryCount = retryCount + 1
      setRetryCount(newRetryCount)

      if (newRetryCount >= 3) {
        setError(t("liveness.err_too_many_attempts"))
        setStep("error")
        setTimeout(() => {
          setAnchorImage(null)
          setRetryCount(0)
          setCompletedChallenges([])
          setCurrentChallengeIndex(0)
          startCamera() // Restart liveness
        }, 3000)
      } else {
        setError(`${err.message} (${t("liveness.attempt")} ${newRetryCount}/3)`)
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
        <h2 className="text-2xl font-bold tracking-tight">{t("liveness.title")}</h2>
        <p className="text-sm text-muted-foreground min-h-[40px]">
          {step === "start" && t("liveness.step_start_desc")}
          {step === "liveness" && (
            <span className="flex items-center justify-center gap-2 font-medium text-primary">
              <currentChallenge.icon className="w-4 h-4 animate-pulse" />
              {t(currentChallenge.labelKey)}
            </span>
          )}
          {step === "capture-selfie" && t("liveness.step_capture_desc")}
          {step === "verifying" && t("liveness.step_verifying_desc")}
          {step === "success" && t("liveness.step_success_desc")}
          {step === "error" && (
            <span className="text-destructive font-semibold">
              {error || t("liveness.step_error_desc")}
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
              <div className="absolute inset-0 border-8 border-black/20 rounded-full pointer-events-none" />

              {/* Liveness Overlay */}
              {step === "liveness" && livenessData && (
                <div className="absolute bottom-5 left-0 right-0 z-20 flex justify-center">
                  <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full shadow-md backdrop-blur-xs ${livenessData.face_detected ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                    {livenessData.face_detected ? t("liveness.face_detected") : t("liveness.no_face")}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Direction Indicators for Liveness */}
        {step === "liveness" && currentChallenge.key === "turn_left" && (
          <motion.div
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: [0, -6, 0], opacity: 1 }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="absolute left-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-primary shadow-xl ring-2 ring-primary/40 pointer-events-none"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
          </motion.div>
        )}
        {step === "liveness" && currentChallenge.key === "turn_right" && (
          <motion.div
            initial={{ x: 10, opacity: 0 }}
            animate={{ x: [0, 8, 0], opacity: 1 }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="absolute right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-primary shadow-xl ring-2 ring-primary/40 pointer-events-none"
          >
            <ArrowRight className="w-6 h-6 stroke-[2.5]" />
          </motion.div>
        )}
        {step === "liveness" && currentChallenge.key === "blink" && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: [1, 1.12, 1], opacity: 1 }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="absolute top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-primary shadow-xl ring-2 ring-primary/40 pointer-events-none"
          >
            <Eye className="w-5 h-5 stroke-[2.2]" />
          </motion.div>
        )}

        <canvas ref={canvasRef} className="hidden" />
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
            {t("liveness.btn_start")}
          </Button>
        )}

        {step === "capture-selfie" && (
          <Button onClick={captureFinalSelfie} className="w-full h-12 text-base font-bold bg-green-600 hover:bg-green-700">
            <Camera className="mr-2 w-5 h-5" /> {t("liveness.btn_capture")}
          </Button>
        )}

        {step === "liveness" && (
          <Button onClick={() => { stopCamera(); onCancel() }} variant="outline" className="w-full h-10">
            <StopCircle className="mr-2 w-4 h-4" /> {t("liveness.btn_stop")}
          </Button>
        )}
      </div>

      {(step === "start" || step === "capture-selfie") && (
        <button onClick={() => { stopCamera(); onCancel() }} className="text-xs text-muted-foreground hover:underline font-medium">
          {t("liveness.btn_cancel")}
        </button>
      )}

      <UploadLoader
        isVisible={step === "verifying"}
        message={t("liveness.loader_verifying")}
      />
    </div>
  )
}