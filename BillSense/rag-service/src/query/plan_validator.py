ALLOWED_METRICS      = {"amountDue", "taxAmount", "subtotal"}
ALLOWED_AGGREGATIONS = {"sum", "avg", "count", "min", "max"}
ALLOWED_GROUP_BY     = {"customerName", "vendorName", "currency",
                        "status", "invoiceDate", "dueDate", None, "null"}
ALLOWED_FILTERS      = {"status", "currency", "vendorName", "customerName"}
ALLOWED_STATUS       = {"draft", "pending", "approved", "paid", "overdue", "cancelled", None, "null"}



def validate_plan(plan: dict) -> tuple:
    metric = plan.get("metric")
    if metric not in ALLOWED_METRICS:
        return False, f"Blocked metric: '{metric}'. Allowed: {ALLOWED_METRICS}"

    aggregation = plan.get("aggregation")
    if aggregation not in ALLOWED_AGGREGATIONS:
        return False, f"Blocked aggregation: '{aggregation}'. Allowed: {ALLOWED_AGGREGATIONS}"

    group_by = plan.get("groupBy")
    if group_by not in ALLOWED_GROUP_BY:
        return False, f"Blocked groupBy: '{group_by}'. Allowed: {ALLOWED_GROUP_BY}"

    filters = plan.get("filters", {})
    for key in filters:
        if key not in ALLOWED_FILTERS:
            return False, f"Blocked filter field: '{key}'. Allowed: {ALLOWED_FILTERS}"

    status_val = filters.get("status")
    if status_val not in ALLOWED_STATUS:
        return False, f"Invalid status value: '{status_val}'. Allowed: {ALLOWED_STATUS}"

    limit = plan.get("limit", 10)
    if not isinstance(limit, int) or limit < 1:
        return False, f"Invalid limit: {limit}"

    return True, "valid"
