# Keyword retrieval smoke test

Searched the source index with case-insensitive fixed phrases using `rg -i -F`. Only rows with a source ID counted. The phrases were selected for this index and are visible to its author.

| Query | Expected | Observed |
|---|---|---|
| user needs | K19 | K19 |
| causal dependencies | K20 | K20 |
| HTTP operations | K21 | K21 |
| customer outcome | K22 | K22 |
| artifact bytes | K23 | K23 |
| interview consent | No row | No row |
| standalone ruling | No row | No row |

All seven expectations matched. A miss here describes the source index search only. The founder ruling exists in project documents and requires a separate search of project authority records. The two misses identify practical cases for the next retrieval test: recognize alternate phrasing and route project decisions to the proper collection.

This run establishes phrase lookup on the 23-entry link index. Relevance ranking, paraphrase recall, source authority, rights and task outcomes require separate checks.
