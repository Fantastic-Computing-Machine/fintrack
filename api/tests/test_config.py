from fintrack.core.config import Settings


def test_nested_environment_override(monkeypatch):
    monkeypatch.setenv("APP__SESSION_HOURS", "24")
    monkeypatch.setenv("SYNC__FALLBACK_HOURS", "12")
    settings = Settings()
    assert settings.app.session_hours == 24
    assert settings.sync.fallback_hours == 12
