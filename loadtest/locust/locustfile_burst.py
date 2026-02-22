from locust import HttpUser, TaskSet, task, between, events, constant
import csv
import time
from queue import Queue
import urllib.parse
import logging
import random

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create a CSV file for results
csv_file = open('locust_results.csv', 'w', newline='')
csv_writer = csv.writer(csv_file)
csv_writer.writerow(['Timestamp', 'Request Type', 'Name', 'Response Time', 'Response Length', 'Response Code'])


def encode_path_pattern(value):
    # SAM local/API Gateway can decode %2F before route matching for path params.
    # Double-encode slashes so they survive as literal characters in {pattern}.
    return urllib.parse.quote(value, safe='').replace('%2F', '%252F')

class URLQueue:
    def __init__(self):
        self.queue = Queue()
        self.load_urls()

    def load_urls(self):
        # Load concept URLs
        with open('data/uuids.txt', 'r') as file:
            for uuid in file:
                self.queue.put(f"https://cmr.uat.earthdata.nasa.gov/kms/concept/{uuid.strip()}")

        # Load pattern URLs
        with open('data/prefLabels.txt', 'r') as file:
            for pattern in file:
                pattern = encode_path_pattern(pattern.strip())
                self.queue.put(f"https://cmr.uat.earthdata.nasa.gov/kms/concepts/pattern/{pattern}")

        # Load concept scheme URLs
        with open('data/schemes.txt', 'r') as file:
            for scheme in file:
                self.queue.put(f"https://cmr.uat.earthdata.nasa.gov/kms/concepts/concept_scheme/{scheme.strip()}.csv")

        # Load concept fullpaths URLs
        with open('data/uuids.txt', 'r') as file:
            for uuid in file:
                self.queue.put(f"https://cmr.uat.earthdata.nasa.gov/kms/concept_fullpaths/concept_uuid/{uuid.strip()}")

        # Add KMS concepts URL
        self.queue.put("https://cmr.uat.earthdata.nasa.gov/kms/concepts")

        logger.info(f"Loaded {self.queue.qsize()} URLs")

    def get_url(self):
        if not self.queue.empty():
            return self.queue.get()
        return None

class BurstBehavior(TaskSet):
    def on_start(self):
        self.burst_duration = random.randint(5, 15)  # Burst for 5-15 seconds
        self.quiet_duration = random.randint(20, 60)  # Quiet for 20-60 seconds

    @task
    def burst_requests(self):
        start_time = time.time()
        while time.time() - start_time < self.burst_duration:
            self.make_request()
        
        # After burst, wait for the quiet period
        time.sleep(self.quiet_duration)

    def make_request(self):
        url = self.user.environment.url_queue.get_url()
        if url:
            response = self.client.get(url)
            csv_writer.writerow([time.time(), 'GET', url, response.elapsed.total_seconds() * 1000, len(response.content), response.status_code])
            csv_file.flush()
        else:
            logger.warning("No more URLs to access")
            self.user.environment.runner.quit()

class KMS(HttpUser):
    tasks = [BurstBehavior]
    wait_time = constant(1)  # Minimal wait time between tasks

@events.init.add_listener
def on_locust_init(environment, **kwargs):
    logger.info("Locust initialized")
    environment.url_queue = URLQueue()

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    logger.info("Test is starting")

@events.quitting.add_listener
def on_quitting(environment, **kwargs):
    csv_file.close()
    logger.info("Test is ending, CSV file closed")

if __name__ == "__main__":
    # This block is useful for debugging outside of Locust
    queue = URLQueue()
    print(f"Total URLs loaded: {queue.queue.qsize()}")
