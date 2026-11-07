"""
Default CBC-oriented subject catalog and grade mappings.
"""
from __future__ import annotations

# (name, code, is_compulsory)
CORE_CATALOG = [
    ("English", "ENG", True),
    ("Kiswahili", "KIS", True),
    ("Mathematics", "MATH", True),
    ("Environmental Activities", "ENV", True),
    ("Hygiene and Nutrition", "HYG", True),
    ("Religious Education", "RE", True),
    ("Creative Arts", "CA", True),
    ("Physical Education", "PE", True),
    ("Science and Technology", "SCI", True),
    ("Social Studies", "SS", True),
    ("Agriculture", "AGR", False),
    ("Home Science", "HS", False),
    ("Computer Studies / ICT", "ICT", False),
    ("Business Studies", "BUS", False),
    ("French", "FR", False),
    ("German", "DE", False),
    ("Indigenous Language", "IL", False),
    ("Life Skills", "LS", True),
]

# grade name key -> list of subject names (must exist in catalog)
GRADE_SUBJECTS = {
    "PLAYGROUP": [
        "English", "Mathematics", "Environmental Activities", "Creative Arts",
        "Physical Education", "Religious Education", "Hygiene and Nutrition",
    ],
    "PP1": [
        "English", "Kiswahili", "Mathematics", "Environmental Activities",
        "Creative Arts", "Physical Education", "Religious Education", "Hygiene and Nutrition",
    ],
    "PP2": [
        "English", "Kiswahili", "Mathematics", "Environmental Activities",
        "Creative Arts", "Physical Education", "Religious Education", "Hygiene and Nutrition",
    ],
    "GRADE1": [
        "English", "Kiswahili", "Mathematics", "Environmental Activities",
        "Religious Education", "Creative Arts", "Physical Education", "Hygiene and Nutrition",
    ],
    "GRADE2": [
        "English", "Kiswahili", "Mathematics", "Environmental Activities",
        "Religious Education", "Creative Arts", "Physical Education", "Hygiene and Nutrition",
    ],
    "GRADE3": [
        "English", "Kiswahili", "Mathematics", "Environmental Activities",
        "Religious Education", "Creative Arts", "Physical Education", "Hygiene and Nutrition",
    ],
    "GRADE4": [
        "English", "Kiswahili", "Mathematics", "Science and Technology", "Social Studies",
        "Religious Education", "Creative Arts", "Physical Education", "Agriculture", "Life Skills",
    ],
    "GRADE5": [
        "English", "Kiswahili", "Mathematics", "Science and Technology", "Social Studies",
        "Religious Education", "Creative Arts", "Physical Education", "Agriculture", "Home Science", "Life Skills",
    ],
    "GRADE6": [
        "English", "Kiswahili", "Mathematics", "Science and Technology", "Social Studies",
        "Religious Education", "Creative Arts", "Physical Education", "Agriculture", "Home Science",
        "Computer Studies / ICT", "Life Skills",
    ],
    "GRADE7": [
        "English", "Kiswahili", "Mathematics", "Science and Technology", "Social Studies",
        "Religious Education", "Creative Arts", "Physical Education", "Agriculture",
        "Computer Studies / ICT", "Business Studies", "Life Skills",
    ],
    "GRADE8": [
        "English", "Kiswahili", "Mathematics", "Science and Technology", "Social Studies",
        "Religious Education", "Creative Arts", "Physical Education", "Agriculture",
        "Computer Studies / ICT", "Business Studies", "Life Skills",
    ],
    "GRADE9": [
        "English", "Kiswahili", "Mathematics", "Science and Technology", "Social Studies",
        "Religious Education", "Creative Arts", "Physical Education", "Agriculture",
        "Computer Studies / ICT", "Business Studies", "Life Skills",
    ],
}


def normalize_grade_key(name: str) -> str:
    n = (name or "").strip().upper().replace(" ", "").replace("-", "")
    if "PLAY" in n or n in ("PG", "PLAYGROUP"):
        return "PLAYGROUP"
    if n in ("PP1", "PREPRIMARY1", "PREPRIMARYI"):
        return "PP1"
    if n in ("PP2", "PREPRIMARY2", "PREPRIMARYII"):
        return "PP2"
    for i in range(1, 13):
        if n in (f"GRADE{i}", f"G{i}", f"CLASS{i}", str(i)):
            return f"GRADE{i}"
    # "Grade 1" style already upper without space -> GRADE1 handled
    if n.startswith("GRADE"):
        return n
    return "GRADE1"


def ensure_subject_catalog(school):
    from apps.academics.models import Subject
    by_name = {}
    for name, code, compulsory in CORE_CATALOG:
        sub, _ = Subject.objects.get_or_create(
            school=school,
            name=name,
            defaults={
                "code": code,
                "is_compulsory": compulsory,
                "is_active": True,
            },
        )
        by_name[name] = sub
    return by_name


def map_subjects_for_grade(grade, subject_by_name=None, replace=False):
    """Create GradeLevelSubject rows for a grade. Returns created count."""
    from apps.academics.models import GradeLevelSubject, Subject
    school = grade.school
    if subject_by_name is None:
        subject_by_name = ensure_subject_catalog(school)
    key = normalize_grade_key(grade.name)
    names = GRADE_SUBJECTS.get(key) or GRADE_SUBJECTS.get("GRADE1") or []
    created = 0
    if replace:
        GradeLevelSubject.objects.filter(grade_level=grade).delete()
    for order, name in enumerate(names, start=1):
        sub = subject_by_name.get(name)
        if not sub:
            sub = Subject.objects.filter(school=school, name__iexact=name).first()
        if not sub:
            continue
        _, was = GradeLevelSubject.objects.get_or_create(
            grade_level=grade,
            subject=sub,
            defaults={
                "is_compulsory": sub.is_compulsory,
                "order": order,
            },
        )
        if was:
            created += 1
    return created


def seed_school_subject_map(school, replace=False):
    from apps.academics.models import GradeLevel
    catalog = ensure_subject_catalog(school)
    grades = GradeLevel.objects.filter(school=school).order_by("order")
    total = 0
    for g in grades:
        total += map_subjects_for_grade(g, catalog, replace=replace)
    return {"subjects": len(catalog), "mapped": total, "grades": grades.count()}
