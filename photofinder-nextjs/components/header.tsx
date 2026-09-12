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

import { useLanguage } from "@/lib/language-context"

interface HeaderProps {
  showLogout?: boolean
  userRole?: "student" | "photographer" | "admin"
}

export function Header({ showLogout = false, userRole = "student" }: HeaderProps) {
  const router = useRouter()
  const { lang, setLang, t } = useLanguage()
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
    <header className="sticky top-0 z-40 bg-white border-t-4 border-t-[#82181a] border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div
            className={userRole === "admin" ? "cursor-default flex items-center gap-3" : "cursor-pointer flex items-center gap-3"}
            onClick={userRole === "admin" ? undefined : () => router.push(getHomeRoute())}
          >
            <img src="/Logo2.png" alt="Photo Finder" className="h-12 w-auto" />
            {userRole === "admin" && (
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200">
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#82181a] bg-[#82181a]/10 px-2 py-0.5 rounded">
                  {t("portal.title")}
                </span>
                <span className="text-xs text-slate-500 font-medium">{t("portal.subtitle")}</span>
              </div>
            )}
            {userRole === "photographer" && (
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200">
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#82181a] bg-[#82181a]/10 px-2 py-0.5 rounded">
                  {t("portal.photographer_title")}
                </span>
                <span className="text-xs text-slate-500 font-medium">{t("portal.photographer_subtitle")}</span>
              </div>
            )}
          </div>
          <Navigation userRole={userRole} />
        </div>

        <div className="flex items-center gap-3">
          {/* REG MFU Language Switcher (TH | EN) */}
          <div className="flex items-center border border-slate-200 rounded overflow-hidden text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => setLang("th")}
              className={`px-2.5 py-1 text-xs transition-colors ${lang === "th" ? "bg-[#82181a] text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
              title="ภาษาไทย"
            >
              TH
            </button>
            <div className="w-px h-3.5 bg-slate-200" />
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`px-2.5 py-1 text-xs transition-colors ${lang === "en" ? "bg-[#82181a] text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
              title="English"
            >
              EN
            </button>
          </div>

          {userName && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group relative flex items-center gap-2.5 h-auto py-1.5 px-2.5 rounded-md bg-white hover:bg-slate-100/90 border border-slate-200 shadow-2xs transition-colors cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-[#82181a]/20 data-[state=open]:bg-slate-100"
                >
                  <Avatar className="w-8 h-8 rounded border border-slate-200 flex-shrink-0">
                    <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />
                    <AvatarFallback className="bg-[#82181a] text-white font-semibold text-xs rounded">{userName ? userName[0].toUpperCase() : "U"}</AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-slate-900 leading-tight truncate max-w-[120px]">{userName}</span>
                    <span className="text-[10px] text-slate-500 group-hover:text-slate-600 truncate max-w-[120px]">
                      {userRole === "admin" ? t("role.admin") : userRole === "photographer" ? t("role.photographer") : t("role.student")}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-md border border-slate-200 bg-white shadow-lg p-2 animate-in fade-in-0 zoom-in-98 duration-150">
                {/* Header Card */}
                <div className="rounded bg-slate-50 border border-slate-200 p-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="w-10 h-10 rounded border border-slate-200">
                      <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />
                      <AvatarFallback className="bg-[#82181a] text-white font-bold text-sm rounded">{userName ? userName[0].toUpperCase() : "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{userName}</div>
                      <div className="text-[11px] text-slate-500 truncate">{userEmail}</div>
                      <div className="text-[10px] font-semibold text-[#82181a] mt-0.5">
                        {userRole === "admin" ? t("role.admin") : userRole === "photographer" ? t("role.photographer") : t("role.student")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100 my-1" />

                {/* Menu Items */}
                <div className="space-y-0.5">
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
                    className="rounded px-2.5 py-2 hover:bg-slate-100 focus:bg-slate-100 hover:text-slate-900 focus:text-slate-900 cursor-pointer flex items-center gap-2 text-xs font-medium text-slate-700 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-500 group-hover:text-slate-700" />
                    <span>{t("nav.settings")}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => router.push("/privacy")}
                    className="rounded px-2.5 py-2 hover:bg-slate-100 focus:bg-slate-100 hover:text-slate-900 focus:text-slate-900 cursor-pointer flex items-center gap-2 text-xs font-medium text-slate-700 transition-colors"
                  >
                    <Shield className="w-4 h-4 text-slate-500 group-hover:text-slate-700" />
                    <span>{t("nav.privacy")}</span>
                  </DropdownMenuItem>
                </div>

                <div className="h-px bg-slate-100 my-1" />

                {/* Sign Out */}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="rounded px-2.5 py-2 hover:bg-red-50 focus:bg-red-50 hover:text-red-700 focus:text-red-700 cursor-pointer flex items-center gap-2 text-xs font-medium text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
                  <span>{t("nav.signout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
