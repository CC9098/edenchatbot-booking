"use client";

import Image from "next/image";
import Link from "next/link";

type ClinicBrandLinkProps = {
  href?: string;
  className?: string;
  subtitle?: string;
  variant?: "default" | "native";
};

export function ClinicBrandLink({
  href = "/chat",
  className = "",
  subtitle,
  variant = "default",
}: ClinicBrandLinkProps) {
  const isNativeVariant = variant === "native";
  const resolvedSubtitle = subtitle ?? (isNativeVariant ? "調養・預約・諮詢" : undefined);

  const linkClassName = [
    isNativeVariant
      ? "chat-fixed-topbar__brand !w-auto !min-w-0 !min-h-[48px] !items-center !justify-start !gap-2.5 !rounded-[16px] !border !px-[14px] !py-0 !text-[#f7fbf5] no-underline"
      : "chat-fixed-topbar__brand !w-auto !min-w-0 !min-h-0 !justify-start !gap-2.5 !rounded-none !border-0 !bg-transparent !px-0 !py-0 !shadow-none !text-[#2d5b39] no-underline",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const linkStyle = isNativeVariant
    ? {
        borderColor: "rgba(53, 104, 66, 0.95)",
        background: "linear-gradient(180deg, #4b8158 0%, #3f784d 100%)",
        boxShadow: "0 8px 18px rgba(35, 56, 39, 0.16)",
      }
    : undefined;

  return (
    <Link href={href} className={linkClassName} style={linkStyle} aria-label="返回醫天圓">
      <Image
        src="/logo-eden.png"
        alt=""
        width={isNativeVariant ? 28 : 26}
        height={isNativeVariant ? 28 : 26}
        className={`chat-fixed-topbar__brand-logo !shrink-0 ${
          isNativeVariant
            ? "!h-7 !w-7 !brightness-0 !invert"
            : "!h-[26px] !w-[26px]"
        }`}
      />
      <span
        className={`chat-fixed-topbar__brand-copy !min-w-0 !flex-col !items-start !justify-center !leading-none ${
          isNativeVariant ? "!gap-0" : ""
        }`}
      >
        <span
          className={`chat-fixed-topbar__brand-title !font-sans !text-[16px] !font-bold !tracking-[0.04em] ${
            isNativeVariant ? "!text-white" : "!text-[#2d5b39]"
          }`}
        >
          醫天圓
        </span>
        {resolvedSubtitle ? (
          <span
            className={`chat-fixed-topbar__brand-subtitle !mt-[3px] !ml-0 !text-[9px] !font-semibold max-[440px]:!hidden ${
              isNativeVariant
                ? "!tracking-[0.12em] !text-[rgba(247,251,245,0.8)]"
                : "!tracking-[0.08em] !text-[rgba(45,91,57,0.75)]"
            }`}
          >
            {resolvedSubtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
