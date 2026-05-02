from collections import OrderedDict
from typing import Optional
from uuid import uuid4

MAX_REPORTS = 100

_reports: OrderedDict[str, dict] = OrderedDict()


def save_report(report: dict) -> dict:
    report_id = uuid4().hex[:12]
    stored_report = {"report_id": report_id, **report}
    _reports[report_id] = stored_report
    _reports.move_to_end(report_id)

    while len(_reports) > MAX_REPORTS:
        _reports.popitem(last=False)

    return stored_report


def get_report(report_id: str) -> Optional[dict]:
    report = _reports.get(report_id)
    if report:
        _reports.move_to_end(report_id)
    return report
