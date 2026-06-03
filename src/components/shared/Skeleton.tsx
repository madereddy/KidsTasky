import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-ui-soft-3",
        variant === 'circular' ? "rounded-full" : "rounded-lg",
        className
      )}
    />
  );
}

export function WallSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 bg-white/80 rounded-2xl p-4 border border-ui h-32 flex flex-col items-center justify-center">
          <Skeleton className="h-10 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="md:col-span-2 bg-white/80 rounded-2xl p-4 border border-ui h-32">
          <Skeleton className="h-4 w-20 mb-4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
      <div className="bg-white/80 rounded-2xl p-4 border border-ui">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-3 border border-ui rounded-xl bg-ui-soft h-20">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-2 w-full mb-1" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KidDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-[2rem] p-6 border border-ui-soft h-32 flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex gap-4 items-center">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="w-12 h-12 rounded-full" />
          </div>
        </div>
        <div className="bg-white rounded-[2rem] p-6 border border-ui-soft h-32">
          <Skeleton className="h-4 w-20 mb-4" />
          <Skeleton className="h-6 w-full rounded-full" />
        </div>
      </div>
      <div className="h-16 bg-white rounded-[2rem] border border-ui-soft flex items-center px-4 gap-4">
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-40 bg-white rounded-[2rem] border border-ui-soft p-6">
            <Skeleton className="h-6 w-3/4 mb-4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
