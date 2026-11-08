"""School grading-scale helpers."""


def grading_system_for_school(school, curriculum=None) -> str:
    """Resolve the scale, recognizing CBC curricula when the school uses defaults."""
    configured_system = (getattr(school, "grading_system", None) or "percentage").lower().strip()
    if curriculum is None or configured_system != "percentage":
        return configured_system

    identifiers = (
        getattr(curriculum, "short_code", ""),
        getattr(curriculum, "name", ""),
    )
    normalized = " ".join(str(value or "").lower() for value in identifiers)
    if any(
        marker in normalized
        for marker in ("ke-cbc", "competency based curriculum", "competence-based curriculum")
    ):
        return "cbc"
    return configured_system


def grade_label(
    percentage,
    grading_system: str = "percentage",
    passing_mark: int = 50,
) -> str | None:
    """Map a percentage to a short grade label for the selected school scale."""
    if percentage is None:
        return None
    try:
        score = float(percentage)
    except (TypeError, ValueError):
        return None

    system = (grading_system or "percentage").lower().strip()

    if system in ("cbc", "competency", "competency_based", "kjsea"):
        if score >= 90:
            return "EE1"
        if score >= 75:
            return "EE2"
        if score >= 58:
            return "ME1"
        if score >= 41:
            return "ME2"
        if score >= 31:
            return "AE1"
        if score >= 21:
            return "AE2"
        if score >= 11:
            return "BE1"
        return "BE2"

    if system == "mastery":
        if score >= 80:
            return "Mastery"
        if score >= 60:
            return "Approaching mastery"
        return "Beginning"

    if system in ("pass_fail", "pass/fail", "passfail"):
        return "Pass" if score >= float(passing_mark or 50) else "Fail"

    # Keep the existing A-E scale for 8-4-4 and other non-CBC systems.
    if score >= 80:
        return "A"
    if score >= 70:
        return "B"
    if score >= 60:
        return "C"
    if score >= 50:
        return "D"
    return "E"
