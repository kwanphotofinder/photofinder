"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

export type Language = "th" | "en"

interface LanguageContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string) => string
}

const translations: Record<Language, Record<string, string>> = {
  th: {
    // Header & Global
    "portal.title": "ADMIN PORTAL",
    "portal.subtitle": "ระบบบริหารจัดการกลาง",
    "portal.system_online": "สถานะระบบ: พร้อมใช้งาน (Online)",
    "nav.home": "หน้าหลัก",
    "nav.admin": "ระบบผู้ดูแลระบบ (Admin)",
    "nav.dashboard": "แดชบอร์ดภาพรวม (Dashboard)",
    "nav.settings": "ตั้งค่าระบบ",
    "nav.profile": "ข้อมูลบัญชีผู้ดูแล (Profile)",
    "nav.privacy": "นโยบายความเป็นส่วนตัว (Privacy Policy)",
    "nav.signout": "ออกจากระบบ (Sign Out)",
    "role.admin": "เจ้าหน้าที่ดูแลระบบ (Admin)",
    "role.photographer": "ช่างภาพ (Photographer)",
    "role.student": "นักศึกษา (Student)",
    "role.super_admin": "ผู้ดูแลระบบระดับสูง (Super Admin)",

    // Breadcrumbs
    "breadcrumb.home": "หน้าหลัก",
    "breadcrumb.admin": "ระบบผู้ดูแลระบบ (Admin)",
    "breadcrumb.dashboard": "แดชบอร์ดภาพรวม (Dashboard)",
    "breadcrumb.create_event": "สร้างกิจกรรมใหม่ (Create Event)",
    "breadcrumb.edit_event": "แก้ไขกิจกรรม (Edit Event)",
    "breadcrumb.profile": "ข้อมูลบัญชีผู้ดูแล (Profile)",
    "breadcrumb.settings": "ตั้งค่าระบบ (Settings)",
    "breadcrumb.back": "กลับหน้าหลัก",

    // Dashboard Banner & Metrics
    "dash.welcome": "ระบบบริหารจัดการข้อมูลกลาง | ยินดีต้อนรับ,",
    "dash.btn.create_event": "สร้างกิจกรรมใหม่",
    "dash.btn.settings": "ตั้งค่าระบบ",
    "dash.metric.active_events": "กิจกรรมที่เปิดใช้งาน (Active)",
    "dash.metric.total_events": "กิจกรรมทั้งหมด (Total Events)",
    "dash.metric.pending_requests": "คำร้องขอลบภาพ (Pending Requests)",
    "dash.metric.total_users": "ผู้ใช้งานในระบบ (Total Users)",
    "dash.metric.out_of": "จากทั้งหมด",
    "dash.metric.events_unit": "กิจกรรม",
    "dash.metric.in_db": "สะสมในฐานข้อมูล",
    "dash.metric.awaiting_review": "รอการตรวจสอบและดำเนินการ",
    "dash.metric.all_roles": "รวมทุกสิทธิ์การใช้งาน",

    // Dashboard Menu
    "menu.title": "เมนูหลัก (Main Menu)",
    "menu.events": "จัดการกิจกรรม (Events)",
    "menu.photos": "คลังภาพถ่าย (Photos)",
    "menu.low_confidence": "คิวตรวจสอบ AI (Review)",
    "menu.requests": "คำร้องขอลบภาพ (Requests)",
    "menu.users": "จัดการผู้ใช้งาน (Users)",
    "menu.health": "สถานะระบบ (Health & Logs)",

    // Events Tab
    "events.title": "รายการกิจกรรมทั้งหมด (Events List)",
    "events.desc": "จัดการกิจกรรม ค้นหา และตรวจสอบสถานะการเผยแพร่",
    "events.search_placeholder": "ค้นหาชื่อกิจกรรม...",
    "events.create_btn": "สร้าง",
    "events.loading": "กำลังโหลดข้อมูลกิจกรรม...",
    "events.not_found": "ไม่พบข้อมูลกิจกรรม",
    "events.not_found_desc": "ลองเปลี่ยนคำค้นหา หรือสร้างกิจกรรมใหม่",
    "events.col.name": "ชื่อกิจกรรม (Event Name)",
    "events.col.date": "วันที่จัดกิจกรรม",
    "events.col.created": "วันที่สร้าง",
    "events.col.status": "สถานะ",
    "events.col.actions": "การจัดการ",
    "events.status.published": "เผยแพร่แล้ว",
    "events.status.draft": "ฉบับร่าง",
    "events.status.archived": "จัดเก็บแล้ว",
    "events.btn.edit": "แก้ไข",
    "events.btn.delete": "ลบ",

    // Photos Tab
    "photos.title": "คลังภาพถ่ายทั้งหมด (Photos Catalog)",
    "photos.desc": "ภาพถ่ายที่อัปโหลดเข้าสู่ระบบทั้งหมด",
    "photos.search_placeholder": "ค้นหาตามชื่อกิจกรรม หรือชื่อไฟล์...",
    "photos.loading": "กำลังโหลดข้อมูลภาพถ่าย...",
    "photos.not_found": "ไม่พบภาพถ่ายในระบบ",
    "photos.not_found_desc": "ภาพถ่ายที่อัปโหลดจะปรากฏที่นี่",
    "photos.items_count": "รูป",

    // Low Confidence Queue Tab
    "lc.title": "คิวตรวจสอบภาพถ่าย AI (Low-Confidence Queue)",
    "lc.desc": "ตรวจสอบภาพถ่ายที่ค่าความแม่นยำใบหน้าต่ำกว่าเกณฑ์มาตรฐาน",
    "lc.search_placeholder": "ค้นหาชื่อกิจกรรม...",
    "lc.threshold": "เกณฑ์ (Threshold):",
    "lc.refresh": "รีเฟรช",
    "lc.refreshing": "กำลังโหลด...",
    "lc.loading": "กำลังโหลดคิวตรวจสอบ...",
    "lc.clear": "ไม่มีภาพถ่ายในคิวตรวจสอบ",
    "lc.clear_desc": "ภาพถ่ายทั้งหมดผ่านเกณฑ์ความเชื่อมั่นที่กำหนด",
    "lc.min_confidence": "ค่าความเชื่อมั่นต่ำสุด:",
    "lc.lc_faces": "ใบหน้าต่ำกว่าเกณฑ์:",
    "lc.total_faces": "ใบหน้าทั้งหมด:",
    "lc.btn.review": "ตรวจสอบภาพ",
    "lc.modal.title": "ตรวจสอบภาพถ่ายค่าความเชื่อมั่นต่ำ",
    "lc.modal.preview_btn": "เปิดรูปเต็ม (Preview)",
    "lc.modal.approve_btn": "อนุมัติภาพ (Approve)",
    "lc.modal.approving": "กำลังอนุมัติ...",
    "lc.modal.delete_btn": "ลบภาพ (Delete)",
    "lc.modal.goto_event": "ไปที่แก้ไขกิจกรรม",

    // Removal Requests Tab
    "req.title": "คำร้องขอลบหรือเบลอภาพถ่าย (Removal Requests)",
    "req.desc": "ตรวจสอบคำร้องขอจากผู้ใช้งานเพื่อสิทธิความเป็นส่วนตัว",
    "req.loading": "กำลังโหลดคำร้อง...",
    "req.clear": "ไม่มีคำร้องขอลบภาพค้างอยู่",
    "req.clear_desc": "เมื่อมีผู้ใช้ส่งคำร้องขอ ระบบจะแสดงรายการในส่วนนี้",
    "req.requested_by": "ส่งคำร้องโดย",
    "req.on_date": "เมื่อ",
    "req.at_time": "เวลา",
    "req.reason_label": "เหตุผลที่ขอจัดการ:",
    "req.btn.approve_delete": "อนุมัติและลบภาพ",
    "req.btn.approve_blur": "อนุมัติและเบลอใบหน้า",
    "req.btn.reject": "ปฏิเสธคำร้อง",
    "req.processing": "กำลังดำเนินการ...",

    // User Management Tab
    "users.title": "รายชื่อผู้ใช้งานทั้งหมด (User Management)",
    "users.desc": "รวมทุกบัญชีผู้ใช้งานในระบบ",
    "users.add_photographer.title": "เพิ่มช่างภาพ (Add Photographer)",
    "users.add_photographer.desc": "กรอกอีเมล Google หรือ MFU ของช่างภาพ เมื่อเข้าสู่ระบบระบบจะนำทางไปยังหน้าจัดการของช่างภาพโดยอัตโนมัติ",
    "users.add_photographer.placeholder": "photographer@gmail.com หรือ photographer@mfu.ac.th",
    "users.add_photographer.btn": "แต่งตั้งช่างภาพ",
    "users.add_admin.title": "แต่งตั้งผู้ดูแลระบบ (Add Admin)",
    "users.add_admin.desc": "เฉพาะผู้ดูแลระบบระดับสูง (Super Admin) เท่านั้นที่สามารถแต่งตั้งหรือถอดถอนผู้ดูแลระบบคนอื่นได้",
    "users.add_admin.placeholder": "admin@gmail.com",
    "users.add_admin.btn": "แต่งตั้ง Admin",
    "users.search_placeholder": "ค้นหาชื่อ หรืออีเมล...",
    "users.col.details": "ข้อมูลผู้ใช้งาน (User Details)",
    "users.col.status": "สถานะ (Status)",
    "users.col.role": "สิทธิ์ (Role)",
    "users.col.actions": "การจัดการ (Actions)",
    "users.status.active": "ปกติ (Active)",
    "users.status.blocked": "ระงับสิทธิ์ (Blocked)",
    "users.btn.block": "ระงับ",
    "users.btn.unblock": "เปิดสิทธิ์",
    "users.btn.demote": "ลดสิทธิ์",
    "users.btn.delete": "ลบ",
    "users.not_found": "ไม่พบรายชื่อผู้ใช้งาน",
    "users.not_found_desc": "กรุณาลองปรับเปลี่ยนคำค้นหา",

    // System Health & Danger Zone
    "health.danger.title": "พื้นที่อันตราย (Danger Zone)",
    "health.danger.desc": "การดำเนินการในส่วนนี้จะมีผลลบหรือเปลี่ยนแปลงข้อมูลขนาดใหญ่โดยถาวร",
    "health.danger.wipe_title": "ล้างรูปภาพโปรไฟล์ยืนยันตัวตนเก่าทั้งหมด (Wipe All Old Selfies)",
    "health.danger.wipe_desc": "บังคับให้นักศึกษาทุกคนต้องทำการยืนยันตัวตนใหม่ด้วยระบบ Identity Guard",
    "health.danger.wipe_btn": "ล้างและรีเซ็ตข้อมูลรูปโปรไฟล์",

    // Event Create & Edit
    "event_form.create_title": "สร้างกิจกรรมใหม่ (Create New Event)",
    "event_form.create_subtitle": "กำหนดข้อมูลกิจกรรมสำหรับเปิดให้ช่างภาพอัปโหลดภาพถ่ายและเปิดระบบค้นหาใบหน้านักศึกษา",
    "event_form.edit_title": "แก้ไขข้อมูลกิจกรรม (Edit Event)",
    "event_form.edit_subtitle": "ปรับปรุงชื่อกิจกรรม วันที่จัด หรือสถานะการเผยแพร่ของกิจกรรม",
    "event_form.card_title": "ข้อมูลรายละเอียดกิจกรรม (Event Details)",
    "event_form.card_desc": "กรุณากรอกข้อมูลให้ครบถ้วนเพื่อดำเนินการในระบบ",
    "event_form.name_label": "ชื่อกิจกรรม (Event Name)",
    "event_form.name_placeholder": "เช่น พิธีพระราชทานปริญญาบัตร ประจำปีการศึกษา 2568",
    "event_form.name_help": "ระบุชื่อกิจกรรมภาษาไทยหรือภาษาอังกฤษให้ชัดเจน",
    "event_form.date_label": "วันที่จัดกิจกรรม (Event Date)",
    "event_form.date_help": "วันที่จัดกิจกรรมตามปฏิทินของมหาวิทยาลัย",
    "event_form.status_label": "สถานะการเผยแพร่ (Event Status)",
    "event_form.status_draft": "ฉบับร่าง (Draft) - ซ่อนจากผู้ใช้",
    "event_form.status_published": "เผยแพร่แล้ว (Published) - แสดงให้ผู้ใช้เห็น",
    "event_form.status_archived": "จัดเก็บแล้ว (Archived) - ปิดการใช้งาน",
    "event_form.timer_label": "ระยะเวลาเก็บรักษาภาพถ่าย (Auto-Deletion Timer)",
    "event_form.timer_desc": "ตามนโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA) ภาพถ่ายและข้อมูลใบหน้าจะถูกลบอัตโนมัติหลังครบกำหนดเวลา",
    "event_form.days_unit": "วัน",
    "event_form.custom_days": "กำหนดเอง (วัน):",
    "event_form.max_days": "(สูงสุดไม่เกิน 30 วัน)",
    "event_form.btn_cancel": "ยกเลิก (Cancel)",
    "event_form.btn_create": "บันทึกและสร้างกิจกรรม",
    "event_form.btn_save": "บันทึกการเปลี่ยนแปลง",
    "event_form.btn_saving": "กำลังบันทึกข้อมูล...",
    "event_form.back": "กลับหน้าหลัก",

    // Profile & Settings
    "profile.title": "ข้อมูลบัญชีผู้ดูแลระบบ (Admin Account & Profile)",
    "profile.subtitle": "รายละเอียดบัญชีและสิทธิ์การเข้าถึงระบบบริหารจัดการส่วนกลาง",
    "profile.details_title": "ข้อมูลส่วนบุคคล (Personal Details)",
    "profile.details_desc": "ข้อมูลเชื่อมโยงจากบัญชีเข้าสู่ระบบปัจจุบัน",
    "profile.scope_title": "ขอบเขตสิทธิ์การใช้งาน (Permission Scope)",
    "profile.btn_dashboard": "ไปยังแดชบอร์ดหลัก",
    "profile.email_not_found": "ไม่พบข้อมูลอีเมล",
    "profile.scope_desc_super": "คุณมีสิทธิ์ระดับสูงสุด สามารถจัดการผู้ดูแลระบบ (Admin), ช่างภาพ (Photographer), จัดการกิจกรรม, อนุมัติลบภาพ และตรวจสอบสถานะระบบทั้งหมดได้",
    "profile.scope_desc_admin": "คุณมีสิทธิ์ระดับผู้ดูแลระบบ สามารถจัดการกิจกรรม, อนุมัติลบหรือเบลอภาพถ่าย, และตรวจสอบคิว Low Confidence ได้",
    "settings.title": "การตั้งค่าระบบ (Admin Settings)",
    "settings.subtitle": "ตรวจสอบสิทธิ์การเข้าถึง และการกำหนดค่าระบบบริหารจัดการส่วนกลาง",
    "settings.session_title": "สถานะการเข้าถึงระบบของผู้ดูแล (Admin Session)",
    "settings.session_desc": "ข้อมูลเซสชันและสถานะการยืนยันตัวตนปัจจุบัน",
    "settings.signed_in_as": "เข้าสู่ระบบในนาม (Signed In As)",
    "settings.session_active": "เซสชันของผู้ดูแลระบบเปิดใช้งานและปลอดภัย",
    "settings.user_roles_title": "จัดการสิทธิ์ผู้ใช้งาน (User Roles)",
    "settings.user_roles_desc": "แต่งตั้งช่างภาพ ปรับระดับสิทธิ์ หรือระงับการเข้าถึงของผู้ใช้",
    "settings.moderation_title": "คำร้องขอลบภาพ (Moderation)",
    "settings.moderation_desc": "ตรวจสอบคำร้องขอลบหรือเบลอภาพถ่ายจากนักศึกษา",
  },
  en: {
    // Header & Global
    "portal.title": "ADMIN PORTAL",
    "portal.subtitle": "Central Management System",
    "portal.system_online": "System Status: Online",
    "nav.home": "Home",
    "nav.admin": "Administrator Portal",
    "nav.dashboard": "Overview Dashboard",
    "nav.settings": "Settings",
    "nav.profile": "Account Profile",
    "nav.privacy": "Privacy Policy",
    "nav.signout": "Sign Out",
    "role.admin": "Administrator (Admin)",
    "role.photographer": "Photographer",
    "role.student": "Student",
    "role.super_admin": "Super Administrator",

    // Breadcrumbs
    "breadcrumb.home": "Home",
    "breadcrumb.admin": "Administrator (Admin)",
    "breadcrumb.dashboard": "Overview Dashboard",
    "breadcrumb.create_event": "Create New Event",
    "breadcrumb.edit_event": "Edit Event",
    "breadcrumb.profile": "Account Profile",
    "breadcrumb.settings": "System Settings",
    "breadcrumb.back": "Back to Dashboard",

    // Dashboard Banner & Metrics
    "dash.welcome": "Central Management System | Welcome,",
    "dash.btn.create_event": "Create Event",
    "dash.btn.settings": "System Settings",
    "dash.metric.active_events": "Active Events",
    "dash.metric.total_events": "Total Events",
    "dash.metric.pending_requests": "Pending Requests",
    "dash.metric.total_users": "Registered Users",
    "dash.metric.out_of": "out of",
    "dash.metric.events_unit": "events",
    "dash.metric.in_db": "recorded in database",
    "dash.metric.awaiting_review": "awaiting moderation",
    "dash.metric.all_roles": "all roles combined",

    // Dashboard Menu
    "menu.title": "Main Menu",
    "menu.events": "Event Management",
    "menu.photos": "Photos Catalog",
    "menu.low_confidence": "AI Review Queue",
    "menu.requests": "Removal Requests",
    "menu.users": "User Management",
    "menu.health": "System Health & Logs",

    // Events Tab
    "events.title": "Events List",
    "events.desc": "Manage campus events, filter by keywords, and update publication status",
    "events.search_placeholder": "Search event by name...",
    "events.create_btn": "Create",
    "events.loading": "Loading campus events...",
    "events.not_found": "No events found",
    "events.not_found_desc": "Try a different search keyword or create a new event",
    "events.col.name": "Event Name",
    "events.col.date": "Event Date",
    "events.col.created": "Created At",
    "events.col.status": "Status",
    "events.col.actions": "Actions",
    "events.status.published": "Published",
    "events.status.draft": "Draft",
    "events.status.archived": "Archived",
    "events.btn.edit": "Edit",
    "events.btn.delete": "Delete",

    // Photos Tab
    "photos.title": "All Uploaded Photos",
    "photos.desc": "All event photos uploaded and indexed in the system",
    "photos.search_placeholder": "Search by event or filename...",
    "photos.loading": "Loading photos...",
    "photos.not_found": "No photos found",
    "photos.not_found_desc": "Uploaded photos will be displayed here for moderation",
    "photos.items_count": "photos",

    // Low Confidence Queue Tab
    "lc.title": "Low-Confidence AI Queue",
    "lc.desc": "Review photos where facial detection confidence falls below threshold",
    "lc.search_placeholder": "Search event...",
    "lc.threshold": "Threshold:",
    "lc.refresh": "Refresh",
    "lc.refreshing": "Refreshing...",
    "lc.loading": "Loading review queue...",
    "lc.clear": "Queue is clear",
    "lc.clear_desc": "All photos meet the required facial confidence criteria",
    "lc.min_confidence": "Min Confidence:",
    "lc.lc_faces": "Low-confidence faces:",
    "lc.total_faces": "Total faces:",
    "lc.btn.review": "Review Photo",
    "lc.modal.title": "Low-Confidence Photo Review",
    "lc.modal.preview_btn": "Preview Full Size",
    "lc.modal.approve_btn": "Approve Photo",
    "lc.modal.approving": "Approving...",
    "lc.modal.delete_btn": "Delete Photo",
    "lc.modal.goto_event": "Go to Event Edit",

    // Removal Requests Tab
    "req.title": "Photo Removal & Blur Requests",
    "req.desc": "Review and action privacy removal requests submitted by campus users",
    "req.loading": "Loading removal requests...",
    "req.clear": "No pending removal requests",
    "req.clear_desc": "When users request photo removal or blur, items appear here",
    "req.requested_by": "Requested by",
    "req.on_date": "on",
    "req.at_time": "at",
    "req.reason_label": "Reason Provided:",
    "req.btn.approve_delete": "Approve & Delete",
    "req.btn.approve_blur": "Approve & Blur",
    "req.btn.reject": "Reject Request",
    "req.processing": "Processing...",

    // User Management Tab
    "users.title": "All Registered Users",
    "users.desc": "Complete directory of users and account permissions",
    "users.add_photographer.title": "Add Photographer",
    "users.add_photographer.desc": "Enter a Google or MFU email. The user will be routed to photographer upload portal on login.",
    "users.add_photographer.placeholder": "photographer@gmail.com or photographer@mfu.ac.th",
    "users.add_photographer.btn": "Assign Photographer",
    "users.add_admin.title": "Add Administrator",
    "users.add_admin.desc": "Only Super Administrators can assign or remove administrator privileges.",
    "users.add_admin.placeholder": "admin@gmail.com",
    "users.add_admin.btn": "Assign Admin",
    "users.search_placeholder": "Search by name or email...",
    "users.col.details": "User Details",
    "users.col.status": "Status",
    "users.col.role": "Role",
    "users.col.actions": "Actions",
    "users.status.active": "Active",
    "users.status.blocked": "Blocked",
    "users.btn.block": "Block",
    "users.btn.unblock": "Unblock",
    "users.btn.demote": "Demote",
    "users.btn.delete": "Delete",
    "users.not_found": "No users found",
    "users.not_found_desc": "Try adjusting your search criteria",

    // System Health & Danger Zone
    "health.danger.title": "Danger Zone",
    "health.danger.desc": "Irreversible administrative actions affecting large volumes of data",
    "health.danger.wipe_title": "Wipe All Old Identity Selfies",
    "health.danger.wipe_desc": "Force all students to re-verify their face identity using Identity Guard",
    "health.danger.wipe_btn": "Wipe & Reset Selfies",

    // Event Create & Edit
    "event_form.create_title": "Create New Event",
    "event_form.create_subtitle": "Configure a new campus event for photo uploads and AI student face search",
    "event_form.edit_title": "Edit Event Details",
    "event_form.edit_subtitle": "Update event title, occurrence date, and public access status",
    "event_form.card_title": "Event Information",
    "event_form.card_desc": "Fill in all necessary fields to proceed with event registration",
    "event_form.name_label": "Event Name",
    "event_form.name_placeholder": "e.g. Mae Fah Luang Commencement Ceremony 2026",
    "event_form.name_help": "Specify a clear and descriptive name in Thai or English",
    "event_form.date_label": "Event Date",
    "event_form.date_help": "Scheduled date according to university academic calendar",
    "event_form.status_label": "Publication Status",
    "event_form.status_draft": "Draft - Hidden from students",
    "event_form.status_published": "Published - Visible to students",
    "event_form.status_archived": "Archived - Disabled",
    "event_form.timer_label": "Data Retention Timer (PDPA)",
    "event_form.timer_desc": "For privacy compliance, photos and facial embeddings are permanently purged after this duration",
    "event_form.days_unit": "Days",
    "event_form.custom_days": "Custom (Days):",
    "event_form.max_days": "(Maximum 30 days)",
    "event_form.btn_cancel": "Cancel",
    "event_form.btn_create": "Save & Create Event",
    "event_form.btn_save": "Save Changes",
    "event_form.btn_saving": "Saving changes...",
    "event_form.back": "Back to Dashboard",

    // Profile & Settings
    "profile.title": "Admin Account & Profile",
    "profile.subtitle": "Account credentials and access privilege scope for the central portal",
    "profile.details_title": "Personal Details",
    "profile.details_desc": "Information linked to your current authenticated session",
    "profile.scope_title": "Permission Scope",
    "profile.btn_dashboard": "Return to Dashboard",
    "profile.email_not_found": "No email address found",
    "profile.scope_desc_super": "You hold Super Administrator privileges: configure administrators, manage photographers, oversee campus events, moderate photo deletions, and monitor system health.",
    "profile.scope_desc_admin": "You hold Administrator privileges: manage events, approve removal/blur requests, and inspect AI confidence queues.",
    "settings.title": "Admin System Settings",
    "settings.subtitle": "Verify access privileges and central administrative configurations",
    "settings.session_title": "Admin Session Status",
    "settings.session_desc": "Current authentication session details and security state",
    "settings.signed_in_as": "Signed In As",
    "settings.session_active": "Admin session is authenticated and secure",
    "settings.user_roles_title": "Manage User Roles",
    "settings.user_roles_desc": "Assign photographers, update permissions, or manage user access",
    "settings.moderation_title": "Photo Removal Requests",
    "settings.moderation_desc": "Review and act on photo deletion or face blur requests",
  },
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "th",
  setLang: () => {},
  t: (key: string) => key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("th")

  useEffect(() => {
    const saved = localStorage.getItem("app_lang") as Language | null
    if (saved === "th" || saved === "en") {
      setLangState(saved)
    }
  }, [])

  const setLang = (newLang: Language) => {
    setLangState(newLang)
    localStorage.setItem("app_lang", newLang)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("languagechange"))
    }
  }

  useEffect(() => {
    const handleLangChange = () => {
      const current = localStorage.getItem("app_lang") as Language | null
      if (current && (current === "th" || current === "en") && current !== lang) {
        setLangState(current)
      }
    }
    window.addEventListener("languagechange", handleLangChange)
    return () => window.removeEventListener("languagechange", handleLangChange)
  }, [lang])

  const t = (key: string): string => {
    return translations[lang]?.[key] || translations["th"]?.[key] || key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
