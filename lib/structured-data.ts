import { buildBookingUrl, buildPublicUrl, getPublicBaseUrl } from "@/lib/public-url";
import { CLINICS, DOCTORS, PHYSICAL_CLINIC_IDS } from "@/shared/clinic-data";

export const SITE_NAME = "醫天圓中醫診所";
export const SITE_NAME_EN = "Eden TCM Clinic";
export const SITE_DESCRIPTION =
  "醫天圓中醫診所提供中醫診症、針灸、痛症調理、體質諮詢、網上預約與診後跟進服務。";

export function publicUrl(path: string): string {
  return buildPublicUrl(path);
}

export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function absoluteMediaUrl(value: string | null | undefined, fallbackPath: string): string {
  if (!value) return buildPublicUrl(fallbackPath);
  return /^https?:\/\//i.test(value) ? value : buildPublicUrl(value);
}

function clinicPlaceNodes() {
  return PHYSICAL_CLINIC_IDS.map((clinicId) => {
    const clinic = CLINICS.find((item) => item.id === clinicId);
    if (!clinic) return null;

    return {
      "@type": "MedicalClinic",
      "@id": buildPublicUrl(`/#clinic-${clinic.id}`),
      name: `${SITE_NAME}${clinic.nameZh}診所`,
      alternateName: `${SITE_NAME_EN} ${clinic.nameEn}`,
      address: clinic.address,
      telephone: clinic.phones,
      url: getPublicBaseUrl(),
      openingHours: clinic.hoursText,
      hasMap: clinic.googleMapUrl || clinic.routeMapUrl,
    };
  }).filter(Boolean);
}

export function clinicStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["MedicalBusiness", "MedicalClinic"],
        "@id": buildPublicUrl("/#organization"),
        name: SITE_NAME,
        alternateName: SITE_NAME_EN,
        description: SITE_DESCRIPTION,
        url: getPublicBaseUrl(),
        logo: buildPublicUrl("/logo-eden.png"),
        image: buildPublicUrl("/images/edenclinic-homepage-bg.webp"),
        medicalSpecialty: ["TraditionalChineseMedicine", "Acupuncture"],
        department: clinicPlaceNodes(),
        potentialAction: {
          "@type": "ReserveAction",
          target: buildBookingUrl(),
          name: "預約醫天圓服務",
        },
      },
      {
        "@type": "WebSite",
        "@id": buildPublicUrl("/#website"),
        name: SITE_NAME,
        alternateName: SITE_NAME_EN,
        url: getPublicBaseUrl(),
        publisher: {
          "@id": buildPublicUrl("/#organization"),
        },
      },
    ],
  };
}

export function articleStructuredData(article: {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string;
  coverImageUrl: string | null;
  tags: string[];
}) {
  const url = buildPublicUrl(`/articles/${article.slug}`);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.title,
    description: article.excerpt || SITE_DESCRIPTION,
    image: absoluteMediaUrl(article.coverImageUrl, "/logo-eden.png"),
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    mainEntityOfPage: url,
    keywords: article.tags,
    author: {
      "@id": buildPublicUrl("/#organization"),
      name: SITE_NAME,
    },
    publisher: {
      "@id": buildPublicUrl("/#organization"),
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: buildPublicUrl("/logo-eden.png"),
      },
    },
  };
}

export function drWongStructuredData() {
  const url = buildPublicUrl("/dr-wong");
  const doctor = DOCTORS.find((item) => item.id === "wong");
  const jordanClinic = CLINICS.find((item) => item.id === "jordan");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Physician",
        "@id": `${url}#physician`,
        name: "黃浩哲脊醫",
        alternateName: "Dr. Samuel H.C. Wong",
        url,
        image: buildPublicUrl("/doctor-avatars/clean/wong.webp"),
        medicalSpecialty: "Chiropractic",
        worksFor: {
          "@id": buildPublicUrl("/#organization"),
          name: SITE_NAME,
        },
        workLocation: jordanClinic
          ? {
              "@type": "MedicalClinic",
              name: `${SITE_NAME}${jordanClinic.nameZh}診所`,
              address: jordanClinic.address,
              telephone: jordanClinic.phones,
            }
          : undefined,
        potentialAction: {
          "@type": "ReserveAction",
          target: doctor?.bookingUrl || buildBookingUrl({ doctorId: "wong", clinicId: "jordan" }),
          name: "預約黃浩哲脊醫",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "黃浩哲脊醫在哪間診所應診？",
            acceptedAnswer: {
              "@type": "Answer",
              text: "黃浩哲脊醫於醫天圓佐敦診所應診。",
            },
          },
          {
            "@type": "Question",
            name: "可以網上預約黃浩哲脊醫嗎？",
            acceptedAnswer: {
              "@type": "Answer",
              text: "可以透過醫天圓預約平台選擇黃浩哲脊醫的首診或覆診服務，預約成功後診所會以 WhatsApp 確認。",
            },
          },
        ],
      },
    ],
  };
}
