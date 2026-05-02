"use client";

import React, { useState, useRef, useEffect } from "react";
import { Header } from "@/components/header";

interface LivenessDetectionResult {
  blink: boolean;
  head_turn: boolean;
  head_up: boolean;
  head_down: boolean;
  face_detected: boolean;
  confidence: number;
}

export default function LiveFaceVerificationPage() {
  const [testStarted, setTestStarted] = useState(false);
  const [livenessData, setLivenessData] = useState<LivenessDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const frameInFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isTaskComplete = () => {
    if (!livenessData || !livenessData.face_detected) {
      return false;
    }

    return !livenessData.blink && !livenessData.head_turn && !livenessData.head_up && !livenessData.head_down;
  };

  const startTest = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setTestStarted(true);
    } catch (err) {
      setError("Unable to access camera. Please ensure you have granted camera permissions.");
      console.error(err);
    }
  };

  const stopTest = () => {
    isRunningRef.current = false;
    frameInFlightRef.current = false;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setTestStarted(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setLivenessData(null);
  };

  const startLivenessDetection = () => {
    if (isRunningRef.current) {
      return;
    }

    isRunningRef.current = true;

    const processFrame = async () => {
      if (!isRunningRef.current || !videoRef.current || !canvasRef.current) return;

      if (frameInFlightRef.current) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      // Draw video frame to canvas
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      try {
        setIsProcessing(true);
        frameInFlightRef.current = true;

        const blob = await new Promise<Blob | null>((resolve) => {
          canvasRef.current?.toBlob((nextBlob) => resolve(nextBlob), "image/jpeg", 0.9);
        });

        if (!isRunningRef.current || !blob) {
          frameInFlightRef.current = false;
          setIsProcessing(false);
          return;
        }

        const formData = new FormData();
        formData.append("frame", blob, "frame.jpg");

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await fetch("/api/student/liveness-detect", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        if (response.ok && isRunningRef.current) {
          const data = await response.json();
          setLivenessData(data);
        }
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          console.error("Liveness detection error:", err);
        }
      } finally {
        frameInFlightRef.current = false;
        abortControllerRef.current = null;
        setIsProcessing(false);
      }

      // Process next frame
      if (isRunningRef.current) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);
  };

  useEffect(() => {
    if (!testStarted || !streamRef.current || !videoRef.current) {
      return;
    }

    const videoElement = videoRef.current;
    videoElement.srcObject = streamRef.current;
    videoElement.play().catch((err) => {
      console.error("Video play error:", err);
    });

    startLivenessDetection();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [testStarted]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header userRole="student" showLogout={true} />

      <div className="max-w-4xl mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-4">Live Face Verification</h1>
        <p className="mb-6 text-slate-700">
          Capture your live face to set your reference vector. This vector will be used to verify your identity and prevent unauthorized photo searches.
        </p>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Webcam and Detection Section */}
        <div className="space-y-6">
          {/* Video Preview Area */}
          <div className="rounded-lg border border-slate-300 bg-black p-4 shadow-lg">
            <div className="relative overflow-hidden rounded-lg bg-black">
              <div className="absolute left-3 top-3 z-10 max-w-[60%] rounded-md bg-slate-950/80 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm">
                Challenge: blink, look down, turn left...
              </div>
              {testStarted && (
                <div className="absolute right-3 top-3 z-10 max-w-[40%] rounded-md border border-red-300 bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-lg">
                  {isTaskComplete() ? "Complete" : "Incomplete"}
                </div>
              )}
              <video
                ref={videoRef}
                className="w-full h-auto min-h-[28rem] object-cover bg-black"
                autoPlay
                muted
                playsInline
              />
              {!testStarted && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-center px-6">
                  <div>
                    <p className="text-lg font-semibold">Camera preview will appear here.</p>
                    <p className="text-sm text-white/80 mt-2">Click Start Live Test to enable your device camera.</p>
                  </div>
                </div>
              )}
            </div>
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="hidden"
            />
          </div>

          {/* Start Button */}
          {!testStarted ? (
            <div className="rounded-lg border border-slate-200 p-8 bg-white shadow-lg">
              <div className="flex flex-col items-center gap-6">
                <p className="text-slate-600 text-center text-lg">Ready to get started? Click the button below to begin your live face verification.</p>
                <button
                  onClick={startTest}
                  className="px-12 py-4 bg-gradient-to-r from-primary to-primary/80 text-white font-semibold rounded-lg hover:shadow-lg hover:from-primary/90 hover:to-primary/70 transition-all duration-300 text-lg"
                >
                  Start Live Test
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 p-6 bg-white shadow-lg space-y-6">
              {/* Real-time Feedback */}
              {livenessData && (
                <div className="w-full">
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">Face Detection</h3>
                  <div
                    className={`p-5 rounded-lg font-semibold text-center text-base transition-colors ${
                      livenessData.face_detected
                        ? "bg-green-50 text-green-800 border border-green-200"
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                  >
                    {livenessData.face_detected ? "✓ Face Detected" : "✗ No Face Detected"}
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                {isProcessing && <p className="text-slate-600 text-base font-medium">Analyzing... 🔍</p>}
                {!isProcessing && livenessData && (
                  <p className="text-slate-600 text-base">
                    Confidence: <span className="font-semibold text-lg">{(livenessData.confidence * 100).toFixed(1)}%</span>
                  </p>
                )}
                {!livenessData && !isProcessing && <p className="text-slate-500 text-sm">Waiting for face detection...</p>}
              </div>

              {/* Stop Button */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={stopTest}
                  className="px-8 py-3 bg-slate-500 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors duration-300 text-base"
                >
                  Stop Test
                </button>
              </div>
            </div>
          )}

          {/* Important Notice - Below Button */}
          <div className="rounded-lg border-l-4 border-l-amber-500 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-amber-900 mb-3">⚠️ Verification Required</h2>
            <p className="text-amber-800 mb-3">
              To use the photo search function, you <strong>must complete this live face verification test</strong>. This is required to ensure that the reference photos you use to search are actually photos of your own face, and to prevent unauthorized searches using other people's photos without permission.
            </p>
            <p className="text-sm text-amber-700">
              By completing this verification, you confirm that you are the person in the photos you will use for searching.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
