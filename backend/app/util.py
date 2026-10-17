"""Small helpers shared across routers."""


def split_csv(value: str | None) -> list[str]:
    """'Zomato, Swiggy' -> ['Zomato', 'Swiggy']; empty/None -> []."""
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]


def join_csv(values: list[str] | None) -> str:
    """['Zomato', 'Swiggy'] -> 'Zomato,Swiggy', de-duplicated, order kept."""
    seen: list[str] = []
    for v in values or []:
        v = v.strip()
        if v and v not in seen:
            seen.append(v)
    return ",".join(seen)
