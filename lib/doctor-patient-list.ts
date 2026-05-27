type NullableId = string | null | undefined;

type VisiblePatientIdOptions = {
  activeStaffUserIds: NullableId[];
  currentStaffUserId?: NullableId;
  includeOtherStaff?: boolean;
  profileIds?: NullableId[];
  patientProfileUserIds?: NullableId[];
  patientCareTeamIds?: NullableId[];
  patientCareProfileIds?: NullableId[];
  bookingUserIds?: NullableId[];
  symptomPatientIds?: NullableId[];
  followUpPatientIds?: NullableId[];
  instructionPatientIds?: NullableId[];
};

function isNonEmptyId(value: NullableId): value is string {
  return typeof value === "string" && value.length > 0;
}

function appendVisibleIds(
  target: Set<string>,
  ids: NullableId[] | undefined,
  activeStaffIds: Set<string>,
  currentStaffUserId: string | null,
  includeOtherStaff: boolean,
) {
  for (const id of ids || []) {
    if (!isNonEmptyId(id)) continue;
    if (!includeOtherStaff && activeStaffIds.has(id) && id !== currentStaffUserId) continue;
    target.add(id);
  }
}

export function buildVisiblePatientIds({
  activeStaffUserIds,
  currentStaffUserId,
  includeOtherStaff = false,
  profileIds,
  patientProfileUserIds,
  patientCareTeamIds,
  patientCareProfileIds,
  bookingUserIds,
  symptomPatientIds,
  followUpPatientIds,
  instructionPatientIds,
}: VisiblePatientIdOptions): string[] {
  const normalizedCurrentStaffUserId = isNonEmptyId(currentStaffUserId)
    ? currentStaffUserId
    : null;
  const activeStaffIds = new Set(activeStaffUserIds.filter(isNonEmptyId));
  const patientIds = new Set<string>();

  appendVisibleIds(patientIds, profileIds, activeStaffIds, normalizedCurrentStaffUserId, includeOtherStaff);
  appendVisibleIds(patientIds, patientProfileUserIds, activeStaffIds, normalizedCurrentStaffUserId, includeOtherStaff);
  appendVisibleIds(patientIds, patientCareTeamIds, activeStaffIds, normalizedCurrentStaffUserId, includeOtherStaff);
  appendVisibleIds(patientIds, patientCareProfileIds, activeStaffIds, normalizedCurrentStaffUserId, includeOtherStaff);
  appendVisibleIds(patientIds, bookingUserIds, activeStaffIds, normalizedCurrentStaffUserId, includeOtherStaff);
  appendVisibleIds(patientIds, symptomPatientIds, activeStaffIds, normalizedCurrentStaffUserId, includeOtherStaff);
  appendVisibleIds(patientIds, followUpPatientIds, activeStaffIds, normalizedCurrentStaffUserId, includeOtherStaff);
  appendVisibleIds(patientIds, instructionPatientIds, activeStaffIds, normalizedCurrentStaffUserId, includeOtherStaff);

  if (includeOtherStaff) {
    for (const staffId of activeStaffIds) {
      patientIds.add(staffId);
    }
  } else if (normalizedCurrentStaffUserId && activeStaffIds.has(normalizedCurrentStaffUserId)) {
    patientIds.add(normalizedCurrentStaffUserId);
  }

  return Array.from(patientIds).sort();
}

export function prioritizeSelfPatient(
  patientIds: string[],
  currentStaffUserId: NullableId,
): string[] {
  if (!isNonEmptyId(currentStaffUserId) || !patientIds.includes(currentStaffUserId)) {
    return patientIds;
  }

  return [currentStaffUserId, ...patientIds.filter((id) => id !== currentStaffUserId)];
}
