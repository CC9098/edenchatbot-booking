type NullableId = string | null | undefined;

type VisiblePatientIdOptions = {
  activeStaffUserIds: NullableId[];
  currentStaffUserId?: NullableId;
  profileIds?: NullableId[];
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
) {
  for (const id of ids || []) {
    if (!isNonEmptyId(id)) continue;
    if (activeStaffIds.has(id) && id !== currentStaffUserId) continue;
    target.add(id);
  }
}

export function buildVisiblePatientIds({
  activeStaffUserIds,
  currentStaffUserId,
  profileIds,
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

  appendVisibleIds(patientIds, profileIds, activeStaffIds, normalizedCurrentStaffUserId);
  appendVisibleIds(patientIds, patientCareTeamIds, activeStaffIds, normalizedCurrentStaffUserId);
  appendVisibleIds(patientIds, patientCareProfileIds, activeStaffIds, normalizedCurrentStaffUserId);
  appendVisibleIds(patientIds, bookingUserIds, activeStaffIds, normalizedCurrentStaffUserId);
  appendVisibleIds(patientIds, symptomPatientIds, activeStaffIds, normalizedCurrentStaffUserId);
  appendVisibleIds(patientIds, followUpPatientIds, activeStaffIds, normalizedCurrentStaffUserId);
  appendVisibleIds(patientIds, instructionPatientIds, activeStaffIds, normalizedCurrentStaffUserId);

  if (normalizedCurrentStaffUserId && activeStaffIds.has(normalizedCurrentStaffUserId)) {
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
