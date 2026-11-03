def pop_project_id(query):
    """Remove the project scope parameter from an RPC model lookup."""
    scoped_query = dict(query or {})
    project_id = scoped_query.pop("project_id", None)
    if project_id is not None:
        try:
            project_id = int(project_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("project_id must be an integer") from exc
    return scoped_query, project_id
