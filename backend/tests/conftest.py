import os
import tempfile

# Point at a throwaway DB before importing the app
os.environ["SCAMSHIELD_DB"] = os.path.join(tempfile.mkdtemp(prefix="scamshield_test_"), "test.db")

import pytest
from fastapi.testclient import TestClient

from app.db import init_db
from app.main import app


@pytest.fixture(scope="session")
def client():
    init_db()
    with TestClient(app) as c:
        yield c
