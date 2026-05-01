"use client"

import { motion, AnimatePresence } from "framer-motion"

interface UploadLoaderProps {
  isVisible: boolean
  message?: string
}

export function UploadLoader({ isVisible, message = "AI is analyzing..." }: UploadLoaderProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(24px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/60"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ duration: 0.4, ease: "backOut" }}
            className="relative flex flex-col items-center max-w-xs text-center px-6"
          >
            {/* Atmospheric Background Glow */}
            <div className="absolute -inset-20 bg-primary/30 blur-[120px] rounded-full animate-pulse" />
            
            {/* Ghostsmart Mascot */}
            <motion.div
              animate={{ 
                y: [0, -15, 0],
                rotate: [-2, 2, -2]
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="relative z-10 drop-shadow-[0_20px_50px_rgba(130,24,26,0.3)]"
            >
              <img 
                src="/Ghostsmart.gif" 
                alt="AI Mascot" 
                className="h-64 w-64 object-contain" 
              />
            </motion.div>

            {/* Loading Content */}
            <div className="relative z-10 mt-8 space-y-4">
              <motion.h3 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-black text-white tracking-tight"
              >
                {message}
              </motion.h3>
              
              <p className="text-white/60 text-sm font-medium leading-relaxed">
                We're mapping your unique features to find your moments across campus.
              </p>

              {/* Progress Dots */}
              <div className="flex justify-center gap-2 pt-4">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      scale: [1, 1.5, 1],
                      opacity: [0.3, 1, 0.3],
                      backgroundColor: ["#82181a", "#ffffff", "#82181a"]
                    }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity, 
                      delay: i * 0.3 
                    }}
                    className="h-2.5 w-2.5 rounded-full shadow-[0_0_15px_rgba(130,24,26,0.5)]"
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Background Detail */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
