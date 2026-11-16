# Flex Alchemy local workspace

Choose **Knowledge navigation** to check the four required links and their targets, or **Source catalog structure** to check required fields, duplicate source IDs and HTTPS reference syntax. The prepared run pins the selected verifier. The catalog check validates the saved file without contacting external sources, assessing source quality or granting reuse rights.

Selecting **Run verification** queues the saved check. You can return to the run and refresh its status while the local server works. A restart resumes queued work and reclaims an interrupted job after its lease expires. A failed check keeps its receipt. If the worker cannot produce a usable receipt, the run shows an error and offers a retry when its inputs can still be validated.

Select **Withdraw verification** while the run is queued to stop it before dispatch. New checks wait at least five seconds before the worker can claim them. If the worker has already claimed the check, the page reports that it is no longer queued. A withdrawn run can be started again through **Queue verification again**.

Start the workspace from the repository root with Node.js and PowerShell 7 available.

```powershell
node apps/local/server.mjs
```

Open http://127.0.0.1:4173 and select Missions. Save a title, goal and acceptance criteria. Open the mission to prepare a linked knowledge check, inspect its source candidates, and run verification. The mission, checkpoint and receipt reopen after a server restart. The verifier checks the knowledge navigation snapshot. The request supplies retrieval context, and mission acceptance remains a separate decision.

Use **Projects** to group missions by purpose. Create a project, open it, then save a mission within it. Existing missions move into **Local project** when the database opens. All projects belong to the same trusted local operator.

Run data defaults to `FlexAlchemy/runs` beneath the local application data directory, or the home directory if that variable is absent. Set `ALCHEMY_LOCAL_STORE` to choose another local directory and `ALCHEMY_LOCAL_PORT` to choose another loopback port. This workspace is for one trusted local operator. Any process with access to that operator's files can modify the stored runs.

Missions and review history use `missions.sqlite` in the run directory. On a mission page, record the evidence and choose Accept mission or Request changes. These are operator decisions. A newer review makes an older open form stale. Reopen the mission to read the latest decision before submitting another.

Use **Edit mission** to save a new title, goal or acceptance criteria. Each saved revision retains the previous text. Reviews stay associated with the criteria they assessed, and a new revision awaits its own review. Mission exports include both revision and review history.

Download the mission JSON from its detail page to hand off the goal, acceptance criteria, review history, source candidates and verification receipts. The workspace records new mission run associations in SQLite before preparation. An interrupted preparation or an invalid, missing, or stale checkpoint is marked unavailable and makes the export partial. Older runs created before this index still need a readable checkpoint to recover their mission association. Project source references use record IDs and digests in place of local paths. Review the request text, review notes and verifier output before sharing.

The verified local runtime was Node 22.20.0, whose built-in SQLite module emits an experimental feature warning. Run `npm test` from the repository root to check the HTTP journey, verification receipts, and knowledge retrieval. The suite requires PowerShell 7 on PATH and uses disposable test data.

The loopback HTTP server provides `GET /healthz` for process liveness and `GET /readyz` for verification queue storage. A queue read failure returns HTTP 503 from readiness while liveness can still return HTTP 200. The restart test exercises both responses with a disposable database. Readiness checks that the queue table can be read. Worker throughput, queue backlog, and external dependencies require separate operational evidence.

The interface exposes intake, source inspection, the bounded verification action, and saved evidence. The full product surface map and remaining hosted dependencies are tracked in the [product journey](../../docs/flex-alchemy/15-product-journey.md).
