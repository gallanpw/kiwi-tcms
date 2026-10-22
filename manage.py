#!/usr/bin/env python
"""manage.py for the Vercel deployment (settings: kiwi_vercel_settings.py).

Vercel runs this file to find DJANGO_SETTINGS_MODULE. On a laptop it runs
migrations against the Neon database, see 'Deploy ke Vercel + Neon' in README.md.
For local development use run.sh instead.
"""
import os
import pathlib
import sys


def main():
    base = pathlib.Path(__file__).resolve().parent
    sys.path[:0] = [str(base), str(base / "Kiwi")]
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "kiwi_vercel_settings")

    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
