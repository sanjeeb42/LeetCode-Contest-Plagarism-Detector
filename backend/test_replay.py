import json
from curl_cffi import requests

def fetch_events(contest_slug, title_slug, username):
    url = "https://leetcode.com/graphql/"
    query = """
    query UserContestReplayEvents($contestSlug: String!, $titleSlug: String!, $username: String!) {
      userContestReplayEvents(
        contestSlug: $contestSlug
        titleSlug: $titleSlug
        username: $username
      ) {
        eventData
      }
    }
    """
    body = {
        "query": query,
        "variables": {
            "contestSlug": contest_slug,
            "titleSlug": title_slug,
            "username": username
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "random-uuid": "dummy-uuid-1234",
        "x-csrftoken": "dummy_token"
    }
    
    try:
        response = requests.post(url, headers=headers, json=body, impersonate="chrome", timeout=5)
        return response.text
    except Exception as e:
        print(e)
        return None

print(fetch_events("weekly-contest-500", "maximize-fixed-points-after-deletions", "swaran21"))
