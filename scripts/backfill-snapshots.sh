#!/bin/bash
# Take 5 snapshots quickly to seed the trending chart
for i in 1 2 3 4 5; do
  curl -sS -X POST http://127.0.0.1:3000/api/snapshots >/dev/null 2>&1
  sleep 2
done
echo "Seeded 5 snapshots"
