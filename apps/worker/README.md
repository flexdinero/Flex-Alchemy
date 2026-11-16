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

Run the container on a dedicated worker host without host directory mounts, a Docker socket mount, or application secrets. Treat test output as repository-controlled data. This image is operator-run. Hosted dispatch, durable run history, and release promotion require separate integration.
