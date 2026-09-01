import './globals.css';
import React from 'react';

export const metadata = {
  title: 'RAGOS — Enterprise Multi-Tenant RAG SaaS Platform',
  description: 'Production Multi-Tenant RAG Chatbot & AI Agent SaaS Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-slate-100 antialiased min-h-screen selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
