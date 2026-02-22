locust -f loadtest/locust/locustfile_mixed_endpoints.py --headless -u 5 -r 1 -t 15m --print-stats --csv=results --host http://localhost:3013
