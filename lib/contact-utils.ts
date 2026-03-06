export function normalizePhoneForSearch(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export function normalizePhoneForStorage(value: string | null | undefined): string {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const hasPlusPrefix = trimmed.startsWith("+");
  const digitsOnly = normalizePhoneForSearch(trimmed);
  if (!digitsOnly) return trimmed;

  return hasPlusPrefix ? `+${digitsOnly}` : digitsOnly;
}

const COMPOUND_CHINESE_SURNAMES = [
  "歐陽",
  "司徒",
  "司馬",
  "諸葛",
  "上官",
  "夏侯",
  "司空",
  "尉遲",
  "皇甫",
  "令狐",
  "慕容",
  "公孫",
  "長孫",
  "南宮",
  "東方",
] as const;

const CJK_CHARACTER_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

function normalizeDisplayName(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

export function splitDisplayNameForBookingForm(value: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const normalized = normalizeDisplayName(value);
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  if (normalized.includes(",")) {
    const [lastName = "", ...firstNameParts] = normalized
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      firstName: firstNameParts.join(" ").trim(),
      lastName,
    };
  }

  if (CJK_CHARACTER_PATTERN.test(normalized)) {
    const compactName = normalized.replace(/\s+/g, "");
    if (compactName.length <= 1) {
      return { firstName: compactName, lastName: "" };
    }

    const compoundSurname = COMPOUND_CHINESE_SURNAMES.find((surname) =>
      compactName.startsWith(surname),
    );

    if (compoundSurname) {
      return {
        firstName: compactName.slice(compoundSurname.length),
        lastName: compoundSurname,
      };
    }

    return {
      firstName: compactName.slice(1),
      lastName: compactName.slice(0, 1),
    };
  }

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "",
    };
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0],
      lastName: parts[1],
    };
  }

  return {
    firstName: parts.slice(1).join(" "),
    lastName: parts[0],
  };
}

export function buildBookingContactPrefill(input: {
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
}): {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
} {
  const { firstName, lastName } = splitDisplayNameForBookingForm(input.displayName);

  return {
    firstName,
    lastName,
    email: input.email?.trim().toLowerCase() ?? "",
    phone: input.phone?.trim() ?? "",
  };
}
