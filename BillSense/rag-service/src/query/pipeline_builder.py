from bson import ObjectId

MAX_LIMIT = 100

def to_object_id(user_id: str):
    try:
        return ObjectId(user_id)
    except Exception:
        return user_id


def plan_to_pipeline(plan: dict, user_id: str) -> list:
    """Convert validated QueryPlan → MongoDB aggregation pipeline. No Gemini involved."""
    uid = to_object_id(user_id)

    # Always start with user filter
    match_stage = {"$match": {"userId": uid}}

    # Apply additional filters
    filters = plan.get("filters", {})
    for key, val in filters.items():
        if val and val != "null":
            match_stage["$match"][key] = val

    pipeline = [match_stage]

    # Aggregation mapping
    metric = plan.get("metric", "amountDue")
    aggregation = plan.get("aggregation", "sum")

    agg_ops = {
        "sum":   {"$sum": f"${metric}"},
        "avg":   {"$avg": f"${metric}"},
        "count": {"$sum": 1},
        "min":   {"$min": f"${metric}"},
        "max":   {"$max": f"${metric}"}
    }

    group_by = plan.get("groupBy")
    group_id = f"${group_by}" if group_by and group_by != "null" else None

    pipeline.append({
        "$group": {
            "_id": group_id,
            "result": agg_ops[aggregation],
            "count": {"$sum": 1}
        }
    })

    # Sort
    sort_field = plan.get("sortBy", "result")
    sort_order = -1 if plan.get("sortOrder", "desc") == "desc" else 1
    pipeline.append({"$sort": {sort_field: sort_order}})

    # Limit (capped at MAX_LIMIT)
    limit = min(int(plan.get("limit", 10)), MAX_LIMIT)
    pipeline.append({"$limit": limit})

    return pipeline
