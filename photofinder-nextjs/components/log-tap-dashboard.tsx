"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Activity,
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Download,
  Filter,
  Flame,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  Terminal,
  Trash2,
  ExternalLink,
  ChevronRight,
  Eye,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { apiClient } from "@/lib/api-client"
import { useLanguage } from "@/lib/language-context"

interface LogTapItem {
  id: string
  traceId: string
  method: string
  path: string
  statusCode: number
  durationMs: number
  ipAddress?: string | null
  userAgent?: string | null
  userId?: string | null
  userEmail?: string | null
  inputPayload?: string | null
  outputSummary?: string | null
  isError: boolean
  errorMessage?: string | null
  createdAt: string
}

interface ErrorIncident {
  id: string
  fingerprint: string
  errorName: string
  message: string
  stack?: string | null
  severity: "CRITICAL" | "ERROR" | "WARNING"
  route: string
  method: string
  statusCode: number
  traceId?: string | null
  requestBody?: string | null
  queryParams?: string | null
  userEmail?: string | null
  ipAddress?: string | null
  status: "UNRESOLVED" | "INVESTIGATING" | "RESOLVED" | "IGNORED"
  occurrences: number
  firstSeenAt: string
  lastSeenAt: string
  resolvedAt?: string | null
  resolvedBy?: string | null
  reproduceCurl?: string
}

interface LogStats {
  period: string
  totalTaps24h: number
  statusCodeBreakdown: {
    success2xx: number
    clientError4xx: number
    serverError5xx: number
  }
  errorRatePercent: number
  avgDurationMs: number
  unresolvedErrorsCount: number
  criticalErrorsCount: number
  topFailingRoutes: Array<{ path: string; count: number }>
}

export function LogTapDashboard({ callerRole }: { callerRole: string }) {
  const { t } = useLanguage()
  const [subTab, setSubTab] = useState<"tap" | "errors" | "analytics">("tap")

  // Log TAP state
  const [tapLogs, setTapLogs] = useState<LogTapItem[]>([])
  const [tapLoading, setTapLoading] = useState(false)
  const [tapTotal, setTapTotal] = useState(0)
  const [tapPage, setTapPage] = useState(1)
  const [tapTotalPages, setTapTotalPages] = useState(1)
  const [tapSearch, setTapSearch] = useState("")
  const [tapMethod, setTapMethod] = useState("ALL")
  const [tapStatus, setTapStatus] = useState("ALL")
  const [tapOnlyErrors, setTapOnlyErrors] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [selectedTap, setSelectedTap] = useState<LogTapItem | null>(null)
  const [isExportingCsv, setIsExportingCsv] = useState(false)

  // Error Tracking state
  const [errorIncidents, setErrorIncidents] = useState<ErrorIncident[]>([])
  const [errorLoading, setErrorLoading] = useState(false)
  const [errorTotal, setErrorTotal] = useState(0)
  const [errorPage, setErrorPage] = useState(1)
  const [errorTotalPages, setErrorTotalPages] = useState(1)
  const [errorSearch, setErrorSearch] = useState("")
  const [errorStatusFilter, setErrorStatusFilter] = useState("ALL")
  const [errorSeverityFilter, setErrorSeverityFilter] = useState("ALL")
  const [selectedError, setSelectedError] = useState<ErrorIncident | null>(null)
  const [updatingErrorId, setUpdatingErrorId] = useState<string | null>(null)

  // Stats
  const [stats, setStats] = useState<LogStats | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Fetch Log TAP
  const fetchTapLogs = useCallback(async () => {
    setTapLoading(true)
    try {
      const res = await apiClient.getLogTapEntries({
        search: tapSearch,
        method: tapMethod !== "ALL" ? tapMethod : undefined,
        status: tapStatus !== "ALL" ? tapStatus : undefined,
        onlyErrors: tapOnlyErrors,
        page: tapPage,
        limit: 30,
      })
      if (res.data) {
        setTapLogs(res.data.items || [])
        setTapTotal(res.data.total || 0)
        setTapTotalPages(res.data.totalPages || 1)
      }
    } catch (err) {
      console.error("Failed to fetch TAP logs:", err)
    } finally {
      setTapLoading(false)
    }
  }, [tapSearch, tapMethod, tapStatus, tapOnlyErrors, tapPage])

  // Fetch Errors
  const fetchErrorIncidents = useCallback(async () => {
    setErrorLoading(true)
    try {
      const res = await apiClient.getErrorTrackLogs({
        status: errorStatusFilter !== "ALL" ? errorStatusFilter : undefined,
        severity: errorSeverityFilter !== "ALL" ? errorSeverityFilter : undefined,
        search: errorSearch,
        page: errorPage,
        limit: 20,
      })
      if (res.data) {
        setErrorIncidents(res.data.items || [])
        setErrorTotal(res.data.total || 0)
        setErrorTotalPages(res.data.totalPages || 1)
      }
    } catch (err) {
      console.error("Failed to fetch error incidents:", err)
    } finally {
      setErrorLoading(false)
    }
  }, [errorStatusFilter, errorSeverityFilter, errorSearch, errorPage])

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.getLogStats()
      if (res.data) {
        setStats(res.data)
      }
    } catch (err) {
      console.error("Failed to fetch log stats:", err)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (subTab === "tap") {
      fetchTapLogs()
    } else if (subTab === "errors") {
      fetchErrorIncidents()
    }
  }, [subTab, fetchTapLogs, fetchErrorIncidents])

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      if (subTab === "tap") fetchTapLogs()
      if (subTab === "errors") fetchErrorIncidents()
      fetchStats()
    }, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, subTab, fetchTapLogs, fetchErrorIncidents, fetchStats])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleUpdateStatus = async (
    id: string,
    status: "UNRESOLVED" | "INVESTIGATING" | "RESOLVED" | "IGNORED"
  ) => {
    setUpdatingErrorId(id)
    try {
      await apiClient.updateErrorStatus(id, status)
      await fetchErrorIncidents()
      await fetchStats()
      if (selectedError?.id === id) {
        setSelectedError((prev) => (prev ? { ...prev, status } : null))
      }
    } catch (err) {
      console.error("Failed to update error status:", err)
    } finally {
      setUpdatingErrorId(null)
    }
  }

  const handlePruneLogs = async () => {
    if (!confirm("Are you sure you want to prune logs older than 14 days?")) return
    try {
      const res = await apiClient.pruneLogTap(14)
      alert(`Pruned ${res.data?.deletedCount ?? 0} old log entries.`)
      fetchTapLogs()
      fetchStats()
    } catch (err) {
      console.error("Failed to prune logs:", err)
      alert("Failed to prune logs")
    }
  }

  const handleExportCsv = () => {
    setIsExportingCsv(true)
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
    const url = `/api/admin/logs/tap?format=csv`
    window.open(url, "_blank")
    setTimeout(() => setIsExportingCsv(false), 2000)
  }

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "POST":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "PUT":
      case "PATCH":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "DELETE":
        return "bg-rose-50 text-rose-700 border-rose-200"
      default:
        return "bg-slate-50 text-slate-700 border-slate-200"
    }
  }

  const getStatusBadgeClass = (code: number) => {
    if (code >= 200 && code < 300) {
      return "bg-emerald-100 text-emerald-800"
    }
    if (code >= 300 && code < 400) {
      return "bg-sky-100 text-sky-800"
    }
    if (code >= 400 && code < 500) {
      return "bg-amber-100 text-amber-800"
    }
    return "bg-rose-100 text-rose-800 font-bold"
  }

  const getLatencyClass = (ms: number) => {
    if (ms < 150) return "text-emerald-600"
    if (ms < 600) return "text-amber-600"
    return "text-rose-600 font-bold"
  }

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-red-600 text-white font-bold"
      case "ERROR":
        return "bg-rose-100 text-rose-700 border-rose-300"
      case "WARNING":
        return "bg-amber-100 text-amber-700 border-amber-300"
      default:
        return "bg-slate-100 text-slate-700"
    }
  }

  const getStatusPillClass = (status: string) => {
    switch (status) {
      case "UNRESOLVED":
        return "bg-rose-50 text-rose-700 border-rose-200"
      case "INVESTIGATING":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "RESOLVED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "IGNORED":
        return "bg-slate-50 text-slate-600 border-slate-200"
      default:
        return "bg-slate-100 text-slate-700"
    }
  }

  return (
    <div className="space-y-4">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Traffic TAP (24h)
              </p>
              <h3 className="text-xl font-bold text-slate-800 mt-0.5">
                {stats?.totalTaps24h?.toLocaleString() ?? 0}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Live request calls</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Error Rate (24h)
              </p>
              <h3 className={`text-xl font-bold mt-0.5 ${(stats?.errorRatePercent ?? 0) > 3 ? "text-rose-600" : "text-slate-800"}`}>
                {stats?.errorRatePercent ?? 0}%
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {(stats?.statusCodeBreakdown.clientError4xx ?? 0) + (stats?.statusCodeBreakdown.serverError5xx ?? 0)} failed
              </p>
            </div>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${(stats?.errorRatePercent ?? 0) > 3 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Avg Latency (ms)
              </p>
              <h3 className="text-xl font-bold text-slate-800 mt-0.5">
                {stats?.avgDurationMs ?? 0} <span className="text-xs font-normal text-slate-500">ms</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Recent 500 calls</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Open Incidents
              </p>
              <h3 className={`text-xl font-bold mt-0.5 ${(stats?.unresolvedErrorsCount ?? 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {stats?.unresolvedErrorsCount ?? 0}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {stats?.criticalErrorsCount ?? 0} critical
              </p>
            </div>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${(stats?.unresolvedErrorsCount ?? 0) > 0 ? "bg-rose-50 text-rose-600 animate-pulse" : "bg-slate-100 text-slate-500"}`}>
              <Bug className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tab Controller */}
      <Card className="border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-md">
              <button
                onClick={() => setSubTab("tap")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                  subTab === "tap"
                    ? "bg-white text-[#82181a] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Live Log TAP</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
                  {tapTotal}
                </span>
              </button>

              <button
                onClick={() => setSubTab("errors")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                  subTab === "errors"
                    ? "bg-white text-[#82181a] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Bug className="h-3.5 w-3.5" />
                <span>Error Tracking & Reproduction</span>
                {(stats?.unresolvedErrorsCount ?? 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-bold">
                    {stats?.unresolvedErrorsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setSubTab("analytics")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                  subTab === "analytics"
                    ? "bg-white text-[#82181a] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Traffic Analytics</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`h-8 text-xs border-slate-300 ${
                  autoRefresh ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-white"
                }`}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${autoRefresh ? "animate-spin" : ""}`} />
                {autoRefresh ? "Auto: ON (10s)" : "Auto: OFF"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (subTab === "tap") fetchTapLogs()
                  else if (subTab === "errors") fetchErrorIncidents()
                  fetchStats()
                }}
                className="h-8 text-xs border-slate-300 bg-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>

              {subTab === "tap" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCsv}
                    disabled={isExportingCsv}
                    className="h-8 text-xs border-slate-300 bg-white"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    CSV
                  </Button>

                  {callerRole === "SUPER_ADMIN" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePruneLogs}
                      className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Prune {">"}14d
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* ============================================================== */}
          {/* SUBTAB 1: LIVE LOG TAP */}
          {/* ============================================================== */}
          {subTab === "tap" && (
            <div>
              {/* Filter bar */}
              <div className="p-3 border-b border-slate-200 bg-slate-50/40 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search by route, trace ID, user email, or payload..."
                    value={tapSearch}
                    onChange={(e) => {
                      setTapSearch(e.target.value)
                      setTapPage(1)
                    }}
                    className="h-8 pl-8 text-xs border-slate-300 bg-white"
                  />
                </div>

                <Select
                  value={tapMethod}
                  onValueChange={(val) => {
                    setTapMethod(val)
                    setTapPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-28 text-xs border-slate-300 bg-white">
                    <SelectValue placeholder="Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Methods</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={tapStatus}
                  onValueChange={(val) => {
                    setTapStatus(val)
                    setTapPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-28 text-xs border-slate-300 bg-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="2xx">2xx (OK)</SelectItem>
                    <SelectItem value="4xx">4xx (Client)</SelectItem>
                    <SelectItem value="5xx">5xx (Server)</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTapOnlyErrors(!tapOnlyErrors)
                    setTapPage(1)
                  }}
                  className={`h-8 text-xs border-slate-300 ${
                    tapOnlyErrors ? "bg-rose-50 text-rose-700 border-rose-300 font-semibold" : "bg-white"
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                  Only Errors
                </Button>
              </div>

              {/* TAP Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-slate-200">
                      <TableHead className="text-[11px] font-bold text-slate-700 uppercase h-9 w-20">Method</TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700 uppercase h-9 w-20">Status</TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700 uppercase h-9">Path / Route</TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700 uppercase h-9 w-24">Latency</TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700 uppercase h-9">Caller / IP</TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700 uppercase h-9 w-36">Time</TableHead>
                      <TableHead className="text-[11px] font-bold text-slate-700 uppercase h-9 w-16 text-right">Inspect</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tapLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-xs text-slate-500">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
                          Streaming live TAP logs...
                        </TableCell>
                      </TableRow>
                    ) : tapLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-xs text-slate-500">
                          No TAP logs recorded matching your filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tapLogs.map((log) => (
                        <TableRow
                          key={log.id}
                          onClick={() => setSelectedTap(log)}
                          className="cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
                        >
                          <TableCell className="py-2">
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${getMethodBadgeClass(log.method)}`}>
                              {log.method}
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className={`inline-block px-2 py-0.5 text-[11px] font-mono rounded ${getStatusBadgeClass(log.statusCode)}`}>
                              {log.statusCode}
                            </span>
                          </TableCell>
                          <TableCell className="py-2 font-mono text-xs text-slate-800 truncate max-w-xs sm:max-w-md">
                            {log.path}
                            {log.isError && log.errorMessage && (
                              <span className="block text-[11px] text-rose-600 truncate font-sans">
                                {log.errorMessage}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2">
                            <span className={`text-xs font-mono ${getLatencyClass(log.durationMs)}`}>
                              {log.durationMs}ms
                            </span>
                          </TableCell>
                          <TableCell className="py-2 text-xs text-slate-600 truncate max-w-[150px]">
                            {log.userEmail || log.ipAddress || "anonymous"}
                          </TableCell>
                          <TableCell className="py-2 text-[11px] text-slate-400 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Eye className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {tapTotalPages > 1 && (
                <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>Page {tapPage} of {tapTotalPages} ({tapTotal} total)</span>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={tapPage <= 1}
                      onClick={() => setTapPage((p) => Math.max(1, p - 1))}
                      className="h-7 text-xs border-slate-300"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={tapPage >= tapTotalPages}
                      onClick={() => setTapPage((p) => p + 1)}
                      className="h-7 text-xs border-slate-300"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* SUBTAB 2: ERROR TRACKING & REPRODUCTION */}
          {/* ============================================================== */}
          {subTab === "errors" && (
            <div>
              {/* Filter bar */}
              <div className="p-3 border-b border-slate-200 bg-slate-50/40 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search errors by name, message, route..."
                    value={errorSearch}
                    onChange={(e) => {
                      setErrorSearch(e.target.value)
                      setErrorPage(1)
                    }}
                    className="h-8 pl-8 text-xs border-slate-300 bg-white"
                  />
                </div>

                <Select
                  value={errorStatusFilter}
                  onValueChange={(val) => {
                    setErrorStatusFilter(val)
                    setErrorPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-32 text-xs border-slate-300 bg-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="UNRESOLVED">Unresolved</SelectItem>
                    <SelectItem value="INVESTIGATING">Investigating</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="IGNORED">Ignored</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={errorSeverityFilter}
                  onValueChange={(val) => {
                    setErrorSeverityFilter(val)
                    setErrorPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-32 text-xs border-slate-300 bg-white">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Severities</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                    <SelectItem value="WARNING">Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Errors List */}
              <div className="p-3 space-y-3">
                {errorLoading ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading error incidents...
                  </div>
                ) : errorIncidents.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                    <p className="text-sm font-semibold text-slate-700">No Error Incidents Found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      All systems are operating cleanly without unresolved exceptions.
                    </p>
                  </div>
                ) : (
                  errorIncidents.map((incident) => (
                    <Card
                      key={incident.id}
                      className="border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-all overflow-hidden"
                    >
                      <div className="p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${getSeverityBadgeClass(incident.severity)}`}>
                              {incident.severity}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${getStatusPillClass(incident.status)}`}>
                              {incident.status}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {incident.method} {incident.route}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              {incident.occurrences} {incident.occurrences > 1 ? "events" : "event"}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {incident.errorName}: {incident.message}
                          </h4>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                            <span>
                              First seen: {new Date(incident.firstSeenAt).toLocaleString()}
                            </span>
                            <span>
                              Last seen: {new Date(incident.lastSeenAt).toLocaleString()}
                            </span>
                            {incident.userEmail && <span>User: {incident.userEmail}</span>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          {incident.reproduceCurl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(incident.reproduceCurl!, `curl-${incident.id}`)}
                              className="h-7 text-xs border-slate-300 bg-slate-50 hover:bg-slate-100"
                              title="Copy ready-to-run cURL to reproduce this error"
                            >
                              <Terminal className="h-3 w-3 mr-1 text-[#82181a]" />
                              {copiedKey === `curl-${incident.id}` ? "Copied!" : "Copy cURL"}
                            </Button>
                          )}

                          <Button
                            size="sm"
                            onClick={() => setSelectedError(incident)}
                            className="h-7 text-xs bg-[#82181a] hover:bg-[#9c1f22] text-white"
                          >
                            Inspect & Stack
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {/* Pagination */}
              {errorTotalPages > 1 && (
                <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>Page {errorPage} of {errorTotalPages} ({errorTotal} total)</span>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={errorPage <= 1}
                      onClick={() => setErrorPage((p) => Math.max(1, p - 1))}
                      className="h-7 text-xs border-slate-300"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={errorPage >= errorTotalPages}
                      onClick={() => setErrorPage((p) => p + 1)}
                      className="h-7 text-xs border-slate-300"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* SUBTAB 3: TRAFFIC ANALYTICS */}
          {/* ============================================================== */}
          {subTab === "analytics" && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Status code breakdown */}
                <Card className="border-slate-200 shadow-2xs">
                  <CardHeader className="p-3.5 border-b border-slate-100">
                    <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      HTTP Status Code Distribution (24h)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-emerald-700">2xx Success</span>
                        <span>{stats?.statusCodeBreakdown.success2xx ?? 0}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{
                            width: `${stats?.totalTaps24h ? ((stats.statusCodeBreakdown.success2xx / stats.totalTaps24h) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-amber-700">4xx Client Errors</span>
                        <span>{stats?.statusCodeBreakdown.clientError4xx ?? 0}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500"
                          style={{
                            width: `${stats?.totalTaps24h ? ((stats.statusCodeBreakdown.clientError4xx / stats.totalTaps24h) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-rose-700">5xx Server Errors</span>
                        <span>{stats?.statusCodeBreakdown.serverError5xx ?? 0}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500"
                          style={{
                            width: `${stats?.totalTaps24h ? ((stats.statusCodeBreakdown.serverError5xx / stats.totalTaps24h) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top failing routes */}
                <Card className="border-slate-200 shadow-2xs">
                  <CardHeader className="p-3.5 border-b border-slate-100">
                    <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Top Failing Endpoints (24h)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {stats?.topFailingRoutes && stats.topFailingRoutes.length > 0 ? (
                      <div className="space-y-2.5">
                        {stats.topFailingRoutes.map((r, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="font-mono text-slate-800 truncate max-w-[240px]">{r.path}</span>
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[11px]">
                              {r.count} errors
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-xs text-slate-400">
                        No failing routes recorded in the last 24 hours!
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================== */}
      {/* MODAL 1: REQUEST & RESPONSE I/O INSPECTOR */}
      {/* ============================================================== */}
      <Dialog open={!!selectedTap} onOpenChange={(open) => !open && setSelectedTap(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <span className={`px-2 py-0.5 text-xs font-bold rounded border ${selectedTap ? getMethodBadgeClass(selectedTap.method) : ""}`}>
                {selectedTap?.method}
              </span>
              <span className="font-mono text-sm">{selectedTap?.path}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Trace ID: <code className="font-mono text-slate-700">{selectedTap?.traceId}</code> • {selectedTap && new Date(selectedTap.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {selectedTap && (
            <div className="space-y-3.5 text-xs">
              {/* Metadata pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-md border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Status</span>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono mt-0.5 ${getStatusBadgeClass(selectedTap.statusCode)}`}>
                    {selectedTap.statusCode}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Latency</span>
                  <span className={`font-mono text-xs font-bold ${getLatencyClass(selectedTap.durationMs)}`}>
                    {selectedTap.durationMs}ms
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Client IP</span>
                  <span className="font-mono text-slate-700">{selectedTap.ipAddress || "N/A"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">User</span>
                  <span className="text-slate-700 truncate block">{selectedTap.userEmail || "Anonymous"}</span>
                </div>
              </div>

              {/* Input Payload */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Input Payload (Sanitized)
                  </span>
                  {selectedTap.inputPayload && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(selectedTap.inputPayload!, "input-payload")}
                      className="h-6 text-[10px] px-1.5 text-slate-500"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {copiedKey === "input-payload" ? "Copied!" : "Copy"}
                    </Button>
                  )}
                </div>
                <div className="bg-slate-900 text-slate-100 p-2.5 rounded font-mono text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {selectedTap.inputPayload || "// No request payload"}
                </div>
              </div>

              {/* Output Summary */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Response Summary / Error
                  </span>
                  {selectedTap.outputSummary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(selectedTap.outputSummary!, "output-summary")}
                      className="h-6 text-[10px] px-1.5 text-slate-500"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {copiedKey === "output-summary" ? "Copied!" : "Copy"}
                    </Button>
                  )}
                </div>
                <div className="bg-slate-900 text-slate-100 p-2.5 rounded font-mono text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {selectedTap.errorMessage ? (
                    <span className="text-rose-400">{selectedTap.errorMessage}</span>
                  ) : (
                    selectedTap.outputSummary || "// No output payload captured"
                  )}
                </div>
              </div>

              {/* User Agent */}
              {selectedTap.userAgent && (
                <div className="text-[11px] text-slate-400 truncate">
                  User Agent: {selectedTap.userAgent}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTap(null)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL 2: ERROR INCIDENT & REPRODUCTION MODAL */}
      {/* ============================================================== */}
      <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-xs font-bold rounded ${selectedError ? getSeverityBadgeClass(selectedError.severity) : ""}`}>
                {selectedError?.severity}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {selectedError?.occurrences} occurrences
              </span>
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              {selectedError?.errorName}: {selectedError?.message}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-mono">
              Fingerprint: {selectedError?.fingerprint}
            </DialogDescription>
          </DialogHeader>

          {selectedError && (
            <div className="space-y-4 text-xs">
              {/* Status Manager */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Status:</span>
                  <Select
                    value={selectedError.status}
                    onValueChange={(val: any) => handleUpdateStatus(selectedError.id, val)}
                    disabled={updatingErrorId === selectedError.id}
                  >
                    <SelectTrigger className="h-7 w-36 text-xs bg-white border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNRESOLVED">Unresolved</SelectItem>
                      <SelectItem value="INVESTIGATING">Investigating</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="IGNORED">Ignored</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedError.resolvedBy && (
                  <span className="text-[11px] text-emerald-700">
                    Resolved by {selectedError.resolvedBy} on {new Date(selectedError.resolvedAt!).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Issue Reproduction: Ready-to-run cURL command */}
              {selectedError.reproduceCurl && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-[#82181a]" />
                      Issue Reproduction (cURL Command)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(selectedError.reproduceCurl!, "modal-curl")}
                      className="h-6 text-[10px] px-2 text-[#82181a] border-[#82181a]/30 hover:bg-[#82181a]/10"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {copiedKey === "modal-curl" ? "Copied!" : "Copy cURL"}
                    </Button>
                  </div>
                  <div className="bg-slate-900 text-emerald-400 p-2.5 rounded font-mono text-[11px] overflow-x-auto whitespace-pre">
                    {selectedError.reproduceCurl}
                  </div>
                </div>
              )}

              {/* Request Payload at failure */}
              {selectedError.requestBody && selectedError.requestBody !== "null" && (
                <div>
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block mb-1">
                    Request Payload at Failure
                  </span>
                  <div className="bg-slate-900 text-slate-100 p-2.5 rounded font-mono text-[11px] overflow-x-auto max-h-36 whitespace-pre-wrap">
                    {selectedError.requestBody}
                  </div>
                </div>
              )}

              {/* Stack Trace */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Stack Trace
                  </span>
                  {selectedError.stack && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(selectedError.stack!, "modal-stack")}
                      className="h-6 text-[10px] px-1.5 text-slate-500"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {copiedKey === "modal-stack" ? "Copied!" : "Copy Stack"}
                    </Button>
                  )}
                </div>
                <div className="bg-slate-950 text-rose-300 p-2.5 rounded font-mono text-[11px] overflow-x-auto max-h-56 whitespace-pre-wrap border border-slate-800">
                  {selectedError.stack || "// No stack trace available"}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedError(null)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
