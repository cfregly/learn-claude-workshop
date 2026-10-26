def in_renewal_window(days_remaining: int, window_days: int = 30) -> bool:
    """Select an account within the inclusive renewal window."""
    return 0 <= days_remaining < window_days
