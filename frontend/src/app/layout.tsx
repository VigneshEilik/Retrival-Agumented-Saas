import './globals.css';
import React from 'react';

export const metadata = {
  title: 'RAG Chatbot SaaS Platform',
  description: 'Production Multi-Tenant RAG Chatbot & AI Agent SaaS Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
