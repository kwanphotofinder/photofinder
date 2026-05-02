"use client"

import { ReactNode } from "react"

// VerificationGuard is now non-blocking.
// Students are prompted to verify via the dashboard button instead.
export function VerificationGuard({ children }: { children: ReactNode }) {
  return <>{children}</>
}
