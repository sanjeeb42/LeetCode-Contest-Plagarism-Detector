import json
from curl_cffi import requests

def fetch_events():
    url = "https://leetcode.com/graphql/"
    query = "query UserContestReplayEvents($contestSlug: String!, $questionSlug: String!, $username: String) { userContestReplayEvents(contestSlug: $contestSlug, questionSlug: $questionSlug, username: $username) { eventType eventData } }"
    body = {"query": query, "variables": {"contestSlug": "weekly-contest-500", "questionSlug": "maximize-fixed-points-after-deletions", "username": "Praveen613"}, "operationName": "UserContestReplayEvents"}
    response = requests.post(url, headers={"Content-Type": "application/json"}, json=body, impersonate="chrome", timeout=5)
    return response.json()['data']['userContestReplayEvents']

events = fetch_events()
for e in events:
    if e['eventType'] == "10":
        data = json.loads(e['eventData'])
        changes = data.get("change", {}).get("changes", [])
        if changes:
            print("Change:", changes[0])
            print("---")
