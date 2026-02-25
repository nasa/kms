# Local Script Usage

## Invoke prime concepts cache cron target

Runs the same Lambda used by the hourly EventBridge schedule, locally via SAM.
The script re-synthesizes `cdk/cdk.out/KmsStack.template.json` each run so local Redis env settings are baked into the template.

```bash
npm run prime-cache:invoke-local
```

Optional overrides:

```bash
TEMPLATE_FILE=/path/to/KmsStack.template.json \
EVENT_FILE=/path/to/event.json \
REDIS_ENABLED=true \
REDIS_HOST=kms-redis-local \
REDIS_PORT=6379 \
npm run prime-cache:invoke-local
```

Defaults:
- `TEMPLATE_FILE=cdk/cdk.out/KmsStack.template.json`
- `EVENT_FILE=/tmp/prime-concepts-cache-event.json`
- `LOG_FILE=/tmp/prime-concepts-cache.log`

If the invoke appears quiet, watch the log file directly:

```bash
tail -f /tmp/prime-concepts-cache.log
```
