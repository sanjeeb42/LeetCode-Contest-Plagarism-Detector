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
        "random-uuid": "dummy-uuid-1234",
        "x-csrftoken": "fake_csrf_token_1234567890abcdef",
        "cookie": "csrftoken=fake_csrf_token_1234567890abcdef;"
    }
    
    try:
        response = requests.post(url, headers=headers, json=body, impersonate="chrome", timeout=5)
        return response.text
    except Exception as e:
        print(e)
        return None

print(fetch_events("weekly-contest-500", "maximize-fixed-points-after-deletions", "swaran21"))
