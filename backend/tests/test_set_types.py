from datetime import datetime, timezone, timedelta

from tests.conftest import register_and_login


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _create_exercise(client, headers, name: str = "Bench Press") -> int:
    r = client.post(
        "/api/exercises",
        json={
            "name": name,
            "muscle": "Chest",
            "equipment": "Barbell",
            "type": "Strength",
        },
        headers=headers,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _create_session(client, headers, started_at: datetime) -> int:
    r = client.post(
        "/api/sessions",
        json={"started_at": _iso(started_at)},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _complete_bulk(client, headers, session_id: int, completed_at: datetime, sets: list[dict]):
    r = client.post(
        f"/api/sessions/{session_id}/complete_bulk",
        json={
            "completed_at": _iso(completed_at),
            "sets": sets,
        },
        headers=headers,
    )
    assert r.status_code == 200, r.text
    return r.json()


class TestSetTypesAndFailure:
    def test_complete_bulk_persists_set_type_and_failure(self, client):
        headers = register_and_login(client, "settypes@example.com")
        exercise_id = _create_exercise(client, headers)

        started = _now() - timedelta(hours=1)
        completed = started + timedelta(hours=1)
        session_id = _create_session(client, headers, started)

        data = _complete_bulk(
            client,
            headers,
            session_id,
            completed,
            [
                {
                    "exercise_id": exercise_id,
                    "set_number": 1,
                    "weight_kg": 30,
                    "reps": 12,
                    "set_type": "warmup",
                    "to_failure": False,
                    "completed_at": _iso(completed),
                },
                {
                    "exercise_id": exercise_id,
                    "set_number": 2,
                    "weight_kg": 60,
                    "reps": 10,
                    "set_type": "normal",
                    "to_failure": False,
                    "completed_at": _iso(completed),
                },
                {
                    "exercise_id": exercise_id,
                    "set_number": 3,
                    "weight_kg": 45,
                    "reps": 12,
                    "set_type": "drop",
                    "to_failure": True,
                    "completed_at": _iso(completed),
                },
            ],
        )

        response_sets = sorted(data["sets"], key=lambda s: s["set_number"])
        assert [s["set_type"] for s in response_sets] == ["warmup", "normal", "drop"]
        assert response_sets[2]["to_failure"] is True

    def test_non_normal_sets_excluded_from_pr_and_volume(self, client):
        headers = register_and_login(client, "settypespr@example.com")
        exercise_id = _create_exercise(client, headers, "Incline Press")

        # Baseline session
        s1_started = _now() - timedelta(days=1, hours=1)
        s1_completed = s1_started + timedelta(hours=1)
        s1_id = _create_session(client, headers, s1_started)
        _complete_bulk(
            client,
            headers,
            s1_id,
            s1_completed,
            [
                {
                    "exercise_id": exercise_id,
                    "set_number": 1,
                    "weight_kg": 50,
                    "reps": 10,
                    "set_type": "normal",
                    "to_failure": False,
                    "completed_at": _iso(s1_completed),
                }
            ],
        )

        # Second session: huge warmup/drop values should NOT trigger PRs
        s2_started = _now() - timedelta(hours=1)
        s2_completed = s2_started + timedelta(hours=1)
        s2_id = _create_session(client, headers, s2_started)
        result = _complete_bulk(
            client,
            headers,
            s2_id,
            s2_completed,
            [
                {
                    "exercise_id": exercise_id,
                    "set_number": 1,
                    "weight_kg": 90,
                    "reps": 20,
                    "set_type": "warmup",
                    "to_failure": False,
                    "completed_at": _iso(s2_completed),
                },
                {
                    "exercise_id": exercise_id,
                    "set_number": 2,
                    "weight_kg": 50,
                    "reps": 10,
                    "set_type": "normal",
                    "to_failure": False,
                    "completed_at": _iso(s2_completed),
                },
                {
                    "exercise_id": exercise_id,
                    "set_number": 3,
                    "weight_kg": 120,
                    "reps": 15,
                    "set_type": "drop",
                    "to_failure": True,
                    "completed_at": _iso(s2_completed),
                },
            ],
        )

        gam = result["gamification"]
        assert gam["rep_prs"] == 0
        assert gam["weight_prs"] == 0

        # Volume should include only normal sets:
        # session1: 50*10 = 500
        # session2: normal 50*10 = 500
        # total = 1000
        stats = client.get("/api/stats/weekly", headers=headers)
        assert stats.status_code == 200
        assert stats.json()["volume"] == 1000

    def test_drop_sets_do_not_change_progress_series(self, client):
        headers = register_and_login(client, "settypesprogress@example.com")
        exercise_id = _create_exercise(client, headers, "Flat Bench")

        # Session 1: baseline normal set
        s1_started = _now() - timedelta(days=1, hours=1)
        s1_completed = s1_started + timedelta(hours=1)
        s1_id = _create_session(client, headers, s1_started)
        _complete_bulk(
            client,
            headers,
            s1_id,
            s1_completed,
            [
                {
                    "exercise_id": exercise_id,
                    "set_number": 1,
                    "weight_kg": 100,
                    "reps": 10,
                    "set_type": "normal",
                    "completed_at": _iso(s1_completed),
                }
            ],
        )

        # Session 2: same normal work + huge drop set (should not affect progress)
        s2_started = _now() - timedelta(hours=1)
        s2_completed = s2_started + timedelta(hours=1)
        s2_id = _create_session(client, headers, s2_started)
        _complete_bulk(
            client,
            headers,
            s2_id,
            s2_completed,
            [
                {
                    "exercise_id": exercise_id,
                    "set_number": 1,
                    "weight_kg": 100,
                    "reps": 10,
                    "set_type": "normal",
                    "completed_at": _iso(s2_completed),
                },
                {
                    "exercise_id": exercise_id,
                    "set_number": 2,
                    "weight_kg": 160,
                    "reps": 20,
                    "set_type": "drop",
                    "completed_at": _iso(s2_completed),
                },
            ],
        )

        progress = client.get(f"/api/stats/progress?exercise_id={exercise_id}", headers=headers)
        assert progress.status_code == 200
        points = progress.json()
        assert len(points) == 2
        assert points[0]["nss"] == points[1]["nss"]
