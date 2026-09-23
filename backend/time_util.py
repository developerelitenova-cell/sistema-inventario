from datetime import datetime, timezone, timedelta

COLOMBIA_TZ = timezone(timedelta(hours=-5))

def get_colombia_time():
    return datetime.now(COLOMBIA_TZ).replace(tzinfo=None)
