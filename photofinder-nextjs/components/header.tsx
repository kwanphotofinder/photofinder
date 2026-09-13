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
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-t-4 border-t-primary border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div
            className={userRole === "admin" ? "cursor-default flex items-center gap-3" : "cursor-pointer flex items-center gap-3"}
            onClick={userRole === "admin" ? undefined : () => router.push(getHomeRoute())}
          >
            <img src="/Logo2.png" alt="Photo Finder" className="h-11 w-auto" />
            {userRole === "admin" && (
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-primary bg-primary/10 px-2.5 py-1 rounded-md ring-1 ring-inset ring-primary/15">
                  {t("portal.title")}
                </span>
                <span className="text-xs text-muted-foreground font-medium">{t("portal.subtitle")}</span>
              </div>
            )}
            {userRole === "photographer" && (
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-primary bg-primary/10 px-2.5 py-1 rounded-md ring-1 ring-inset ring-primary/15">
                  {t("portal.photographer_title")}
                </span>
                <span className="text-xs text-muted-foreground font-medium">{t("portal.photographer_subtitle")}</span>
              </div>
            )}
          </div>
          <Navigation userRole={userRole} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border border-border rounded-lg overflow-hidden text-xs font-semibold shadow-sm bg-card">
            <button
              type="button"
              onClick={() => setLang("th")}
              className={`px-3 py-1.5 text-xs transition-colors ${lang === "th" ? "bg-primary text-white shadow-inner" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              title="ภาษาไทย"
            >
              TH
            </button>
            <div className="w-px h-4 bg-border" />
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`px-3 py-1.5 text-xs transition-colors ${lang === "en" ? "bg-primary text-white shadow-inner" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}
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
                  className="group relative flex items-center gap-2.5 h-auto py-1.5 px-2 rounded-lg bg-card hover:bg-muted/80 border border-border shadow-sm transition-all cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/30 data-[state=open]:bg-muted/80"
                >
                  <Avatar className="w-8 h-8 rounded-md border border-border flex-shrink-0">
                    <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs rounded-md">{userName ? userName[0].toUpperCase() : "U"}</AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-foreground leading-tight truncate max-w-[120px]">{userName}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                      {userRole === "admin" ? t("role.admin") : userRole === "photographer" ? t("role.photographer") : t("role.student")}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl border border-border bg-popover shadow-lg p-2 animate-in fade-in-0 zoom-in-98 duration-150">
                <div className="rounded-lg bg-muted/60 border border-border p-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="w-10 h-10 rounded-lg border border-border">
                      <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm rounded-lg">{userName ? userName[0].toUpperCase() : "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="text-xs font-bold text-foreground truncate">{userName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{userEmail}</div>
                      <div className="text-[10px] font-semibold text-primary mt-0.5">
                        {userRole === "admin" ? t("role.admin") : userRole === "photographer" ? t("role.photographer") : t("role.student")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border/60 my-1.5" />

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
                    className="rounded-lg px-2.5 py-2 hover:bg-muted focus:bg-muted cursor-pointer flex items-center gap-2.5 text-xs font-medium text-foreground transition-colors"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <span>{t("nav.settings")}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => router.push("/privacy")}
                    className="rounded-lg px-2.5 py-2 hover:bg-muted focus:bg-muted cursor-pointer flex items-center gap-2.5 text-xs font-medium text-foreground transition-colors"
                  >
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span>{t("nav.privacy")}</span>
                  </DropdownMenuItem>
                </div>

                <div className="h-px bg-border/60 my-1.5" />

                <DropdownMenuItem
                  onClick={handleLogout}
                  className="rounded-lg px-2.5 py-2 hover:bg-destructive/10 focus:bg-destructive/10 cursor-pointer flex items-center gap-2.5 text-xs font-medium text-destructive transition-colors"
                >
                  <LogOut className="w-4 h-4" />
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
