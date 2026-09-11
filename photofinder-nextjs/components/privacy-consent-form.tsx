"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { ShieldCheck, UserSearch, FileText } from "lucide-react"

export interface ConsentData {
    globalFaceSearch: boolean
    dataProcessing: boolean
}

interface PrivacyConsentFormProps {
    consent: ConsentData
    onChange: (key: keyof ConsentData) => void
    disabled?: boolean
}

export function PrivacyConsentForm({ consent, onChange, disabled = false }: PrivacyConsentFormProps) {
    return (
        <div className="space-y-4">
            {/* Face Search Consent */}
            <div 
                className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                    consent.globalFaceSearch 
                    ? "border-primary/40 bg-primary/5 shadow-md shadow-primary/5" 
                    : "border-slate-200 bg-white hover:border-primary/30 hover:shadow-lg hover:shadow-slate-200/50"
                }`}
                onClick={() => !disabled && onChange("globalFaceSearch")}
            >
                <div className="flex items-start gap-4 p-5 sm:p-6">
                    <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                        consent.globalFaceSearch 
                        ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20" 
                        : "border-slate-300 bg-white group-hover:border-primary/50"
                    }`}>
                        <Checkbox
                            id="globalFaceSearch"
                            checked={consent.globalFaceSearch}
                            onCheckedChange={() => onChange("globalFaceSearch")}
                            disabled={disabled}
                            onClick={(event) => event.stopPropagation()}
                            className="h-full w-full border-0 bg-transparent ring-0 focus-visible:ring-0 data-[state=checked]:bg-transparent data-[state=checked]:text-primary-foreground"
                        />
                    </div>
                    <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <UserSearch className={`h-4 w-4 ${consent.globalFaceSearch ? "text-primary" : "text-slate-400 group-hover:text-primary/70"}`} />
                            <label
                                htmlFor="globalFaceSearch"
                                className="text-sm font-semibold tracking-tight text-slate-900 cursor-pointer block"
                            >
                                Enable AI Face Search
                            </label>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-500">
                            Allow the system to identify your face in event photos and create a personal photo album. You can
                            change this per-event or withdraw consent anytime.
                        </p>
                    </div>
                </div>
            </div>

            {/* Data Processing Consent */}
            <div 
                className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                    consent.dataProcessing 
                    ? "border-primary/40 bg-primary/5 shadow-md shadow-primary/5" 
                    : "border-slate-200 bg-white hover:border-primary/30 hover:shadow-lg hover:shadow-slate-200/50"
                }`}
                onClick={() => !disabled && onChange("dataProcessing")}
            >
                <div className="flex items-start gap-4 p-5 sm:p-6">
                    <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                        consent.dataProcessing 
                        ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20" 
                        : "border-slate-300 bg-white group-hover:border-primary/50"
                    }`}>
                        <Checkbox
                            id="dataProcessing"
                            checked={consent.dataProcessing}
                            onCheckedChange={() => onChange("dataProcessing")}
                            disabled={disabled}
                            onClick={(event) => event.stopPropagation()}
                            className="h-full w-full border-0 bg-transparent ring-0 focus-visible:ring-0 data-[state=checked]:bg-transparent data-[state=checked]:text-primary-foreground"
                        />
                    </div>
                    <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <FileText className={`h-4 w-4 ${consent.dataProcessing ? "text-primary" : "text-slate-400 group-hover:text-primary/70"}`} />
                            <label
                                htmlFor="dataProcessing"
                                className="text-sm font-semibold tracking-tight text-slate-900 cursor-pointer block"
                            >
                                Data Processing Agreement
                            </label>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-500">
                            I understand my biometric data will be processed and stored securely in compliance with GDPR and
                            PDPA regulations. Data is retained only for the duration of the event.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
