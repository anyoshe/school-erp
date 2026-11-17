"""
Curated free digital learning links for Kenyan CBC/CBE primary & secondary.

These are templates only. When a school is created (or an admin runs the
seed command / Restore starter pack), each entry is copied into that school's
DigitalResource table. Schools may delete any row; other schools are unaffected.
Schools can still upload or link their own materials.
"""

# resource_type values must match DigitalResource.ResourceType
# level: "primary" | "secondary" | "both"

STARTER_DIGITAL_RESOURCES = [
    # ----- Official / system portals (both levels) -----
    {
        "key": "kec-home",
        "title": "Kenya Education Cloud (KEC) — official digital content",
        "external_url": "https://kec.ac.ke",
        "subject": "All learning areas",
        "grade_levels": "PP1–Grade 12",
        "resource_type": "EXTERNAL",
        "curriculum": "CBC",
        "language": "English",
        "copyright_owner": "KICD",
        "licence_type": "STARTER_PACK",
        "description": "Official KICD portal: interactive lessons, EduTV, radio and e-books. Free for learners and teachers.",
        "level": "both",
        "allow_download": False,
    },
    {
        "key": "kec-lms",
        "title": "Kenya Education Cloud LMS — grade lessons",
        "external_url": "https://lms.kec.ac.ke",
        "subject": "All learning areas",
        "grade_levels": "PP1–Grade 12",
        "resource_type": "EXTERNAL",
        "curriculum": "CBC",
        "language": "English",
        "copyright_owner": "KICD",
        "licence_type": "STARTER_PACK",
        "description": "Browse interactive digital content and audio lessons by grade and learning area.",
        "level": "both",
        "allow_download": False,
    },
    {
        "key": "kicd-cbc-materials",
        "title": "KICD CBC / CBE materials & curriculum designs",
        "external_url": "https://kicd.ac.ke/cbc-materials/",
        "subject": "Curriculum",
        "grade_levels": "PP1–Grade 12",
        "resource_type": "EXTERNAL",
        "curriculum": "CBC",
        "language": "English",
        "copyright_owner": "KICD",
        "licence_type": "STARTER_PACK",
        "description": "Official curriculum designs and approved learning materials from KICD.",
        "level": "both",
        "allow_download": False,
    },
    # ----- Primary literacy -----
    {
        "key": "african-storybook",
        "title": "African Storybook — free picture stories",
        "external_url": "https://www.africanstorybook.org/",
        "subject": "Literacy / English / Kiswahili",
        "grade_levels": "PP1,PP2,Grade 1,Grade 2,Grade 3",
        "resource_type": "EBOOK",
        "curriculum": "CBC",
        "language": "English / Kiswahili",
        "copyright_owner": "African Storybook (Saide)",
        "licence_type": "STARTER_PACK",
        "description": "Thousands of free openly licensed picture storybooks in African languages. Ideal for early reading.",
        "level": "primary",
        "allow_download": False,
    },
    {
        "key": "storybooks-kenya",
        "title": "Storybooks Kenya — multilingual stories with audio",
        "external_url": "https://global-asp.github.io/storybooks-kenya/",
        "subject": "Literacy / English / Kiswahili",
        "grade_levels": "PP1,PP2,Grade 1,Grade 2,Grade 3",
        "resource_type": "EBOOK",
        "curriculum": "CBC",
        "language": "English / Kiswahili",
        "copyright_owner": "Storybooks Kenya / African Storybook",
        "licence_type": "STARTER_PACK",
        "description": "Selected African Storybook titles in Kenyan languages with text and audio support.",
        "level": "primary",
        "allow_download": False,
    },
    # ----- Maths & science practice -----
    {
        "key": "khan-academy",
        "title": "Khan Academy — free maths & science practice",
        "external_url": "https://www.khanacademy.org/",
        "subject": "Mathematics / Science",
        "grade_levels": "Grade 3–Form 4",
        "resource_type": "EXTERNAL",
        "curriculum": "CBC / general",
        "language": "English",
        "copyright_owner": "Khan Academy",
        "licence_type": "STARTER_PACK",
        "description": "Free videos and practice exercises. Map topics to your CBC strands for class work and revision.",
        "level": "both",
        "allow_download": False,
    },
    {
        "key": "phet-simulations",
        "title": "PhET interactive science & maths simulations",
        "external_url": "https://phet.colorado.edu/",
        "subject": "Science / Mathematics",
        "grade_levels": "Grade 6–Form 4",
        "resource_type": "EXTERNAL",
        "curriculum": "CBC / general",
        "language": "English",
        "copyright_owner": "University of Colorado Boulder",
        "licence_type": "STARTER_PACK",
        "description": "Free interactive simulations for science and maths. Useful for upper primary and secondary labs.",
        "level": "both",
        "allow_download": False,
    },
    # ----- Secondary-focused -----
    {
        "key": "knec-portal",
        "title": "KNEC — examinations information",
        "external_url": "https://www.knec.ac.ke/",
        "subject": "Examinations",
        "grade_levels": "Grade 6,Grade 9,Form 4",
        "resource_type": "EXTERNAL",
        "curriculum": "CBC / KCSE",
        "language": "English",
        "copyright_owner": "KNEC",
        "licence_type": "STARTER_PACK",
        "description": "Official Kenya National Examinations Council site for assessment information.",
        "level": "secondary",
        "allow_download": False,
    },
    {
        "key": "teachers-kenya-hub",
        "title": "Teachers Kenya Hub — free schemes & notes (staff)",
        "external_url": "https://teacherske.co.ke/",
        "subject": "Teacher resources",
        "grade_levels": "PP1–Grade 10",
        "resource_type": "NOTES",
        "curriculum": "CBC",
        "language": "English",
        "copyright_owner": "Teachers Kenya Hub",
        "licence_type": "STARTER_PACK",
        "description": "Free KICD-aligned schemes of work, lesson plans and notes. Aimed at teachers more than learners.",
        "level": "both",
        "allow_download": False,
    },
]


def catalog_for_levels(levels=None):
    """
    levels: None = all; or iterable of 'primary', 'secondary', 'both'.
    Entries with level 'both' always included when filtering by primary or secondary.
    """
    if not levels:
        return list(STARTER_DIGITAL_RESOURCES)
    levels = set(levels)
    out = []
    for row in STARTER_DIGITAL_RESOURCES:
        lv = row.get("level") or "both"
        if lv == "both" or lv in levels:
            out.append(row)
    return out
