"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Webcam from "react-webcam"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, RefreshCw, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UploadLoader } from "@/components/upload-loader"
import { toast } from "sonner"

interface IdentityVerificationProps {
  onSuccess: (frontSelfie: string) => void
  onCancel: () => void
}

type VerificationStep = "start" | "align" | "capture-front" | "challenge" | "verifying" | "success" | "error"

export function IdentityVerification({ onSuccess, onCancel }: IdentityVerificationProps) {
  const [step, setStep] = useState<VerificationStep>("start")
  const [direction, setDirection] = useState<"left" | "right">("left")
  const [frontImage, setFrontImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const webcamRef = useRef<Webcam>(null)

  // Start the challenge by randomly picking a direction
  const startChallenge = useCallback(() => {
    setDirection(Math.random() > 0.5 ? "left" : "right")
    setStep("challenge")
  }, [])

  const captureFront = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) {
      setFrontImage(imageSrc)
      startChallenge()
    } else {
      toast.error("Could not capture photo. Please check your camera.")
    }
  }, [startChallenge])

  const verifyIdentity = useCallback(async (tiltImage: string) => {
    if (!frontImage) return

    setStep("verifying")
    try {
      const authToken = localStorage.getItem("auth_token")
      const response = await fetch("/api/verify-identity", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          frontImage,
          tiltImage,
          challenge: direction
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setStep("success")
        setTimeout(() => onSuccess(frontImage), 2000)
      } else {
        setError(result.error || "Verification failed. Please try again.")
        setStep("error")
      }
    } catch (err) {
      setError("Server error. Please try again later.")
      setStep("error")
    }
  }, [frontImage, direction, onSuccess])

  const captureTilt = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (imageSrc) {
      verifyIdentity(imageSrc)
    }
  }, [verifyIdentity])

  // Simple auto-capture for tilt (in a real app, we'd use MediaPipe in browser for better detection)
  useEffect(() => {
    if (step === "challenge") {
      const timer = setTimeout(() => {
        captureTilt()
      }, 3000) // Give user 3 seconds to turn
      return () => clearTimeout(timer)
    }
  }, [step, captureTilt])

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6 max-w-md mx-auto bg-card rounded-2xl border shadow-xl">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Identity Guard</h2>
        <p className="text-sm text-muted-foreground">
          {step === "start" && "Prove you're human to secure your account."}
          {step === "align" && "Center your face in the circle. (Don't stay too close!)"}
          {step === "capture-front" && "Looking good! Stay still..."}
          {step === "challenge" && `Now, turn your head to the ${direction.toUpperCase()}.`}
          {step === "verifying" && "Checking liveness and identity..."}
          {step === "success" && "Identity Verified Successfully!"}
          {step === "error" && (
            <span className="text-destructive font-semibold">
              {error || "Verification failed. Please try again."}
            </span>
          )}
        </p>
      </div>

      <div className="relative w-72 h-72 rounded-full overflow-hidden border-4 border-primary shadow-inner bg-black">
        <AnimatePresence mode="wait">
          {(step !== "success" && step !== "error") ? (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover"
                videoConstraints={{
                  width: 400,
                  height: 400,
                  facingMode: "user",
                }}
              />
              {/* Overlay for alignment */}
              <div className="absolute inset-0 border-[40px] border-black/40 rounded-full pointer-events-none" />
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
              key="error"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full h-full flex items-center justify-center bg-destructive/10"
            >
              <AlertCircle className="w-24 h-24 text-destructive" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Direction Indicator */}
        {step === "challenge" && (
          <motion.div
            initial={{ x: direction === "left" ? 20 : -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center w-full pointer-events-none"
          >
            {direction === "left" ? (
              <ArrowLeft className="w-16 h-16 text-primary animate-pulse" />
            ) : (
              <ArrowRight className="w-16 h-16 text-primary animate-pulse" />
            )}
          </motion.div>
        )}
      </div>

      <div className="w-full pt-4">
        {step === "start" && (
          <Button onClick={() => setStep("align")} className="w-full">
            Start Verification
          </Button>
        )}
        {step === "align" && (
          <Button onClick={captureFront} className="w-full">
            <Camera className="mr-2 w-4 h-4" /> Take Selfie
          </Button>
        )}
        {(step === "error") && (
          <Button onClick={() => {
            setError(null)
            setStep("start")
          }} variant="outline" className="w-full">
            <RefreshCw className="mr-2 w-4 h-4" /> Try Again
          </Button>
        )}
      </div>

      {step === "start" && (
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:underline">
          Cancel and return
        </button>
      )}

      {/* Ghostsmart loader overlay during verification */}
      <UploadLoader
        isVisible={step === "verifying"}
        message="Verifying your identity..."
      />
    </div>
  )
}
