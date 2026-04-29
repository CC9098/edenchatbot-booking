#!/usr/bin/env python3
"""Fetch and summarize Eden public bookable schedules for poster work."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any
from urllib.request import urlopen


DEFAULT_API = "https://edenchatbot-booking.vercel.app/api/public/bookable-schedules"
DEFAULT_BOOKING_BASE = "https://edenchatbot-booking.vercel.app/booking"
WEEKDAYS_ZH = {
    0: "星期日",
    1: "星期一",
    2: "星期二",
    3: "星期三",
    4: "星期四",
    5: "星期五",
    6: "星期六",
}


def fetch_json(url: str) -> dict[str, Any]:
    with urlopen(url, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def find_doctor(doctors: list[dict[str, Any]], query: str | None) -> dict[str, Any] | None:
    if not query:
        return None
    q = query.strip().lower()
    for doctor in doctors:
        values = [
            str(doctor.get("doctorId", "")),
            str(doctor.get("doctorNameZh", "")),
            str(doctor.get("doctorNameEn", "")),
        ]
        if any(q == value.lower() or q in value.lower() for value in values):
            return doctor
    return None


def normalize_schedule(doctor: dict[str, Any], include_online: bool) -> dict[int, list[dict[str, str]]]:
    days: dict[int, list[dict[str, str]]] = {i: [] for i in range(7)}
    for clinic in doctor.get("clinics", []):
        clinic_id = str(clinic.get("clinicId", ""))
        if clinic_id == "online" and not include_online:
            continue
        clinic_name = str(clinic.get("clinicNameZh") or clinic.get("clinicNameEn") or clinic_id)
        for day_text, sessions in (clinic.get("schedule") or {}).items():
            if not sessions:
                continue
            day = int(day_text)
            for session in sessions:
                days[day].append(
                    {
                        "clinicId": clinic_id,
                        "clinicNameZh": clinic_name,
                        "start": str(session.get("start", "")),
                        "end": str(session.get("end", "")),
                    }
                )
    for slots in days.values():
        slots.sort(key=lambda slot: (slot["start"], slot["end"], slot["clinicId"]))
    return days


def print_doctor_list(doctors: list[dict[str, Any]]) -> None:
    print("Available doctors:")
    for doctor in doctors:
        print(
            f"- {doctor.get('doctorId')}: "
            f"{doctor.get('doctorNameZh', '')} / {doctor.get('doctorNameEn', '')}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("doctor", nargs="?", help="doctorId or doctor name, e.g. lee")
    parser.add_argument("--api", default=DEFAULT_API, help="public schedule API URL")
    parser.add_argument("--booking-base", default=DEFAULT_BOOKING_BASE, help="booking page base URL")
    parser.add_argument("--include-online", action="store_true", help="include online clinic schedule")
    parser.add_argument("--json", action="store_true", dest="as_json", help="print normalized JSON")
    args = parser.parse_args()

    data = fetch_json(args.api)
    doctors = data.get("doctors") or []
    if not args.doctor:
        print_doctor_list(doctors)
        return 0

    doctor = find_doctor(doctors, args.doctor)
    if not doctor:
        print(f"Doctor not found: {args.doctor}", file=sys.stderr)
        print_doctor_list(doctors)
        return 2

    normalized = normalize_schedule(doctor, args.include_online)
    result = {
        "doctorId": doctor.get("doctorId"),
        "doctorNameZh": doctor.get("doctorNameZh"),
        "doctorNameEn": doctor.get("doctorNameEn"),
        "bookingUrl": f"{args.booking_base}?doctor={doctor.get('doctorId')}",
        "days": normalized,
        "bookingNotices": doctor.get("bookingNotices") or [],
        "clinicEffectiveDates": [
            {
                "clinicId": clinic.get("clinicId"),
                "clinicNameZh": clinic.get("clinicNameZh"),
                "nextEffectiveFrom": clinic.get("nextEffectiveFrom"),
            }
            for clinic in doctor.get("clinics", [])
            if clinic.get("clinicId") != "online" or args.include_online
        ],
    }

    if args.as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    print(f"Doctor: {result['doctorId']} | {result['doctorNameZh']} / {result['doctorNameEn']}")
    print(f"Booking URL: {result['bookingUrl']}")
    print("")
    for day in [1, 2, 3, 4, 5, 6, 0]:
        slots = normalized[day]
        if not slots:
            print(f"{WEEKDAYS_ZH[day]}: 休息")
            continue
        text = " | ".join(
            f"{slot['clinicNameZh']} {slot['start']}-{slot['end']}" for slot in slots
        )
        print(f"{WEEKDAYS_ZH[day]}: {text}")
    notices = result["bookingNotices"]
    if notices:
        print("")
        print("Booking notices:")
        for notice in notices:
            clinic = notice.get("clinicNameZh")
            prefix = f"{clinic}: " if clinic else ""
            print(f"- {prefix}{notice.get('text')}")
    effective = [item for item in result["clinicEffectiveDates"] if item.get("nextEffectiveFrom")]
    if effective:
        print("")
        print("Effective dates:")
        for item in effective:
            print(f"- {item.get('clinicNameZh')}: {item.get('nextEffectiveFrom')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
