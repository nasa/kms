#!/usr/bin/env bash
set -euo pipefail

VERSION="${VERSION:-5.1.3}"

docker build -t "rdf4j:$VERSION" ./cdk/rdfdb/docker
