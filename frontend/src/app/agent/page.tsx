'use client';

import React from 'react';
import Link from 'next/link';
import { SaaSLayout } from '@/components/SaaSLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Bot } from 'lucide-react';

export default function AgentPage() {
  return (
    <SaaSLayout>
      <div className="max-w-xl mx-auto pt-16">
        <EmptyState
          icon={<Bot className="w-8 h-8" />}
          title="Agents are not available in this release"
          description="Use the Chat Assistant to ask grounded questions about the documents in your knowledge bases."
          action={
            <Link href="/dashboard">
              <Button>Back to dashboard</Button>
            </Link>
          }
        />
      </div>
    </SaaSLayout>
  );
}
