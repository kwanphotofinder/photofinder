"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"

interface CinematicLoaderProps {
  onComplete: () => void
}

export function CinematicLoader({ onComplete }: CinematicLoaderProps) {
  const [phase, setPhase] = useState<"walking" | "converging" | "complete">("walking")

  useEffect(() => {
    // Preload all assets to prevent any layout decoding flicker
    const img = new Image()
    img.src = '/background.jpg'
    const logoImg = new Image()
    logoImg.src = '/Logo2.png'
    const introLogo = new Image()
    introLogo.src = '/Logo.png'

    // Phase transitions
    const convergeTimer = setTimeout(() => setPhase("converging"), 4500)
    const completeTimer = setTimeout(() => {
      onComplete()
    }, 7000)

    return () => {
      clearTimeout(convergeTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* App Theme Dark Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-none" />

      {/* Background Water Surface Caustics */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => {
          const colors = [
            'bg-cyan-300/20',
            'bg-white/30',
            'bg-sky-400/20',
            'bg-teal-300/15',
            'bg-white/15',
            'bg-cyan-400/15'
          ]
          return (
            <motion.div
              key={`water-caustic-${i}`}
              initial={{ scale: 0, opacity: 0, y: -150, x: (i - 2.5) * 350 }}
              animate={{
                scale: [0.5, 3.5, 6],
                opacity: [0, 0.5, 0],
                y: [-100, 300, 600],
              }}
              transition={{
                duration: 14,
                delay: i * 2,
                repeat: Infinity,
                ease: "easeOut"
              }}
              className={`absolute left-1/2 top-0 w-[500px] h-[500px] rounded-full blur-[70px] will-change-transform transform-gpu ${colors[i]}`}
              style={{ filter: 'url(#smokeFilter)' }}
            />
          )
        })}
      </div>

      {/* SVG Filter Definition (Safari Optimized) */}
      <svg className="hidden">
        <defs>
          <filter id="smokeFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="1" />
            <feDisplacementMap in="SourceGraphic" scale="120" />
          </filter>
        </defs>
      </svg>

      {/* The Official Logo */}
      <div className="relative flex items-center justify-center w-full px-8 h-[70vh]">
        {/* White Silhouette Logo */}
        <motion.img
          src="/Logo.png"
          alt="Official Logo"
          initial={{ 
            opacity: 0, 
            scale: 0.85, 
            filter: "grayscale(1) brightness(0) invert(1) blur(20px)" 
          }}
          animate={{ 
            opacity: [0, 1, 1, 0],
            scale: 1.15,
            filter: [
              "grayscale(1) brightness(0) invert(1) blur(20px)",
              "grayscale(1) brightness(0) invert(1) blur(0px)",
              "grayscale(1) brightness(0) invert(1) blur(0px)",
              "grayscale(1) brightness(0) invert(1) blur(0px)"
            ]
          }}
          transition={{ 
            opacity: {
              duration: 7,
              times: [0, 0.2, 0.6, 0.8],
              ease: "easeInOut"
            },
            scale: {
              duration: 7,
              ease: "linear"
            },
            filter: {
              duration: 7,
              times: [0, 0.2, 0.6, 0.8],
              ease: "easeInOut"
            }
          }}
          className="absolute h-[70vh] w-auto max-w-[85vw] object-contain"
        />

        {/* Full Color Logo Overlay */}
        <motion.img
          src="/Logo.png"
          alt="Official Logo"
          initial={{ 
            opacity: 0, 
            scale: 0.85, 
            filter: "brightness(1.5) contrast(1.2) drop-shadow(0 0 50px rgba(255,255,255,0.8))" 
          }}
          animate={{ 
            opacity: [0, 0, 1, 1],
            scale: 1.15,
          }}
          transition={{ 
            opacity: {
              duration: 7,
              times: [0, 0.6, 0.8, 1],
              ease: "easeInOut"
            },
            scale: {
              duration: 7,
              ease: "linear"
            }
          }}
          className="absolute h-[70vh] w-auto max-w-[85vw] object-contain"
        />
      </div>

      {/* Soft Top Lighting */}
      <div className="absolute top-0 w-full h-[30vh] bg-gradient-to-b from-white to-transparent" />
    </motion.div>
  )
}
