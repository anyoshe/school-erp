from decimal import Decimal

from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.school.support import selected_school


def _guardian_profile(user, school=None):
    from .models import GuardianProfile

    if school is not None:
        p = GuardianProfile.objects.filter(user=user, school=school).first()
        if p:
            return p
    return GuardianProfile.objects.filter(user=user).first()


def _ensure_parent_school_membership(user, school):
    """Parents must be on school.users so X-School-ID /me and APIs resolve."""
    if user is None or school is None:
        return
    try:
        school.users.add(user)
    except Exception:
        pass


def _ensure_parent_access(user, school, student_id):
    """Return (profile, student, error_response)."""
    from .models import ParentStudentLink, GuardianProfile
    from apps.students.models import Student

    profile = GuardianProfile.objects.filter(user=user, school=school).first()
    if not profile:
        profile = GuardianProfile.objects.filter(user=user).first()
    if not profile:
        return None, None, Response({"detail": "Parent profile not found"}, status=403)
    _ensure_parent_school_membership(user, school)
    link = ParentStudentLink.objects.filter(
        guardian_profile=profile, student_id=student_id
    ).filter(Q(school=school) | Q(student__school=school)).first()
    if not link:
        return None, None, Response({"detail": "Child not linked to this parent"}, status=403)
    student = Student.objects.filter(pk=student_id, school=school).select_related(
        "current_class", "section"
    ).first()
    if not student:
        return None, None, Response({"detail": "Student not found"}, status=404)
    return profile, student, None


def _auto_provision(user, school):
    """Create profile + links when guardian phone/email matches student guardians."""
    from .models import GuardianProfile, ParentStudentLink
    from apps.students.models import Guardian, StudentGuardian

    phone = (getattr(user, "phone", None) or "").strip()
    email = (user.email or "").strip().lower()
    qs = Guardian.objects.filter(school=school)
    if phone:
        qs = qs.filter(phone__icontains=phone[-9:]) if len(phone) >= 9 else qs.filter(phone=phone)
    elif email:
        qs = qs.filter(email__iexact=email)
    else:
        return None
    guardian_rows = list(qs[:8])
    if not guardian_rows:
        return None
    g0 = guardian_rows[0]
    profile, _ = GuardianProfile.objects.get_or_create(
        user=user,
        defaults={
            "school": school,
            "full_name": g0.full_name or user.get_full_name() or user.email,
            "phone": g0.phone or phone,
            "email": g0.email or email,
        },
    )
    if profile.school_id != school.id:
        return profile
    for g in guardian_rows:
        for sg in StudentGuardian.objects.filter(guardian=g, is_active=True).select_related("student"):
            if sg.student.school_id == school.id:
                ParentStudentLink.objects.get_or_create(
                    school=school,
                    guardian_profile=profile,
                    student=sg.student,
                    defaults={"is_primary": getattr(sg, "is_primary", True)},
                )
    return profile


def _fee_summary(school, student):
    from apps.finance.models import Invoice, Payment

    invs = Invoice.objects.filter(school=school, student=student)
    total_due = invs.aggregate(s=Sum("amount_due"))["s"] or Decimal("0")
    total_paid = invs.aggregate(s=Sum("amount_paid"))["s"] or Decimal("0")
    balance = invs.aggregate(s=Sum("balance"))["s"] or Decimal("0")
    open_count = invs.filter(balance__gt=0).count()
    recent_payments = list(
        Payment.objects.filter(invoice__student=student, invoice__school=school)
        .select_related("invoice")
        .order_by("-paid_at")[:5]
        .values(
            "id",
            "amount",
            "paid_at",
            "payment_method",
            "receipt_number",
            "invoice__invoice_number",
            "invoice__term",
        )
    )
    return {
        "total_invoiced": str(total_due),
        "total_paid": str(total_paid),
        "balance": str(balance),
        "open_invoices": open_count,
        "recent_payments": [
            {
                "id": str(p["id"]),
                "amount": str(p["amount"]),
                "paid_at": p["paid_at"],
                "method": p.get("payment_method") or "",
                "receipt_number": p.get("receipt_number") or "",
                "invoice_number": p.get("invoice__invoice_number") or "",
                "term": p.get("invoice__term") or "",
            }
            for p in recent_payments
        ],
    }


def _attendance_summary(school, student, days=30):
    from apps.attendance.models import StudentAttendance
    from datetime import timedelta

    end = timezone.localdate()
    start = end - timedelta(days=days)
    rows = StudentAttendance.objects.filter(
        school=school, student=student, date__gte=start, date__lte=end
    )
    present = rows.filter(status="PRESENT").count()
    absent = rows.filter(status="ABSENT").count()
    late = rows.filter(status="LATE").count()
    excused = rows.filter(status="EXCUSED").count()
    total = rows.count()
    recent = list(rows.order_by("-date")[:14].values("date", "status", "notes"))
    return {
        "window_days": days,
        "present": present,
        "absent": absent,
        "late": late,
        "excused": excused,
        "total_marked": total,
        "attendance_rate": round((present + late) / total * 100, 1) if total else None,
        "recent": [
            {"date": r["date"].isoformat(), "status": r["status"], "notes": r["notes"] or ""}
            for r in recent
        ],
    }


class ParentChildrenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            school = selected_school(request)
        except Exception:
            school = None
        if not school:
            return Response(
                {
                    "children": [],
                    "detail": "No school available for this parent account. Ask the school office to re-link your login.",
                }
            )
        _ensure_parent_school_membership(request.user, school)
        profile = _guardian_profile(request.user, school)
        if not profile:
            profile = _auto_provision(request.user, school)
        if not profile:
            # Links may exist under profile without school filter match
            from .models import GuardianProfile, ParentStudentLink
            profile = GuardianProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response(
                {
                    "children": [],
                    "detail": "No parent profile linked. Ask the school to link your account under Parent Portal.",
                }
            )
        from .models import ParentStudentLink

        links = (
            ParentStudentLink.objects.filter(guardian_profile=profile)
            .filter(Q(school=school) | Q(student__school=school))
            .select_related("student", "student__current_class", "student__section")
            .order_by("student__last_name", "student__first_name")
        )
        children = []
        for link in links:
            s = link.student
            fees = _fee_summary(school, s)
            att = _attendance_summary(school, s, days=14)
            children.append(
                {
                    "id": str(s.id),
                    "admission_number": s.admission_number,
                    "full_name": f"{s.first_name or ''} {s.last_name or ''}".strip(),
                    "grade": s.current_class.name if s.current_class else None,
                    "section": s.section.name if s.section else None,
                    "status": s.status,
                    "is_primary_contact": link.is_primary,
                    "fee_balance": fees["balance"],
                    "open_invoices": fees["open_invoices"],
                    "recent_absences": att["absent"],
                    "attendance_rate": att["attendance_rate"],
                }
            )
        return Response({"children": children, "guardian": profile.full_name})


class ParentChildOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        profile, student, err = _ensure_parent_access(request.user, school, student_id)
        if err:
            return err
        fees = _fee_summary(school, student)
        att = _attendance_summary(school, student, days=30)
        results_preview = None
        try:
            from apps.assessments.views import _build_student_report

            card = _build_student_report(student, school)
            results_preview = {
                "overall_average": card.get("overall_average"),
                "position": card.get("position") or card.get("class_position"),
                "term": card.get("term") or card.get("term_name"),
                "academic_year": card.get("academic_year") or card.get("year_name"),
                "subject_count": len(card.get("subjects") or []),
            }
        except Exception:
            results_preview = None
        return Response(
            {
                "student": {
                    "id": str(student.id),
                    "admission_number": student.admission_number,
                    "full_name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
                    "grade": student.current_class.name if student.current_class else None,
                    "section": student.section.name if student.section else None,
                    "status": student.status,
                },
                "guardian": profile.full_name,
                "fees": fees,
                "attendance": att,
                "results_preview": results_preview,
            }
        )


class ParentChildResultsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        _, student, err = _ensure_parent_access(request.user, school, student_id)
        if err:
            return err
        from apps.assessments.views import _build_student_report

        try:
            card = _build_student_report(
                student,
                school,
                academic_year_id=request.query_params.get("academic_year"),
                term_id=request.query_params.get("term"),
            )
            try:
                from apps.assessments.views import _school_print_branding
                brand = _school_print_branding(school, request)
                if isinstance(card.get("school"), dict):
                    card["school"].update(brand)
            except Exception:
                pass
        except Exception as exc:
            card = {
                "student": {
                    "id": str(student.id),
                    "full_name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
                    "admission_number": student.admission_number,
                },
                "subjects": [],
                "overall_average": None,
                "detail": "Results are not available yet for this term.",
                "error": str(exc)[:200],
            }
        return Response(card)


class ParentChildFeesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        _, student, err = _ensure_parent_access(request.user, school, student_id)
        if err:
            return err
        from apps.finance.models import Invoice, Payment

        invoices = Invoice.objects.filter(school=school, student=student).order_by(
            "-due_date", "-generated_at"
        )
        inv_payload = []
        for inv in invoices[:40]:
            try:
                lines = list(
                    inv.lines.all().values(
                        "description", "amount", "is_waived", "discount_amount"
                    )
                )
            except Exception:
                lines = []
            inv_payload.append(
                {
                    "id": str(inv.id),
                    "invoice_number": inv.invoice_number,
                    "term": getattr(inv, "term", "") or "",
                    "amount_due": str(inv.amount_due),
                    "amount_paid": str(inv.amount_paid),
                    "balance": str(inv.balance),
                    "is_paid": inv.is_paid,
                    "due_date": inv.due_date.isoformat() if inv.due_date else None,
                    "lines": [
                        {
                            "description": ln.get("description") or "Item",
                            "amount": str(ln.get("amount") or 0),
                            "is_waived": bool(ln.get("is_waived")),
                            "discount_amount": str(ln.get("discount_amount") or 0),
                        }
                        for ln in lines
                    ],
                }
            )
        payments = (
            Payment.objects.filter(invoice__student=student, invoice__school=school)
            .select_related("invoice")
            .order_by("-paid_at")[:50]
        )
        pay_payload = [
            {
                "id": str(p.id),
                "amount": str(p.amount),
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
                "method": getattr(p, "payment_method", "") or "",
                "receipt_number": getattr(p, "receipt_number", "") or "",
                "reference": getattr(p, "reference", "") or "",
                "invoice_number": p.invoice.invoice_number if p.invoice_id else "",
            }
            for p in payments
        ]
        return Response(
            {
                "summary": _fee_summary(school, student),
                "invoices": inv_payload,
                "payments": pay_payload,
            }
        )


class ParentChildAttendanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        _, student, err = _ensure_parent_access(request.user, school, student_id)
        if err:
            return err
        from apps.attendance.models import StudentAttendance
        from datetime import timedelta

        days = int(request.query_params.get("days") or 60)
        days = max(7, min(days, 180))
        end = timezone.localdate()
        start = end - timedelta(days=days)
        rows = StudentAttendance.objects.filter(
            school=school, student=student, date__gte=start, date__lte=end
        ).order_by("-date")
        records = [
            {"date": r.date.isoformat(), "status": r.status, "notes": r.notes or ""}
            for r in rows[:120]
        ]
        return Response({"summary": _attendance_summary(school, student, days=days), "records": records})


class ParentLinkStudentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        role = getattr(request.user, "role", "") or ""
        if role in ("PARENT", "STUDENT"):
            return Response({"detail": "Staff only"}, status=403)

        from apps.accounts.models import User
        from apps.students.models import Student
        from .models import GuardianProfile, ParentStudentLink

        user_id = request.data.get("user_id")
        email = (request.data.get("email") or "").strip().lower()
        admission = (request.data.get("admission_number") or "").strip()
        if not admission or (not user_id and not email):
            return Response(
                {"detail": "admission_number and user_id or email required"},
                status=400,
            )
        student = Student.objects.filter(school=school, admission_number__iexact=admission).first()
        if not student:
            return Response({"detail": "Student not found"}, status=404)
        user = None
        if user_id:
            user = User.objects.filter(pk=user_id).first()
        elif email:
            user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({"detail": "Parent user not found"}, status=404)

        profile, _ = GuardianProfile.objects.get_or_create(
            user=user,
            defaults={
                "school": school,
                "full_name": user.get_full_name() or user.email,
                "phone": getattr(user, "phone", "") or "",
                "email": user.email or "",
            },
        )
        if profile.school_id != school.id:
            profile.school = school
            profile.save(update_fields=["school"])
        link, created = ParentStudentLink.objects.get_or_create(
            school=school,
            guardian_profile=profile,
            student=student,
            defaults={"is_primary": True},
        )
        _ensure_parent_school_membership(user, school)
        if getattr(user, "role", None) != "PARENT":
            try:
                from apps.accounts.models import User as UserModel
                if user.role not in (
                    UserModel.Role.SUPER_ADMIN,
                    UserModel.Role.SCHOOL_ADMIN,
                    UserModel.Role.PRINCIPAL,
                    UserModel.Role.TEACHER,
                ):
                    user.role = UserModel.Role.PARENT
                    user.save(update_fields=["role"])
            except Exception:
                pass
        return Response(
            {
                "linked": True,
                "created": created,
                "student": student.admission_number,
                "parent": user.email,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ParentInviteView(APIView):
    """Staff: create (or reuse) a PARENT user and link to a student."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        role = getattr(request.user, "role", "") or ""
        if role in ("PARENT", "STUDENT"):
            return Response({"detail": "Staff only"}, status=403)

        import secrets

        from apps.accounts.models import User
        from apps.students.models import Student
        from .models import GuardianProfile, ParentStudentLink

        admission = (request.data.get("admission_number") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        full_name = (request.data.get("full_name") or "").strip()
        phone = (request.data.get("phone") or "").strip()
        password = (request.data.get("password") or "").strip()

        if not admission or not email:
            return Response(
                {"detail": "admission_number and email are required"},
                status=400,
            )
        student = Student.objects.filter(school=school, admission_number__iexact=admission).first()
        if not student:
            return Response({"detail": "Student not found for this school"}, status=404)

        created_user = False
        temp_password = None
        password_reset = False
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            parts = full_name.split(None, 1) if full_name else ["", ""]
            first = parts[0] if parts else ""
            last = parts[1] if len(parts) > 1 else ""
            if not password:
                password = secrets.token_urlsafe(9)
                temp_password = password
            user = User.objects.create_user(
                email=email,
                password=password,
                role=User.Role.PARENT,
                first_name=first or "Parent",
                last_name=last or student.last_name or "",
                force_change_password=True,
                is_active=True,
            )
            created_user = True
        else:
            # Re-invite: ensure can log in (role, active, optional password reset)
            updates = []
            if user.role != User.Role.PARENT and user.role not in (
                User.Role.SUPER_ADMIN,
                User.Role.SCHOOL_ADMIN,
                User.Role.PRINCIPAL,
            ):
                user.role = User.Role.PARENT
                updates.append("role")
            if not user.is_active:
                user.is_active = True
                updates.append("is_active")
            if password:
                user.set_password(password)
                user.force_change_password = True
                updates.extend(["password", "force_change_password"])
                password_reset = True
                temp_password = password
            elif not user.has_usable_password():
                password = secrets.token_urlsafe(9)
                user.set_password(password)
                user.force_change_password = True
                updates.extend(["password", "force_change_password"])
                temp_password = password
                password_reset = True
            if updates:
                # password is not a concrete field for update_fields the same way
                user.save()

        display_name = full_name or user.get_full_name() or email
        profile, _ = GuardianProfile.objects.get_or_create(
            user=user,
            defaults={
                "school": school,
                "full_name": display_name,
                "phone": phone,
                "email": email,
            },
        )
        if profile.school_id != school.id:
            profile.school = school
            profile.save(update_fields=["school"])
        if phone and not profile.phone:
            profile.phone = phone
            profile.save(update_fields=["phone"])
        if full_name and profile.full_name != full_name:
            profile.full_name = full_name
            profile.save(update_fields=["full_name"])

        link, link_created = ParentStudentLink.objects.get_or_create(
            school=school,
            guardian_profile=profile,
            student=student,
            defaults={"is_primary": True},
        )
        _ensure_parent_school_membership(user, school)
        payload = {
            "ok": True,
            "user_created": created_user,
            "link_created": link_created,
            "password_reset": password_reset,
            "parent_email": user.email,
            "student": student.admission_number,
            "student_name": f"{student.first_name or ''} {student.last_name or ''}".strip(),
            "login_path": "/parent-login",
        }
        if temp_password:
            payload["temporary_password"] = temp_password
            payload["note"] = (
                "Share this password securely. Parent signs in at /parent-login "
                "and must set a new password on first login."
            )
        elif not created_user:
            payload["note"] = (
                "Account already existed and was linked. If the parent cannot log in, "
                "invite again with a Password filled in to reset it."
            )
        return Response(
            payload,
            status=status.HTTP_201_CREATED if created_user or link_created else status.HTTP_200_OK,
        )


class ParentDirectoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        role = getattr(request.user, "role", "") or ""
        if role in ("PARENT", "STUDENT"):
            return Response({"detail": "Staff only"}, status=403)

        from .models import ParentStudentLink

        q = (request.query_params.get("q") or "").strip()
        links = (
            ParentStudentLink.objects.filter(school=school)
            .select_related(
                "guardian_profile",
                "guardian_profile__user",
                "student",
                "student__current_class",
            )
            .order_by("-created_at")
        )
        if q:
            links = links.filter(
                Q(student__admission_number__icontains=q)
                | Q(student__first_name__icontains=q)
                | Q(student__last_name__icontains=q)
                | Q(guardian_profile__full_name__icontains=q)
                | Q(guardian_profile__email__icontains=q)
                | Q(guardian_profile__user__email__icontains=q)
            )
        items = []
        for link in links[:200]:
            g = link.guardian_profile
            s = link.student
            items.append(
                {
                    "id": link.id,
                    "parent_name": g.full_name,
                    "parent_email": g.email or (g.user.email if g.user_id else ""),
                    "parent_phone": g.phone or "",
                    "student_name": f"{s.first_name or ''} {s.last_name or ''}".strip(),
                    "admission_number": s.admission_number,
                    "grade": s.current_class.name if s.current_class else None,
                    "is_primary": link.is_primary,
                    "linked_at": link.created_at.isoformat() if link.created_at else None,
                }
            )
        return Response({"count": len(items), "links": items})


class ParentUnlinkView(APIView):
    """Staff: remove a parent–student link so they can be invited fresh."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        role = getattr(request.user, "role", "") or ""
        if role in ("PARENT", "STUDENT"):
            return Response({"detail": "Staff only"}, status=403)

        from .models import GuardianProfile, ParentStudentLink

        link_id = request.data.get("link_id") or request.data.get("id")
        admission = (request.data.get("admission_number") or "").strip()
        email = (request.data.get("email") or "").strip().lower()
        delete_user = bool(request.data.get("delete_user"))

        link = None
        if link_id:
            link = ParentStudentLink.objects.filter(school=school, pk=link_id).select_related(
                "guardian_profile", "guardian_profile__user", "student"
            ).first()
        elif admission and email:
            link = (
                ParentStudentLink.objects.filter(school=school)
                .filter(student__admission_number__iexact=admission)
                .filter(
                    Q(guardian_profile__email__iexact=email)
                    | Q(guardian_profile__user__email__iexact=email)
                )
                .select_related("guardian_profile", "guardian_profile__user", "student")
                .first()
            )
        if not link:
            return Response(
                {"detail": "Link not found. Provide link_id or admission_number + email."},
                status=404,
            )

        profile = link.guardian_profile
        user = profile.user if profile else None
        student_adm = link.student.admission_number if link.student_id else None
        parent_email = (profile.email if profile else None) or (
            user.email if user else None
        )

        link.delete()

        remaining = 0
        profile_deleted = False
        user_deleted = False
        if profile is not None:
            remaining = ParentStudentLink.objects.filter(guardian_profile=profile).count()
            if remaining == 0:
                # Drop empty guardian profile so invite is truly fresh
                if user is not None and delete_user and (getattr(user, "role", "") or "").upper() == "PARENT":
                    # Remove school membership then user
                    try:
                        school.users.remove(user)
                    except Exception:
                        pass
                    user.delete()
                    user_deleted = True
                    profile_deleted = True  # cascade
                else:
                    profile.delete()
                    profile_deleted = True
                    if user is not None and (getattr(user, "role", "") or "").upper() == "PARENT":
                        # Keep login but no profile until re-invited
                        try:
                            # only remove membership if no other parent links at this school
                            still = ParentStudentLink.objects.filter(
                                school=school, guardian_profile__user=user
                            ).exists()
                            if not still:
                                school.users.remove(user)
                        except Exception:
                            pass

        return Response(
            {
                "ok": True,
                "unlinked": True,
                "admission_number": student_adm,
                "parent_email": parent_email,
                "remaining_links_for_parent": remaining,
                "profile_deleted": profile_deleted,
                "user_deleted": user_deleted,
                "message": (
                    "Parent unlinked. Use Invite again with a password to create a fresh login."
                    if not user_deleted
                    else "Parent unlinked and login account removed. Invite again to create a new account."
                ),
            }
        )


class ParentUnlinkDeleteView(APIView):
    """DELETE /parent-portal/links/<id>/ — same as post unlink."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, link_id):
        request._full_data = request.data.copy() if hasattr(request, "data") else {}
        # DRF Request: inject link_id into data for ParentUnlinkView
        view = ParentUnlinkView()
        view.request = request
        # Build a minimal post
        from rest_framework.test import APIRequestFactory
        # Simpler: call logic inline
        school = selected_school(request)
        if not school:
            return Response({"detail": "No school selected"}, status=400)
        role = getattr(request.user, "role", "") or ""
        if role in ("PARENT", "STUDENT"):
            return Response({"detail": "Staff only"}, status=403)
        from .models import ParentStudentLink, GuardianProfile

        link = ParentStudentLink.objects.filter(school=school, pk=link_id).select_related(
            "guardian_profile", "guardian_profile__user", "student"
        ).first()
        if not link:
            return Response({"detail": "Link not found"}, status=404)
        profile = link.guardian_profile
        user = profile.user if profile else None
        student_adm = link.student.admission_number if link.student_id else None
        parent_email = (profile.email if profile else None) or (user.email if user else None)
        link.delete()
        remaining = 0
        profile_deleted = False
        if profile is not None:
            remaining = ParentStudentLink.objects.filter(guardian_profile=profile).count()
            if remaining == 0:
                profile.delete()
                profile_deleted = True
                if user is not None and (getattr(user, "role", "") or "").upper() == "PARENT":
                    try:
                        school.users.remove(user)
                    except Exception:
                        pass
        return Response(
            {
                "ok": True,
                "unlinked": True,
                "admission_number": student_adm,
                "parent_email": parent_email,
                "remaining_links_for_parent": remaining,
                "profile_deleted": profile_deleted,
                "message": "Parent unlinked. Invite again with a password for a fresh login.",
            }
        )
