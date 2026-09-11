"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Upload, Users, BarChart3, Heart } from "lucide-react"

interface NavigationProps {
  userRole?: "student" | "photographer" | "admin"
}

export function Navigation({ userRole = "student" }: NavigationProps) {
  const pathname = usePathname()

  const getNavItems = () => {
    const baseItems = [
      { href: "/dashboard", label: "My Photos", icon: Users },
      { href: "/favorites", label: "Favorites", icon: Heart },
    ]

    if (userRole === "photographer") {
      return []
    }

    if (userRole === "admin") {
      return [
        { href: "/admin/dashboard", label: "Dashboard", icon: BarChart3 },
        { href: "/admin/events/create", label: "Create Event", icon: Upload },
      ]
    }

    return baseItems
  }

  const navItems = getNavItems()

  return (
    <nav className="flex items-center gap-1.5">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors",
              isActive
                ? "bg-[#82181a] text-white shadow-2xs"
                : "text-slate-600 hover:text-[#82181a] hover:bg-slate-100",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
