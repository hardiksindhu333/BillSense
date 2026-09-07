import json
from bson import ObjectId

MAX_LIMIT = 100

BLOCKED_OPERATORS = {
    "$where", "$function", "$accumulator",
    "$out", "$merge", "$lookup"
}

def to_object_id(user_id: str):
    try:
        return ObjectId(user_id)
    except Exception:
        return user_id


def validate_pipeline(pipeline: list, user_id: str) -> tuple:
    if not pipeline or not isinstance(pipeline, list):
        return False, "Pipeline must be a non-empty list"

    pipeline_str = str(pipeline)  # str() handles ObjectId natively

    # Block dangerous operators
    for op in BLOCKED_OPERATORS:
        if op in pipeline_str:
            return False, f"Blocked operator detected: {op}"

    # Block JavaScript
    if "function(" in pipeline_str or "this." in pipeline_str:
        return False, "JavaScript execution not allowed in pipelines"

    # Enforce userId in first $match stage
    first_stage = pipeline[0]
    if "$match" not in first_stage:
        return False, "First pipeline stage must be $match"

    match_user = first_stage["$match"].get("userId")
    if str(match_user) != str(to_object_id(user_id)):
        return False, f"userId filter missing or mismatched"

    # Enforce $limit cap
    for stage in pipeline:
        if "$limit" in stage:
            if stage["$limit"] > MAX_LIMIT:
                return False, f"Limit {stage['$limit']} exceeds max allowed ({MAX_LIMIT})"

    return True, "valid"
