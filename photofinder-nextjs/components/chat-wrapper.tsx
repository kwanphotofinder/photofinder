"use client";

import { usePathname } from 'next/navigation';
import { ChatBot } from './chat-bot';

export function ChatWrapper() {
  const pathname = usePathname();
  
  // Check the user role from localStorage (only in the browser)
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null;
  const isStudent = userRole === 'student';

  // Define which paths should display the chatbot
  const isStudentPath = 
    pathname.startsWith('/dashboard') || 
    pathname.startsWith('/events') || 
    pathname.startsWith('/profile') ||
    pathname.startsWith('/favorites') ||
    pathname.startsWith('/settings');

  // Logic: Show on student-only paths OR show on privacy page only for students
  const shouldShow = isStudentPath || (pathname.startsWith('/privacy') && isStudent);

  if (!shouldShow) {
    return null;
  }

  return <ChatBot />;
}
