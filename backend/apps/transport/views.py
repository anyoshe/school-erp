from decimal import Decimal

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAssociatedWithSchool


def _school(request):
    from apps.school.support import selected_school
    return selected_school(request)


class RouteListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get(self, request):
        school = _school(request)
        if not school:
            return Response({"detail": "School context required"}, status=400)
        from .models import Route
        from .serializers import RouteSerializer

        active = request.query_params.get("active")
        qs = Route.objects.filter(school=school).order_by("sort_order", "name")
        if active in ("1", "true", "True"):
            qs = qs.filter(is_active=True)
        return Response(RouteSerializer(qs, many=True).data)

    def post(self, request):
        school = _school(request)
        if not school:
            return Response({"detail": "School context required"}, status=400)
        from .models import Route
        from .serializers import RouteSerializer

        ser = RouteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        route = Route.objects.create(school=school, **ser.validated_data)
        return Response(RouteSerializer(route).data, status=status.HTTP_201_CREATED)


class RouteDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def patch(self, request, pk):
        school = _school(request)
        from .models import Route
        from .serializers import RouteSerializer

        route = Route.objects.filter(pk=pk, school=school).first()
        if not route:
            return Response({"detail": "Not found"}, status=404)
        ser = RouteSerializer(route, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        for k, v in ser.validated_data.items():
            setattr(route, k, v)
        route.save()
        return Response(RouteSerializer(route).data)

    def delete(self, request, pk):
        school = _school(request)
        from .models import Route

        route = Route.objects.filter(pk=pk, school=school).first()
        if not route:
            return Response({"detail": "Not found"}, status=404)
        if route.assignments.exists():
            route.is_active = False
            route.save(update_fields=["is_active", "updated_at"])
            return Response({"detail": "Route deactivated (has assignments)", "id": str(route.id)})
        route.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TransportRoutesForBillingView(APIView):
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get(self, request):
        school = _school(request)
        if not school:
            return Response({"detail": "School context required"}, status=400)
        from .services import routes_payload, ensure_transport_fee_item

        item = ensure_transport_fee_item(school)
        return Response(
            {
                "fee_item_id": str(item.id),
                "item_name": item.name,
                "routes": routes_payload(school, active_only=True),
            }
        )


class StudentTransportSubscribeView(APIView):
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def post(self, request, student_id):
        school = _school(request)
        from apps.students.models import Student
        from .models import Route
        from .services import subscribe_student
        from .serializers import StudentAssignmentSerializer

        student = Student.objects.filter(pk=student_id, school=school).first()
        if not student:
            return Response({"detail": "Student not found"}, status=404)
        route_id = request.data.get("route_id") or request.data.get("route")
        route = Route.objects.filter(pk=route_id, school=school, is_active=True).first()
        if not route:
            return Response({"detail": "Select an active route"}, status=400)

        amount_override = request.data.get("amount_override")
        if amount_override is not None and amount_override != "":
            amount_override = Decimal(str(amount_override))
        else:
            amount_override = None

        bill = request.data.get("bill", True)
        if isinstance(bill, str):
            bill = bill.lower() not in ("0", "false", "no")

        try:
            asg, line = subscribe_student(
                student,
                route,
                user=request.user,
                pickup_point=request.data.get("pickup_point") or "",
                dropoff_point=request.data.get("dropoff_point") or "",
                academic_year=request.data.get("academic_year") or "",
                term=request.data.get("term") or "",
                amount_override=amount_override,
                bill=bool(bill),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

        return Response(
            {
                "assignment": StudentAssignmentSerializer(asg).data,
                "invoice_line_id": str(line.id) if line else None,
                "amount_billed": float(asg.effective_amount()) if line else 0,
            },
            status=status.HTTP_201_CREATED,
        )


class StudentTransportAssignmentsView(APIView):
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def get(self, request):
        school = _school(request)
        from .models import StudentAssignment
        from .serializers import StudentAssignmentSerializer

        qs = (
            StudentAssignment.objects.filter(school=school, is_active=True)
            .select_related("student", "route")
            .order_by("-assigned_at")[:200]
        )
        return Response(StudentAssignmentSerializer(qs, many=True).data)


class StudentTransportDeactivateView(APIView):
    """End an active transport subscription without deleting history."""
    permission_classes = [IsAuthenticated, IsAssociatedWithSchool]

    def post(self, request, assignment_id):
        school = _school(request)
        from .models import StudentAssignment
        from .serializers import StudentAssignmentSerializer

        asg = StudentAssignment.objects.filter(pk=assignment_id, school=school).first()
        if not asg:
            return Response({"detail": "Not found"}, status=404)
        asg.is_active = False
        asg.save(update_fields=["is_active", "updated_at"])
        return Response(StudentAssignmentSerializer(asg).data)


class TransportDaySheetView(APIView):
    """Active learner assignments grouped by route — printable day list."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = _school(request)
        route_id = request.query_params.get("route_id")
        from .models import StudentAssignment
        qs = (
            StudentAssignment.objects.filter(school=school, is_active=True)
            .select_related("student", "route", "student__current_class")
            .order_by("route__name", "student__last_name", "student__first_name")
        )
        if route_id:
            qs = qs.filter(route_id=route_id)
        routes = {}
        for a in qs:
            rid = a.route_id
            if rid not in routes:
                routes[rid] = {
                    "route_id": rid,
                    "route_name": a.route.name if a.route_id else "",
                    "fee_amount": str(getattr(a.route, "term_amount", "") or ""),
                    "learners": [],
                }
            st = a.student
            routes[rid]["learners"].append(
                {
                    "assignment_id": a.id,
                    "student_id": st.id if st else None,
                    "admission_number": getattr(st, "admission_number", "") if st else "",
                    "name": f"{getattr(st, 'first_name', '')} {getattr(st, 'last_name', '')}".strip() if st else "",
                    "class_name": (
                        st.current_class.name
                        if st and getattr(st, "current_class_id", None)
                        else ""
                    ),
                    "guardian_phone": getattr(st, "emergency_phone", "") or "",
                }
            )
        data = list(routes.values())
        return Response({"routes": data, "total_learners": sum(len(r["learners"]) for r in data)})
