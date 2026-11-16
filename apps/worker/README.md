# Isolated Node test worker

Build the worker on the runner host using `docker build -f apps/worker/Dockerfile -t flex-alchemy-node-worker .`.

From a Linux runner shell, pass a saved tar.gz on standard input and its recorded commit as the sole argument:

```sh
docker run --rm -i --network none --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=96m,mode=1777 \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 256m --pids-limit 64 --cpus 1 \
  flex-alchemy-node-worker "$COMMIT" < "$ARCHIVE"
```

The worker verifies the archive commit and bounds, materializes regular files under a single temporary source root, and runs the built-in Node test runner without installing dependencies. Source links and special entries are rejected. The runner uses a fixed command, stops the test process group after 45 seconds, and captures up to 128 KiB of combined output. Its JSON reports the commit, archive SHA-256, command exit status, and captured output.

Run the container on a dedicated worker host without host directory mounts, a Docker socket mount, or application secrets. Treat test output as repository-controlled data.

After migration 036, start `node apps/worker/dispatch-node-tests.mjs` on the worker host to poll PostgreSQL and run queued archives. A persistent worker process can be supervised by the host service manager. For one poll, pass `--once`.

- Set `ALCHEMY_RUNNER_DATABASE_URL` to the TLS PostgreSQL URL for a dedicated login allowed to assume only `alchemy_run_client`.
- Set `ALCHEMY_NODE_WORKER_IMAGE` to the local image ID in `sha256:…` form. Obtain it with `docker image inspect flex-alchemy-node-worker --format '{{.Id}}'`.
- Set `ALCHEMY_NODE_RUNS_ENABLED=1` on the hosted app after the worker has been started. Use **Repository archive → Node test runs** to queue tests and inspect their durable results.

The dispatcher verifies the archive digest before handing source to Docker, passes no database credentials into the test container, and records the result only while it owns the lease. An expired lease is recorded as a failed run on the next worker poll. An owner or editor can request a new run. Release promotion is a separate workflow.
