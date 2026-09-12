"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ProfileRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    const role = (localStorage.getItem("user_role") || "student").toLowerCase()
    if (role === "admin" || role === "super_admin") {
      router.replace("/admin/profile")
    } else if (role === "photographer") {
      router.replace("/photographer/profile")
    } else {
      router.replace("/settings")
    }
  }, [router])

  return null
}
