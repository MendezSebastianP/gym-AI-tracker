import time
import signal
import sys
from apscheduler.schedulers.blocking import BlockingScheduler

def weekly_report_job():
    print("Running weekly report generation job...")
    # TODO: Implement report generation logic
    pass

def cleanup(signum, frame):
    print("Stopping scheduler...")
    sys.exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGTERM, cleanup)
    signal.signal(signal.SIGINT, cleanup)

    scheduler = BlockingScheduler()
    # Run every Monday at 00:00
    scheduler.add_job(weekly_report_job, 'cron', day_of_week='mon', hour=0, minute=0)

    print("Scheduler started...")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        pass
