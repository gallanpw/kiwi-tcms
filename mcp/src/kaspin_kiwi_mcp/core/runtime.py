import anyio

from . import config
from .kiwi import KiwiClient


async def _thread(fn, *args):
    return await anyio.to_thread.run_sync(lambda: fn(*args))


async def _login(creds):
    user, password = creds.kiwi
    return await _thread(lambda: KiwiClient(config.kiwi_url(), user, password).login())
