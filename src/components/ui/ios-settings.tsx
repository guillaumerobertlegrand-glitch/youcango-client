import React from "react";
import { cn } from "@/lib/utils";

interface IOSSectionProps {
  title?: string;
  children: React.ReactNode;
  footer?: string;
  className?: string;
}

export function IOSSection({ title, children, footer, className }: IOSSectionProps) {
  return (
    <div className={cn("mb-0", className)}>
      {title && (
        <h3 className="text-[#000000] text-[22px] tracking-tight pl-[16px] mb-[10px] mt-[32px] font-bold ml-4">
          {title}
        </h3>
      )}
      <div className="bg-white rounded-[20px] overflow-hidden mx-[16px]">
        {children}
      </div>
      {footer && (
        <p className="px-[32px] pt-2 text-[13px] text-[#6b6b70] leading-relaxed mb-4">
          {footer}
        </p>
      )}
    </div>
  );
}

interface IOSRowProps {
  label: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  isLast?: boolean;
  separator?: boolean;
  onClick?: () => void;
  className?: string;
}

export function IOSRow({
  label,
  icon,
  children,
  isLast = false,
  separator = true,
  onClick,
  className
}: IOSRowProps) {
  return (
    <div
      className={cn(
        "relative flex items-center min-h-[44px] bg-white transition-colors pr-[16px]",
        onClick && "cursor-pointer active:bg-[#F2F2F7]",
        className
      )}
      onClick={onClick}
    >

      {/* Main Content Area - Left Padding 16px always */}
      <div className="flex-1 flex items-center justify-between py-[11px] min-h-[44px] pl-[16px]">
        <div className="flex items-center gap-3">
          {icon && <span className="text-[#8E8E93]">{icon}</span>}
          <span className="text-[17px] text-[#000000] tracking-tight font-normal whitespace-nowrap">{label}</span>
        </div>
        <div className="flex-1 ml-4 text-right flex items-center justify-end text-[17px]">
          {children}
        </div>
      </div>

      {/* Separator - Lighter Color #e5e5ea, inset 16px */}
      {!isLast && separator && (
        <div className={cn(
          "absolute bottom-0 right-0 h-[0.5px] bg-[#e5e5ea] left-[16px]"
        )} />
      )}
    </div>
  );
}
