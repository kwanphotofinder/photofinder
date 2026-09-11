"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Camera, ChevronDown, User, Mail, LogOut, Settings, Shield } from "lucide-react"
import { Navigation } from "./navigation"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"

interface HeaderProps {
  showLogout?: boolean
  userRole?: "student" | "photographer" | "admin"
}

export function Header({ showLogout = false, userRole = "student" }: HeaderProps) {
  const router = useRouter()
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [userAvatar, setUserAvatar] = useState("")

  useEffect(() => {
    // Both admin and regular users now use the same Google login flow, 
    // so we can read from user_data and user_email for everyone
    const storedName = localStorage.getItem("user_name") || localStorage.getItem("admin_name")
    const storedEmail = localStorage.getItem("user_email") || (userRole === "admin" ? "admin@university.edu" : "student@mfu.ac.th")
    const storedData = localStorage.getItem("user_data")
    
    if (storedName) setUserName(storedName)
    setUserEmail(storedEmail)
    
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData)
        if (parsed.avatarUrl) setUserAvatar(parsed.avatarUrl)
      } catch (e) {}
    }
  }, [userRole])

  const handleLogout = () => {
    if (userRole === "admin") {
      localStorage.removeItem("admin_token")
      localStorage.removeItem("admin_name")
      router.push("/")
    } else {
      localStorage.removeItem("auth_token")
      localStorage.removeItem("user_name")
      localStorage.removeItem("user_id")
      localStorage.removeItem("user_email")
      router.push("/")
    }
  }

  const getHomeRoute = () => {
    if (userRole === "admin") return "/admin/dashboard"
    if (userRole === "photographer") return "/photographer"
    return "/dashboard"
  }

  const isAdmin = userRole === "admin"

  return (
    <header className={isAdmin 
      ? "sticky top-0 z-40 bg-[#82181A] border-b-2 border-[#C59B27] shadow-sm text-white" 
      : "sticky top-0 z-40 bg-white/30 dark:bg-black/30 backdrop-blur-md border-b border-white/20 shadow-sm transition-all duration-300"
    }>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex justify-between items-center">
        <div className="flex items-center gap-6">
          {isAdmin ? (
            <div
              className="flex items-center gap-3 cursor-pointer py-1 select-none"
              onClick={() => router.push(getHomeRoute())}
            >
              <div className="bg-white rounded-md p-1 shadow-xs flex items-center justify-center">
                <img src="/Logo2.png" alt="Photo Finder" className="h-8 sm:h-9 w-auto" />
              </div>
              <div className="flex flex-col border-l border-white/25 pl-3">
                <span className="text-xs sm:text-sm font-bold text-white tracking-wide leading-tight">
                  ส่วนทะเบียนและประมวลผล
                </span>
                <span className="text-[10px] sm:text-[11px] text-[#E5A823] font-medium tracking-wider uppercase">
                  REG MFU • Admin Portal
                </span>
              </div>
            </div>
          ) : (
            <div
              className="cursor-pointer"
              onClick={() => router.push(getHomeRoute())}
            >
              <img src="/Logo2.png" alt="Photo Finder" className="h-14 w-auto" />
            </div>
          )}
          <Navigation userRole={userRole} />
        </div>

        {userName && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {isAdmin ? (
                <Button variant="ghost" className="flex items-center gap-2 h-auto py-1.5 px-3 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white shadow-xs transition-colors">
                  <Avatar className="w-8 h-8 ring-1 ring-white/40 flex-shrink-0">
                    <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />
                    <AvatarFallback className="bg-[#C59B27] text-white font-bold text-xs">{userName ? userName[0].toUpperCase() : "A"}</AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-white leading-tight truncate max-w-[120px]">{userName || "Admin"}</span>
                    <span className="text-[10px] text-[#E5A823] leading-tight font-medium">REG ADMIN</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-white/80 hidden sm:block" />
                </Button>
              ) : (
                <Button variant="ghost" className="relative flex items-center gap-2 h-auto py-2 px-3 rounded-full bg-white/40 hover:bg-white/60 border border-white/60 hover:border-white/80 shadow-sm hover:shadow-md transition-all duration-300 group backdrop-blur-sm">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Avatar className="w-10 h-10 ring-2 ring-primary/30 flex-shrink-0 relative z-10 shadow-md">
                    <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white font-semibold">{userName ? userName[0].toUpperCase() : "U"}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-4 h-4 text-slate-600 hidden sm:block transition-transform duration-300 group-hover:text-slate-900 relative z-10" />
                </Button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 rounded-lg border border-slate-200 bg-white shadow-lg p-2.5 text-slate-800 animate-in fade-in-0 zoom-in-95 duration-150">
              {/* Header Card */}
              <div className="rounded-md bg-slate-50 border border-slate-200 p-3 mb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="w-11 h-11 ring-1 ring-slate-300">
                    <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />
                    <AvatarFallback className="bg-[#82181A] text-white text-base font-bold">{userName ? userName[0].toUpperCase() : "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-0.5 min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 leading-tight truncate">{userName}</div>
                    <div className="text-xs text-slate-500 truncate">{userEmail}</div>
                    <div className="text-[11px] font-semibold text-[#82181A] mt-0.5">
                      {isAdmin ? "🏛️ เจ้าหน้าที่ส่วนทะเบียน (Admin)" : userRole === "photographer" ? "📷 Photographer" : "👤 Student"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-200 my-1" />

              {/* Menu Items */}
              <div className="space-y-1 py-0.5">
                <DropdownMenuItem
                  onClick={() =>
                    router.push(
                      isAdmin
                        ? "/admin/profile"
                        : userRole === "photographer"
                          ? "/photographer/profile"
                          : "/settings",
                    )
                  }
                  className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 focus:bg-slate-100 cursor-pointer flex items-center gap-2.5 text-sm"
                >
                  <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-800">ข้อมูลบัญชีผู้ดูแล</span>
                    <span className="text-[10px] text-slate-500">Account Profile & Access</span>
                  </div>
                </DropdownMenuItem>

                {isAdmin && (
                  <DropdownMenuItem
                    onClick={() => router.push("/admin/settings")}
                    className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 focus:bg-slate-100 cursor-pointer flex items-center gap-2.5 text-sm"
                  >
                    <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
                      <Settings className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-800">ตั้งค่าระบบ</span>
                      <span className="text-[10px] text-slate-500">Admin Settings</span>
                    </div>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => router.push("/privacy")}
                  className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 focus:bg-slate-100 cursor-pointer flex items-center gap-2.5 text-sm"
                >
                  <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-800">นโยบายความเป็นส่วนตัว</span>
                    <span className="text-[10px] text-slate-500">Privacy & PDPA Policy</span>
                  </div>
                </DropdownMenuItem>
              </div>

              <div className="h-px bg-slate-200 my-1" />

              {/* Sign Out */}
              <DropdownMenuItem
                onClick={handleLogout}
                className="rounded-md px-3 py-2 text-red-700 hover:bg-red-50 focus:bg-red-50 cursor-pointer flex items-center gap-2.5 text-sm"
              >
                <div className="w-7 h-7 rounded-md bg-red-100 flex items-center justify-center text-red-600">
                  <LogOut className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-red-700">ออกจากระบบ</span>
                  <span className="text-[10px] text-red-500">Sign out of session</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
