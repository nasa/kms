import os
import random
from pathlib import Path
from urllib.parse import quote

from locust import HttpUser, between, task

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"


def read_lines(file_name):
    path = DATA_DIR / file_name
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as file:
        return [line.strip() for line in file if line.strip()]


def encode_path_pattern(value):
    # Preserve '/' characters for API Gateway path parameter routing.
    return quote(value, safe="").replace("%2F", "%252F")


class KMSConceptsOnly(HttpUser):
    # Default target for local SAM API; can be overridden by --host.
    host = "http://localhost:3013"
    wait_time = between(0.05, 0.3)

    pref_labels = read_lines("prefLabels.txt")
    schemes = read_lines("schemes.txt")
    base_path = (os.getenv("KMS_BASE_PATH") or "").strip()

    @classmethod
    def path(cls, suffix):
        base = cls.base_path
        if base and not base.startswith("/"):
            base = f"/{base}"
        if base.endswith("/"):
            base = base[:-1]
        if not suffix.startswith("/"):
            suffix = f"/{suffix}"

        return f"{base}{suffix}"

    @task(10)
    def get_concepts_default(self):
        self.client.get(self.path("/concepts"), name="/concepts")

    @task(8)
    def get_concepts_pattern(self):
        if not self.pref_labels:
            return
        pattern = encode_path_pattern(random.choice(self.pref_labels))
        self.client.get(
            self.path(f"/concepts/pattern/{pattern}"),
            name="/concepts/pattern/{pattern}",
        )

    @task(7)
    def get_concepts_scheme(self):
        if not self.schemes:
            return
        scheme = quote(random.choice(self.schemes), safe="")
        self.client.get(
            self.path(f"/concepts/concept_scheme/{scheme}"),
            name="/concepts/concept_scheme/{conceptScheme}",
        )

    @task(5)
    def get_concepts_scheme_csv(self):
        if not self.schemes:
            return
        scheme = quote(random.choice(self.schemes), safe="")
        self.client.get(
            self.path(f"/concepts/concept_scheme/{scheme}?format=csv"),
            name="/concepts/concept_scheme/{conceptScheme}?format=csv",
        )

    @task(3)
    def get_concepts_root(self):
        self.client.get(self.path("/concepts/root"), name="/concepts/root")

