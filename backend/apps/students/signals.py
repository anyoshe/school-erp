from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.students.models import Student
from apps.academics.models import GradeLevelSubject
from apps.students.models import StudentSubject


@receiver(post_save, sender=Student)
def assign_compulsory_subjects(sender, instance, created, **kwargs):

    if not created:
        return

    grade_subjects = GradeLevelSubject.objects.filter(
        grade_level=instance.grade_level,
        is_compulsory=True
    )

    for gs in grade_subjects:

        StudentSubject.objects.get_or_create(
            student=instance,
            subject=gs.subject,
            defaults={
                "is_compulsory": True
            }
        )