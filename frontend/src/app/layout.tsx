import './globals.css';
import React from 'react';

export const metadata = {
  title: 'RAGOS — Enterprise Multi-Tenant AI Platform',
  description: 'Production Multi-Tenant RAG Chatbot & AI Agent SaaS Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-blue-100 selection:text-blue-900 font-sans">
        {children}
      </body>
    </html>
  );
}
