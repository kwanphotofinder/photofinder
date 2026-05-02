"use client";

import React, { useState, useRef, useEffect } from "react";
import { Header } from "@/components/header";

interface LivenessDetectionResult {
  blink: boolean;
  head_turn: boolean;
  head_turn_direction: "left" | "right" | null;
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
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const frameInFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameCountRef = useRef(0);

  const challengeSteps = [
    { key: "blink", label: "Blink" },
    { key: "turn_left", label: "Turn left" },
    { key: "turn_right", label: "Turn right" },
    { key: "head_up_down", label: "Look up/down" },
  ];

  const currentChallenge = challengeSteps[currentChallengeIndex] ?? challengeSteps[challengeSteps.length - 1];

  const isTaskComplete = () => {
    if (!livenessData || !livenessData.face_detected) {
      return false;
    }

    return completedChallenges.length === challengeSteps.length;
  };

  useEffect(() => {
    if (!livenessData || !livenessData.face_detected) {
      return;
    }

    console.log('[FRONTEND] Received liveness data:', livenessData);
    console.log('[FRONTEND] Current completed challenges:', completedChallenges);

    const nextCompletedChallenges = [...completedChallenges];

    if (livenessData.blink && !nextCompletedChallenges.includes("blink")) {
      console.log('[FRONTEND] ✓ Blink detected! Adding to completed challenges.');
      nextCompletedChallenges.push("blink");
    } else if (livenessData.blink) {
      console.log('[FRONTEND] Blink detected but already marked complete.');
    } else {
      console.log('[FRONTEND] No blink detected (blink:', livenessData.blink, ')');
    }

    if (livenessData.head_turn_direction === "left" && !nextCompletedChallenges.includes("turn_left")) {
      console.log('[FRONTEND] ✓ Left turn detected!');
      nextCompletedChallenges.push("turn_left");
    }

    if (livenessData.head_turn_direction === "right" && !nextCompletedChallenges.includes("turn_right")) {
      console.log('[FRONTEND] ✓ Right turn detected!');
      nextCompletedChallenges.push("turn_right");
    }

    if ((livenessData.head_up || livenessData.head_down) && !nextCompletedChallenges.includes("head_up_down")) {
      console.log('[FRONTEND] ✓ Head up/down detected!');
      nextCompletedChallenges.push("head_up_down");
    }

    if (nextCompletedChallenges.length !== completedChallenges.length) {
      console.log('[FRONTEND] Updating completed challenges:', nextCompletedChallenges);
      setCompletedChallenges(nextCompletedChallenges);
      const nextChallengeIndex = challengeSteps.findIndex((step) => !nextCompletedChallenges.includes(step.key));
      setCurrentChallengeIndex(nextChallengeIndex === -1 ? challengeSteps.length - 1 : nextChallengeIndex);
    }
  }, [challengeSteps.length, completedChallenges, livenessData]);

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
    setCurrentChallengeIndex(0);
    setCompletedChallenges([]);
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
      console.log('[CANVAS] Drawing video to canvas. Video state:', {
        videoWidth: videoRef.current?.videoWidth,
        videoHeight: videoRef.current?.videoHeight,
        canvasWidth: canvasRef.current.width,
        canvasHeight: canvasRef.current.height,
        videoReadyState: videoRef.current?.readyState
      });
      
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      
      // DEBUG: Check if canvas has actual image data
      const imageData = ctx.getImageData(0, 0, 10, 10);
      const pixels = imageData.data;
      const avgR = pixels[0], avgG = pixels[1], avgB = pixels[2];
      console.log('[CANVAS] Sample pixels (0,0):', { R: avgR, G: avgG, B: avgB, allBlack: avgR === 0 && avgG === 0 && avgB === 0 });
      
      frameCountRef.current++;
      console.log('[FRAME] Processing frame #' + frameCountRef.current);

      try {
        setIsProcessing(true);
        frameInFlightRef.current = true;

        const blob = await new Promise<Blob | null>((resolve) => {
          canvasRef.current?.toBlob((nextBlob) => resolve(nextBlob), "image/jpeg", 0.9);
        });

        if (!isRunningRef.current || !blob) {
          frameInFlightRef.current = false;
          setIsProcessing(false);
          console.log('[FRONTEND] Frame skipped: stopped or blob null');
          return;
        }

        console.log('[BLOB] Created blob - size:', blob.size, 'bytes, type:', blob.type);
        
        const formData = new FormData();
        formData.append("frame", blob, "frame.jpg");

        const controller = new AbortController();
        abortControllerRef.current = controller;

        console.log('[FRONTEND] Sending frame to /api/student/liveness-detect');
        const response = await fetch("/api/student/liveness-detect", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        if (response.ok && isRunningRef.current) {
          const data = await response.json();
          console.log('[API RESPONSE]', {
            face_detected: data.face_detected,
            blink: data.blink,
            confidence: data.confidence,
            head_turn_direction: data.head_turn_direction
          });
          setLivenessData(data);
        } else if (!response.ok) {
          console.log('[FRONTEND] API returned error status:', response.status);
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
    console.log('[VIDEO] Stream assigned to video element. Stream tracks:', streamRef.current.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
    
    videoElement.onloadedmetadata = () => {
      console.log('[VIDEO] Metadata loaded. Video dimensions:', { width: videoElement.videoWidth, height: videoElement.videoHeight });
    };
    
    videoElement.play().catch((err) => {
      console.error('[VIDEO] Play error:', err);
    });
    
    // Monitor video state and FPS
    const interval = setInterval(() => {
      const fps = frameCountRef.current - lastFrameCountRef.current;
      lastFrameCountRef.current = frameCountRef.current;
      console.log('[VIDEO] FPS:', fps, 'Total frames:', frameCountRef.current, 'State:', {
        readyState: videoElement.readyState,
        networkState: videoElement.networkState,
        paused: videoElement.paused,
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight
      });
    }, 1000);

    startLivenessDetection();

    return () => {
      clearInterval(interval);
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
              {/* Active Challenge Prompt - Top Left */}
              {testStarted && (
                <div className="absolute left-3 top-3 z-10 rounded-lg bg-blue-600 px-4 py-3 shadow-lg border-2 border-blue-400">
                  <p className="text-xs font-semibold text-blue-100 uppercase tracking-wide">Current Challenge</p>
                  <p className="text-lg font-bold text-white mt-1">{currentChallenge.label}</p>
                </div>
              )}
              {/* Overall Status Badge - Top Right */}
              {testStarted && (
                <div className="absolute right-3 top-3 z-10 rounded-lg px-4 py-3 shadow-lg border-2 font-bold"
                  style={isTaskComplete() ? {
                    backgroundColor: '#10b981',
                    borderColor: '#059669',
                  } : {
                    backgroundColor: '#ef4444',
                    borderColor: '#dc2626',
                  }}>
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">{isTaskComplete() ? 'All Done!' : 'In Progress'}</p>
                  <p className="text-lg text-white mt-1">{isTaskComplete() ? "✓ Complete" : "⏳ Incomplete"}</p>
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
                <div className="w-full space-y-6">
                  {/* Face Detection Status */}
                  <div>
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

                  {/* Step Progress */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-3">Verification Progress</h3>
                    <div className="space-y-2">
                      {challengeSteps.map((step, index) => {
                        const isCompleted = completedChallenges.includes(step.key);

                        return (
                          <div
                            key={step.key}
                            className={`flex items-center justify-between rounded-lg px-4 py-3 border-2 font-semibold transition-all ${
                              isCompleted
                                ? "border-green-300 bg-green-50 text-green-800"
                                : index === currentChallengeIndex
                                ? "border-blue-400 bg-blue-50 text-blue-900 ring-2 ring-blue-200"
                                : "border-slate-200 bg-slate-50 text-slate-500"
                            }`}
                          >
                            <span>{step.label}</span>
                            {isCompleted && (
                              <span className="inline-flex items-center gap-1 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
                                ✓ Completed
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
