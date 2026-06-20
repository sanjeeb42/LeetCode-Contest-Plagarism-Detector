from curl_cffi import requests
import io
import concurrent.futures
import time
import os
import json

LEETCODE_URL = "https://leetcode.com/graphql"
QUERY = """
query userProfile($username: String!) {
  userContestRanking(username: $username) {
    rating
    attendedContestsCount
  }
  matchedUser(username: $username) {
    submitStats {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
}
"""

CACHE_FILE = os.path.join("resources", "ratings_cache.json")
_ratings_cache = None

def load_cache():
    global _ratings_cache
    if _ratings_cache is not None:
        return _ratings_cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                _ratings_cache = json.load(f)
        except Exception as e:
            print(f"Error loading ratings cache: {e}")
            _ratings_cache = {}
    else:
        _ratings_cache = {}
    return _ratings_cache

def save_cache():
    global _ratings_cache
    if _ratings_cache is None:
        return
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_ratings_cache, f, indent=2)
    except Exception as e:
        print(f"Error saving ratings cache: {e}")

def get_rating(username, cache_only=False):
    if not username:
        return None

    username_lower = username.lower()
    cache = load_cache()
    if username_lower in cache:
        # If the cached entry doesn't have 'attended' and we are not in cache_only mode,
        # trigger a refetch to populate the missing field.
        if "attended" in cache[username_lower] or cache_only:
            return cache[username_lower]

    if cache_only:
        return None

    json_payload = {
        "query": QUERY,
        "variables": {"username": username}
    }
    headers = {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
    }

    try:
        # Uses Chrome impersonation to bypass Cloudflare bot checks
        response = None
        for attempt in range(2):
            try:
                response = requests.post(LEETCODE_URL, json=json_payload, headers=headers, impersonate="chrome", timeout=15)
                if response.status_code == 200:
                    break
            except Exception:
                if attempt == 1: raise
                time.sleep(1)
                
        if not response or response.status_code != 200:
            return None

        # Add a tiny delay to help avoid immediate rate limits on massive lists
        time.sleep(0.2)

        data = response.json()
        stats = { "rating": "0", "attended": 0, "total_solved": 0 }
        
        ranking = data.get("data", {}).get("userContestRanking")
        if ranking:
             if ranking.get("rating") is not None:
                  stats["rating"] = str(round(ranking.get("rating")))
             if ranking.get("attendedContestsCount") is not None:
                  stats["attended"] = ranking.get("attendedContestsCount")
             
        matched = data.get("data", {}).get("matchedUser")
        if matched and matched.get("submitStats"):
             ac_subs = matched["submitStats"].get("acSubmissionNum", [])
             for diff in ac_subs:
                 if diff.get("difficulty") == "All":
                     stats["total_solved"] = diff.get("count", 0)
                     break
                     
        # Save to cache
        cache[username_lower] = stats
        save_cache()
        return stats
    except Exception as e:
        print(f"Error fetching stats for {username}: {e}")
        return None

def process_csv_in_memory(input_bytes):
    # Determine encoding, use replace to avoid UnicodeDecodeError for non utf-8 files
    content = input_bytes.decode('utf-8', errors='replace')
    lines = content.splitlines()

    def process_line(line):
        line = line.strip()
        if not line:
            return ""
            
        parts = line.split(',')
        if len(parts) < 6:
            return line
            
        username = parts[0].strip().strip('"').strip("'")
        
        # Exact replication of Java logic: replace parts[3]
        if username.lower() not in ["user", "username", "slug", "name"]:
            stats = get_rating(username)
            if stats is not None:
                parts[3] = stats.get("rating", "0")
            else:
                parts[3] = "0"
            
        return ",".join(parts)

    output_lines = []
    # Using thread pool to iterate quickly
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        output_lines = list(executor.map(process_line, lines))

    output_content = "\n".join(output_lines) + "\n"
    return output_content.encode('utf-8')
