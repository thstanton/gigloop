# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

How the `/wayfinder` skill's concepts map onto GitHub in this repo. Both the parent/child
and the blocking relationships use GitHub's **native** features, so the frontier renders in
GitHub's own UI — the human can see what's takeable without opening the map.

| Wayfinder concept | GitHub expression |
| --- | --- |
| Map | An issue labelled `wayfinder:map` |
| Ticket | An issue labelled `wayfinder:research` / `:prototype` / `:grilling` / `:task` |
| Ticket belongs to map | A native **sub-issue** of the map |
| Ticket blocked by ticket | A native **issue dependency** (`blocked_by`) |
| Claim | Assign the issue to the dev driving the map |
| Resolution | A comment on the ticket, then close it |

### Creating the parent/child link

Sub-issues are GraphQL-only. Fetch the node ids first, then attach:

```bash
gh api repos/<owner>/<repo>/issues/<n> --jq '.node_id + " " + (.id|tostring)'

gh api graphql -f query='mutation($p:ID!,$c:ID!){
  addSubIssue(input:{issueId:$p, subIssueId:$c}){ subIssue{ number } } }' \
  -f p=<map-node-id> -f c=<ticket-node-id>
```

### Creating a blocking edge

Dependencies are REST, and take the blocker's **numeric database id** (not its issue number):

```bash
gh api --method POST repos/<owner>/<repo>/issues/<blocked>/dependencies/blocked_by \
  -F issue_id=<blocker-database-id>
```

Wire edges in a **second pass**, after all tickets exist — issues need ids before they can
reference each other. Prefer the minimal edge set; transitive chains resolve correctly and
redundant edges only clutter the UI.

### Querying the frontier

The frontier is the open, unblocked, unclaimed children of a map:

```bash
for n in $(gh issue list --state open --label "wayfinder:grilling" --label "wayfinder:research" \
             --label "wayfinder:prototype" --label "wayfinder:task" --json number --jq '.[].number'); do
  blockers=$(gh api repos/<owner>/<repo>/issues/$n/dependencies/blocked_by \
               --jq '[.[] | select(.state=="open")] | length')
  claimed=$(gh api repos/<owner>/<repo>/issues/$n --jq '.assignees | length')
  [ "$blockers" = "0" ] && [ "$claimed" = "0" ] && gh issue view $n --json number,title --jq '"#\(.number) \(.title)"'
done
```

The map's sub-issue list in the GitHub UI shows the same thing at a glance, with blocked
tickets marked — use the loop only when a session needs the frontier programmatically.
