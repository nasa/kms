locust -f loadtest/locust/locustfile_mixed_endpoints.py --headless -u 30 -r 0.2 --print-stats --csv=results --host http://localhost:3013
