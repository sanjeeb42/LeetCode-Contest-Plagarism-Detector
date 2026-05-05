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
        timestamp
      }
    }
    """
    body = {
        "query": query,
        "variables": {
            "contestSlug": contest_slug,
            "questionSlug": title_slug,
            "username": username
        },
        "operationName": "UserContestReplayEvents"
    }
    
    headers = {
        "Content-Type": "application/json",
    }
    
    response = requests.post(url, headers=headers, json=body, impersonate="chrome", timeout=5)
    return response.text

print("Praveen613 Q4:")
print(fetch_events("weekly-contest-500", "maximize-fixed-points-after-deletions", "Praveen613")[:500])
