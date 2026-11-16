# Local retrieval pilot

From the clone root, run:

```powershell
node docs/flex-alchemy/knowledge/retrieve.mjs "Can we use CampaignOS as the pilot?"
node --test docs/flex-alchemy/knowledge/retrieve.test.mjs
```

The CLI returns external reference candidates and local project records in separate fields. For the CampaignOS question, A01 identifies the scope decision and P01 identifies the older proposal. Review the cited sections before acting. The command only returns locators and record roles. It does not grant permission or produce an answer.

Eight reference routes cover selected topics in the 23-entry index. The remaining entries can be browsed directly. A no-match response asks the operator to try another phrase or inspect the relevant collection manually.

The first 11 authored cases passed. Five additional probes yielded three matches and two misses before tuning. The missed questions concerned reuse of existing products and cross-customer access. I added both phrases to their corresponding routes and turned all five probes into regression cases. These checks demonstrate deterministic candidate selection and specific repairs. They provide no blind estimate of natural language recall, source quality, or prompt-injection resistance.

The next evidence gate is a set of queries written independently of the routing rules, with expected sources and no-match cases frozen before measurement. Record the first results before tuning and keep them separate from the regression suite.

## Second evaluation and repair

Run `node docs/flex-alchemy/knowledge/evaluate-retrieval.mjs` to score exact candidate sets for [12 questions](evaluation-cases.json). The evaluator prints expected and actual IDs plus file digests. It exits with status 1 on any mismatch.

The same assistant authored these questions and fixed their expected results before running the evaluator. The first run passed 6 of 12. The six misses involved standalone scope, two accessibility phrasings, organization isolation, API response contracts, and reproducible builds. All six were empty results. The original router SHA-256 was `2803b6aa73822d345d5d1a8a07e5b62a44ed80c57fec921f0ff10dda7b35a74b`.

After narrow routing changes, all 12 passed with the same case digest `54813352c752fc4ca6acbf86c6aaa62edf56fd84d29f4742b477d679f7046e76`. The updated router digest was `9ce47196af94a4ec0608e7716c16041d02ede94e30e1b7030d15aa872cb097c0`. All 16 earlier regression cases also passed.

The repaired set now serves as regression coverage. An independently authored holdout remains necessary to estimate performance on unfamiliar language. Exact-set matches measure source selection for these cases. They do not establish answer accuracy or authorization enforcement.
