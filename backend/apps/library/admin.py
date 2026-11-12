from django.contrib import admin
from . import models

for m in [
    models.Book, models.BookCopy, models.Borrowing, models.Acquisition,
    models.Reservation, models.DigitalResource, models.LibrarySettings,
]:
    try:
        admin.site.register(m)
    except admin.sites.AlreadyRegistered:
        pass
