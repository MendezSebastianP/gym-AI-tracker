"""
Tests for the sync endpoint:
  POST /api/sync
"""
import pytest
from tests.conftest import register_and_login

class TestSync:
    def test_sync_events_unauthenticated(self, client):
        r = client.post("/api/sync", json=[])
        assert r.status_code == 401
    
    def test_sync_events_empty(self, client):
        headers = register_and_login(client)
        r = client.post("/api/sync", json=[], headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "synced"
        assert data["processed"] == 0
        
    def test_sync_events_payload(self, client):
        headers = register_and_login(client)
        payload = [
            {
                "event_type": "create_session",
                "entity_id": 1,
                "payload": {"id": 1, "started_at": "2024-01-01T10:00:00Z"},
                "client_timestamp": "2024-01-01T10:00:00Z"
            }
        ]
        r = client.post("/api/sync", json=payload, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "synced"
        assert data["processed"] == 1

    def test_sync_unknown_event_type_no_crash(self, client):
        """Unknown event types should be acknowledged gracefully, not return 500."""
        headers = register_and_login(client)
        payload = [
            {
                "event_type": "totally_unknown_event",
                "entity_id": 42,
                "payload": {"foo": "bar"},
                "client_timestamp": "2024-01-01T10:00:00Z"
            }
        ]
        r = client.post("/api/sync", json=payload, headers=headers)
        assert r.status_code == 200
        assert r.json()["processed"] == 1

    def test_sync_max_events_limit(self, client):
        """Payloads with > 200 events are rejected."""
        headers = register_and_login(client)
        event = {
            "event_type": "create_session",
            "entity_id": 1,
            "payload": {},
            "client_timestamp": "2024-01-01T10:00:00Z"
        }
        r = client.post("/api/sync", json=[event] * 201, headers=headers)
        assert r.status_code == 422
