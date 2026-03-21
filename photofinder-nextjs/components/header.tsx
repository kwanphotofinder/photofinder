"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Camera, ChevronDown, User, Mail, LogOut, Settings } from "lucide-react"
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
      localStorage.removeItem("university_id")
      localStorage.removeItem("user_email")
      router.push("/")
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <Camera className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold text-foreground">Photo Finder</span>
          </div>
          <Navigation userRole={userRole} />
        </div>

        {userName && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-auto py-2 px-3 hover:bg-primary/10">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />
                  <AvatarFallback>{userName ? userName[0].toUpperCase() : "U"}</AvatarFallback>
                </Avatar>
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-foreground">{userName}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[150px]">{userEmail}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex items-start gap-3 py-3 px-2 cursor-default">
                <Avatar className="w-12 h-12 mt-0.5">
                  <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />
                  <AvatarFallback>{userName ? userName[0].toUpperCase() : "U"}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-1">
                  <div className="text-sm font-medium leading-none">{userName}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[180px]">{userEmail}</div>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/settings")}
                className="hover:bg-primary/10 focus:bg-primary/10 hover:text-foreground focus:text-foreground"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
