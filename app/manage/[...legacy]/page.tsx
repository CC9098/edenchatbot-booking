import { notFound, redirect } from 'next/navigation';

import { resolveLegacyManageBookingRedirect } from '@/lib/legacy-manage-link';

export default function LegacyManageRedirectPage({
  params,
  searchParams,
}: {
  params: { legacy?: string[] };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const target = resolveLegacyManageBookingRedirect({
    pathSegments: params.legacy,
    token: searchParams?.token,
  });

  if (!target) {
    notFound();
  }

  redirect(target);
}
