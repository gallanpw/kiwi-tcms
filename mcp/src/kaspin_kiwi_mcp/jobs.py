"""Background import jobs, so a 500-case import never hits the MCP client's tool timeout.

In memory only: a service restart loses running jobs. Imports are idempotent, so re-running
the same import just skips what already exists.
"""
import secrets
import threading
import time

JOB_TTL = 3600
_jobs = {}
_lock = threading.Lock()


class JobError(RuntimeError):
    pass


def _purge():
    cutoff = time.time() - JOB_TTL
    for job_id in [j for j, v in _jobs.items() if v["finished"] and v["finished"] < cutoff]:
        del _jobs[job_id]


def start(owner, report, work):
    """Run work() in a thread. ``report`` is the live progress dict that work() fills."""
    job_id = secrets.token_hex(4)
    job = {"id": job_id, "owner": owner, "state": "running", "report": report, "error": None, "finished": None}

    def run():
        try:
            work()
            job["state"] = "done"
        except Exception as exc:  # pylint: disable=broad-except
            job["state"], job["error"] = "failed", str(exc)
        finally:
            job["finished"] = time.time()

    with _lock:
        _purge()
        _jobs[job_id] = job
    threading.Thread(target=run, daemon=True, name=f"import-{job_id}").start()
    return job_id


def get(job_id, owner):
    job = _jobs.get(job_id)
    if not job or job["owner"] != owner:  # same message for both: do not reveal other users' jobs
        raise JobError(f"No import job {job_id} for this user (finished jobs expire after 1 hour)")
    return job
