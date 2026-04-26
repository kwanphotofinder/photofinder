"use client";

import { usePathname } from 'next/navigation';
import { ChatBot } from './chat-bot';

export function ChatWrapper() {
  const pathname = usePathname();

  // Define which paths should display the chatbot
  // We only show it on student-facing pages to save tokens and keep the UI clean
  const isStudentPage = 
    pathname.startsWith('/dashboard') || 
    pathname.startsWith('/events') || 
    pathname.startsWith('/profile') ||
    pathname.startsWith('/privacy'); // Included privacy as it's a student concern

  if (!isStudentPage) {
    return null;
  }

  return <ChatBot />;
}
