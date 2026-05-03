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

  return (
    <header className="sticky top-0 z-40 bg-white/30 dark:bg-black/30 backdrop-blur-md border-b border-white/20 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div
            className={userRole === "admin" ? "cursor-default pointer-events-none" : "cursor-pointer"}
            onClick={userRole === "admin" ? undefined : () => router.push(getHomeRoute())}
          >
            <img src="/Logo2.png" alt="Photo Finder" className="h-14 w-auto" />
          </div>
          <Navigation userRole={userRole} />
        </div>

        {userName && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative flex items-center gap-2 h-auto py-2 px-3 rounded-full bg-white/40 hover:bg-white/60 border border-white/60 hover:border-white/80 shadow-sm hover:shadow-md transition-all duration-300 group backdrop-blur-sm">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Avatar className="w-10 h-10 ring-2 ring-primary/30 flex-shrink-0 relative z-10 shadow-md">
                  <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white font-semibold">{userName ? userName[0].toUpperCase() : "U"}</AvatarFallback>
                </Avatar>
                <ChevronDown className="w-4 h-4 text-slate-600 hidden sm:block transition-transform duration-300 group-hover:text-slate-900 relative z-10" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 rounded-2xl border border-white/40 bg-white/95 backdrop-blur-2xl shadow-xl shadow-black/15 p-2.5 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-300">
              {/* Header Card */}
              <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-4 mb-2.5 relative overflow-hidden group/card">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="w-14 h-14 ring-2 ring-primary/30 shadow-md">
                      <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />
                      <AvatarFallback className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white text-base font-bold">{userName ? userName[0].toUpperCase() : "U"}</AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="flex flex-col space-y-1.5 min-w-0 flex-1 py-0.5">
                    <div className="text-sm font-bold text-slate-900 leading-tight">{userName}</div>
                    <div className="text-xs text-slate-600 truncate max-w-xs">{userEmail}</div>
                    <div className="text-[11px] font-medium text-primary/70 mt-0.5">
                      {userRole === "admin" ? "👨‍💼 Administrator" : userRole === "photographer" ? "📷 Photographer" : "👤 Student"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-1.5" />

              {/* Menu Items */}
              <div className="space-y-1 py-0.5">
                <DropdownMenuItem
                  onClick={() =>
                    router.push(
                      userRole === "admin"
                        ? "/admin/profile"
                        : userRole === "photographer"
                          ? "/photographer/profile"
                          : "/settings",
                    )
                  }
                  className="rounded-lg px-3.5 py-2.5 hover:bg-primary/15 focus:bg-primary/15 active:bg-primary/25 transition-all duration-150 cursor-pointer group/item flex items-center gap-2.5"
                >
                  <div className="w-8.5 h-8.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover/item:from-primary/30 group-hover/item:to-primary/20 transition-colors duration-150">
                    <Settings className="w-4 h-4 text-primary font-semibold" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900">Account & Settings</span>
                    <span className="text-[11px] text-slate-500">Manage your profile</span>
                  </div>
                </DropdownMenuItem>



                <DropdownMenuItem
                  onClick={() => router.push("/privacy")}
                  className="rounded-lg px-3.5 py-2.5 hover:bg-primary/15 focus:bg-primary/15 active:bg-primary/25 transition-all duration-150 cursor-pointer group/item flex items-center gap-2.5"
                >
                  <div className="w-8.5 h-8.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center group-hover/item:from-primary/30 group-hover/item:to-primary/20 transition-colors duration-150">
                    <Shield className="w-4 h-4 text-primary font-semibold" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900">Privacy & Policy</span>
                    <span className="text-[11px] text-slate-500">Review our policies</span>
                  </div>
                </DropdownMenuItem>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-1.5" />

              {/* Sign Out */}
              <DropdownMenuItem
                onClick={handleLogout}
                className="rounded-lg px-3.5 py-2.5 hover:bg-red-50/80 focus:bg-red-50/80 active:bg-red-100/80 transition-all duration-150 cursor-pointer group/item flex items-center gap-2.5 mx-0"
              >
                <div className="w-8.5 h-8.5 rounded-lg bg-gradient-to-br from-red-200/40 to-red-100/30 flex items-center justify-center group-hover/item:from-red-200/60 group-hover/item:to-red-100/50 transition-colors duration-150">
                  <LogOut className="w-4 h-4 text-red-600 font-semibold" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-red-700">Sign Out</span>
                  <span className="text-[11px] text-red-600/70">End your session</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
