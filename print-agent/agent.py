import json
import os
import shutil
import sys
import time
import threading
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional, Dict, Any

from config import (
    SERVER_URL,
    AGENT_KEY,
    PRINTER_NAME,
    POLL_SECONDS,
    HEARTBEAT_SECONDS,
    WORK_DIR,
    STATE_DIR,
    PRINT_DRY_RUN,
)
from preprocessor import prepare_document
from spooler import dispatch_print


def get_auth_headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {AGENT_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "QRLY-PrintAgent/1.0",
    }


def send_heartbeat():
    """Sends periodic telemetry heartbeat to server."""
    url = f"{SERVER_URL}/api/agent/heartbeat"
    payload = json.dumps({
        "systemName": PRINTER_NAME,
        "status": "online",
        "statusDetail": "Ready to print" if not PRINT_DRY_RUN else "Dry-run mode active",
        "supportsColor": True,
        "supportsDuplex": True,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers=get_auth_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                pass
    except Exception as e:
        print(f"[Agent] Heartbeat error: {e}")


def heartbeat_worker():
    """Background thread running heartbeat every HEARTBEAT_SECONDS."""
    while True:
        send_heartbeat()
        time.sleep(HEARTBEAT_SECONDS)


def claim_job() -> Optional[Dict[str, Any]]:
    """Polls server for the next eligible job via atomic claim."""
    url = f"{SERVER_URL}/api/agent/claim"
    req = urllib.request.Request(url, data=b"{}", headers=get_auth_headers(), method="POST")

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            if response.status == 204:
                return None
            if response.status == 200:
                body = response.read().decode("utf-8")
                data = json.loads(body)
                return data.get("job")
    except urllib.error.HTTPError as e:
        if e.code == 204:
            return None
        print(f"[Agent] Claim HTTP error {e.code}: {e.reason}")
    except Exception as e:
        print(f"[Agent] Poll error connecting to {SERVER_URL}: {e}")

    return None


def update_job_status(
    job_id: str,
    status: str,
    local_file_deleted: bool = False,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
):
    """Reports execution status back to server."""
    url = f"{SERVER_URL}/api/agent/jobs/{job_id}/status"
    payload = json.dumps({
        "status": status,
        "localFileDeleted": local_file_deleted,
        "errorCode": error_code,
        "errorMessage": error_message,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers=get_auth_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status == 200
    except Exception as e:
        print(f"[Agent] Failed to report status '{status}' for job {job_id}: {e}")
        return False


def download_file(download_url: str, dest_path: Path):
    """Downloads print file from signed URL into local work directory."""
    full_url = download_url
    if download_url.startswith("/"):
        full_url = f"{SERVER_URL}{download_url}"

    req = urllib.request.Request(
        full_url,
        headers={"User-Agent": "QRLY-PrintAgent/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as response, open(dest_path, "wb") as out_file:
        shutil.copyfileobj(response, out_file)


def process_job(job: Dict[str, Any]):
    """Executes the complete printing lifecycle for a single claimed job."""
    job_id = job["id"]
    order_id = job.get("orderId", "unknown")
    token_label = job.get("tokenLabel", "A-???")
    options = job.get("options", {})
    download_url = job.get("downloadUrl")

    print(f"\n[Agent] Claimed Job: {job_id} | Order: {order_id} | Token: {token_label}")

    # Step 1: Report status 'printing'
    update_job_status(job_id, "printing")

    original_file = WORK_DIR / f"original-{job_id}.pdf"
    marker_file = STATE_DIR / f"printed-{job_id}"
    temp_files = [original_file]
    job_failed = False

    try:
        # Step 2: Download file
        print(f"[Agent] Downloading document for job {job_id}...")
        download_file(download_url, original_file)

        # Step 3: Check No-Double-Print Idempotency Marker
        if marker_file.exists():
            print(f"[Agent] Marker {marker_file.name} already exists. Skipping reprint (idempotent).")
            update_job_status(job_id, "done", local_file_deleted=True)
            return

        # Step 4: Pre-process file (Page Range slicing & DeviceGray conversion)
        color_mode = options.get("colorMode", "bw")
        page_range = options.get("pageRange")

        print(f"[Agent] Preparing document (colorMode: {color_mode}, range: {page_range})...")
        prepared_pdf = prepare_document(
            input_pdf=original_file,
            work_dir=WORK_DIR,
            job_id=job_id,
            color_mode=color_mode,
            page_range=page_range,
        )
        temp_files.append(prepared_pdf)

        # Step 5: Write idempotency marker immediately before spooling
        marker_file.write_text(f"printed at {time.time()}\n", encoding="utf-8")

        # Step 6: Dispatch to spooler (or dry-run output)
        success, error_msg = dispatch_print(prepared_pdf, job_id, options)

        if not success:
            job_failed = True
            print(f"[Agent] Spooler failure: {error_msg}")
            update_job_status(job_id, "failed", error_code="SPOOLER_ERROR", error_message=error_msg)
            return

        print(f"[Agent] Print successfully dispatched for Token {token_label}!")

    except Exception as e:
        job_failed = True
        print(f"[Agent] Unexpected error processing job {job_id}: {e}")
        update_job_status(job_id, "failed", error_code="PROCESSING_ERROR", error_message=str(e))

    finally:
        # Step 7: Deletion Promise - Delete all temporary local files
        deleted_count = 0
        for tmp in temp_files:
            try:
                if tmp.exists():
                    tmp.unlink()
                    deleted_count += 1
            except Exception as del_err:
                print(f"[Agent] Warning: Failed to unlink {tmp}: {del_err}")

        # Final status report with localFileDeleted = True only if successful
        if not job_failed:
            update_job_status(job_id, "done", local_file_deleted=True)
            print(f"[Agent] Job {job_id} finalized as done. Purged {deleted_count} local temp files.")
        else:
            print(f"[Agent] Job {job_id} finalized as failed. Purged {deleted_count} local temp files.")


def main():
    print("=" * 60)
    print(" QRLY Print Agent Daemon")
    print(f" Target Server : {SERVER_URL}")
    print(f" Printer Name  : {PRINTER_NAME}")
    print(f" Dry Run Mode  : {PRINT_DRY_RUN} (Output -> ./out/)")
    print("=" * 60)

    # Start background heartbeat worker
    hb_thread = threading.Thread(target=heartbeat_worker, daemon=True)
    hb_thread.start()

    print(f"[Agent] Heartbeat active (every {HEARTBEAT_SECONDS}s). Polling for jobs every {POLL_SECONDS}s...")

    try:
        while True:
            job = claim_job()
            if job:
                process_job(job)
            else:
                time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        print("\n[Agent] Shutting down agent daemon gracefully.")
        sys.exit(0)


if __name__ == "__main__":
    main()

