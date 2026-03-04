"use client";

import Image from "next/image";
import Link from "next/link";

type ClinicBrandLinkProps = {
  href?: string;
  className?: string;
  subtitle?: string;
};

export function ClinicBrandLink({
  href = "/chat",
  className = "",
  subtitle,
}: ClinicBrandLinkProps) {
  const linkClassName = [
    "chat-fixed-topbar__brand !w-auto !min-w-0 !min-h-0 !justify-start !gap-2.5 !rounded-none !border-0 !bg-transparent !px-0 !py-0 !shadow-none !text-[#2d5b39] no-underline",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link href={href} className={linkClassName} aria-label="返回醫天圓">
      <Image
        src="/logo-eden.png"
        alt=""
        width={26}
        height={26}
        className="chat-fixed-topbar__brand-logo !h-[26px] !w-[26px] !shrink-0"
      />
      <span className="chat-fixed-topbar__brand-copy !min-w-0 !flex-col !items-start !justify-center !leading-none">
        <span className="chat-fixed-topbar__brand-title !font-sans !text-[16px] !font-bold !tracking-[0.04em] !text-[#2d5b39]">
          醫天圓
        </span>
        {subtitle ? (
          <span className="chat-fixed-topbar__brand-subtitle !mt-[3px] !ml-0 !text-[9px] !font-semibold !tracking-[0.08em] !text-[rgba(45,91,57,0.75)] max-[440px]:!hidden">
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
