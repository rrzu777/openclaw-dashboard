#!/bin/bash
curl -sS -X POST -H 'Content-Type: application/json' -d '{"action":"check"}' http://127.0.0.1:3000/api/recovery >/dev/null 2>&1
