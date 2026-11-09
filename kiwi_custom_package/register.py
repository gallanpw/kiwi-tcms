"""Registration without email verification.

Upstream creates new users with is_active=False and activates them only after
the emailed confirmation link is clicked. Deployments without SMTP can never
activate anyone. This view activates the user right after sign-up instead.
"""
from django.contrib import messages
from django.http import HttpResponseRedirect
from django.utils.translation import gettext_lazy as _

from tcms.kiwi_auth.models import UserActivationKey
from tcms.kiwi_auth.views import Register
from tcms.signals import USER_REGISTERED_SIGNAL


class AutoActivateRegister(Register):
    def post(self, request):
        form = self.form_class(data=request.POST, files=request.FILES)
        if not form.is_valid():
            return super().post(request)  # re-render with errors

        new_user = form.save()
        new_user.is_active = True
        new_user.save(update_fields=["is_active"])
        UserActivationKey.objects.filter(user=new_user).delete()
        USER_REGISTERED_SIGNAL.send(
            sender=form.__class__, request=request, user=new_user
        )
        messages.add_message(
            request,
            messages.SUCCESS,
            _("Your account has been created, you can now log in"),
        )
        return HttpResponseRedirect(self.success_url)
