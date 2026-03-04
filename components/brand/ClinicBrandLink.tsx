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
  const linkClassName = ["chat-fixed-topbar__brand", className].filter(Boolean).join(" ");

  return (
    <Link href={href} className={linkClassName} aria-label="返回醫天圓">
      <Image
        src="/logo-eden.png"
        alt=""
        width={28}
        height={28}
        className="chat-fixed-topbar__brand-logo"
      />
      <span className="chat-fixed-topbar__brand-copy">
        <span className="chat-fixed-topbar__brand-title">醫天圓</span>
        {subtitle ? <span className="chat-fixed-topbar__brand-subtitle">{subtitle}</span> : null}
      </span>
    </Link>
  );
}
