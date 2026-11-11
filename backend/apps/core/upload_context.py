from contextvars import ContextVar


_current_request = ContextVar("school_erp_upload_request", default=None)
_current_owner = ContextVar("school_erp_upload_owner", default=None)


def current_upload_request():
    return _current_request.get()


def current_upload_owner():
    return _current_owner.get()


def upload_owner(owner):
    """Temporarily provide the owning model while a FileField saves its content."""
    class OwnerContext:
        def __enter__(self):
            self.token = _current_owner.set(owner)
            return owner

        def __exit__(self, exc_type, exc_value, traceback):
            _current_owner.reset(self.token)
    return OwnerContext()


def school_upload_context(school):
    class SchoolContext:
        def __enter__(self):
            self.token = _current_owner.set(school)
            return school

        def __exit__(self, exc_type, exc_value, traceback):
            _current_owner.reset(self.token)
    return SchoolContext()


class UploadRequestContextMiddleware:
    """Expose the active request to Django storage without changing field APIs."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = _current_request.set(request)
        try:
            return self.get_response(request)
        finally:
            _current_request.reset(token)
