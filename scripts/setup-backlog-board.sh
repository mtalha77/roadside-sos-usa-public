#!/usr/bin/env bash
# Creates the "RSOS Backlog" GitHub Project with Backlog, In progress, In review and Done columns,
# adds every RSOS issue and sets closed ones to Done. Needs: gh auth refresh -s project
set -euo pipefail
owner="${1:-mtalha77}"; repo="${2:-mtalha77/roadside-sos-usa-public}"
num=$(gh project list --owner "$owner" --format json --jq '.projects[] | select(.title=="RSOS Backlog") | .number' | head -1)
if [ -z "$num" ]; then num=$(gh project create --owner "$owner" --title "RSOS Backlog" --format json --jq .number); fi
pid=$(gh project view "$num" --owner "$owner" --format json --jq .id)
gh project link "$num" --owner "$owner" --repo "$repo" >/dev/null 2>&1 || true
# Status field with the four columns.
field=$(gh project field-list "$num" --owner "$owner" --format json --jq '.fields[] | select(.name=="Status") | .id')
gh api graphql -f query='mutation($f:ID!){updateProjectV2Field(input:{fieldId:$f,singleSelectOptions:[{name:"Backlog",color:GRAY,description:""},{name:"In progress",color:YELLOW,description:""},{name:"In review",color:BLUE,description:""},{name:"Done",color:GREEN,description:""}]}){projectV2Field{... on ProjectV2SingleSelectField{id}}}}' -f f="$field" >/dev/null
opts=$(gh project field-list "$num" --owner "$owner" --format json --jq '.fields[] | select(.name=="Status") | .options')
backlog=$(jq -r '.[] | select(.name=="Backlog") | .id' <<<"$opts"); done_id=$(jq -r '.[] | select(.name=="Done") | .id' <<<"$opts")
gh issue list -R "$repo" --state all --limit 500 --search "RSOS- in:title" --json url,state | jq -c '.[]' | while read -r issue; do
  url=$(jq -r .url <<<"$issue"); state=$(jq -r .state <<<"$issue")
  item=$(gh project item-add "$num" --owner "$owner" --url "$url" --format json --jq .id)
  opt=$backlog; [ "$state" = CLOSED ] && opt=$done_id
  gh project item-edit --id "$item" --project-id "$pid" --field-id "$field" --single-select-option-id "$opt" >/dev/null
done
echo "RSOS Backlog ready: https://github.com/users/$owner/projects/$num"
