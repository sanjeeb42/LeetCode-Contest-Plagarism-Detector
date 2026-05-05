import json
from curl_cffi import requests

def fetch_events(contest_slug, title_slug, username):
    url = "https://leetcode.com/graphql/"
    query = """
    query UserContestReplayEvents($contestSlug: String!, $questionSlug: String!, $username: String) {
      userContestReplayEvents(
        contestSlug: $contestSlug
        questionSlug: $questionSlug
        username: $username
      ) {
        eventType
        eventData
      }
    }
    """
    body = {"query": query, "variables": {"contestSlug": contest_slug, "questionSlug": title_slug, "username": username}, "operationName": "UserContestReplayEvents"}
    response = requests.post(url, headers={"Content-Type": "application/json"}, json=body, impersonate="chrome", timeout=5)
    return response.json()

res = fetch_events("weekly-contest-500", "maximize-fixed-points-after-deletions", "Praveen613")
events = res['data']['userContestReplayEvents']
types = set()
for e in events:
    types.add(e['eventType'])
    if e['eventType'] == "10":
        print("Type 10 example:", e['eventData'][:200])

print("Event Types:", types)
for e in events:
    if e['eventType'] == "7":
        print("Type 7 example:", e['eventData'][:200])
        break
