"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, AlertTriangle, Info, Loader2 } from "lucide-react"

export interface ConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmText?: string
  cancelText?: string
  confirmIcon?: React.ReactNode
  variant?: "destructive" | "default" | "warning"
  isLoading?: boolean
  requireMatchText?: string
  matchPlaceholder?: string
  onConfirm: () => Promise<void> | void
}

export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmIcon,
  variant = "destructive",
  isLoading = false,
  requireMatchText,
  matchPlaceholder,
  onConfirm,
}: ConfirmationModalProps) {
  const [matchInput, setMatchInput] = useState("")

  const canConfirm = !requireMatchText || matchInput.trim() === requireMatchText

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!canConfirm || isLoading) return
    await onConfirm()
    setMatchInput("")
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (isLoading) return
    if (!newOpen) setMatchInput("")
    onOpenChange(newOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="w-[92vw] sm:max-w-md max-h-[88vh] overflow-y-auto rounded-xl p-5 sm:p-6 border-border bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground text-left">
            {variant === "destructive" ? (
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            ) : variant === "warning" ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            ) : (
              <Info className="h-5 w-5 text-primary shrink-0" />
            )}
            <span className="truncate">{title}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground text-left">
            {typeof description === "string" ? <p>{description}</p> : description}

            {requireMatchText && (
              <div className="space-y-1.5 pt-2">
                <p className="text-xs font-semibold text-foreground">
                  Type <span className="font-mono text-destructive font-bold">{requireMatchText}</span> to confirm:
                </p>
                <Input
                  value={matchInput}
                  onChange={(e) => setMatchInput(e.target.value)}
                  placeholder={matchPlaceholder || `Type ${requireMatchText}`}
                  className="h-9 sm:h-9 text-xs"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 mt-4 pt-1">
          <AlertDialogCancel
            disabled={isLoading}
            onClick={() => handleOpenChange(false)}
            className="w-full sm:w-auto h-10 sm:h-9 text-xs font-medium"
          >
            {cancelText}
          </AlertDialogCancel>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={!canConfirm || isLoading}
            onClick={handleConfirm}
            className="w-full sm:w-auto h-10 sm:h-9 text-xs font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {confirmIcon}
                {confirmText}
              </>
            )}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
