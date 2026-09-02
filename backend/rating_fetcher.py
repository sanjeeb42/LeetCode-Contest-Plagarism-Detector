from curl_cffi import requests
import io
import csv
import concurrent.futures
import time
import os
import json
import threading

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

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE = os.path.join(_BASE_DIR, "resources", "ratings_cache.json")
_ratings_cache = None
_cache_lock = threading.Lock()

# Default TTL: 10 days in seconds
DEFAULT_TTL_SECONDS = 7 * 86400

def load_cache():
    global _ratings_cache
    with _cache_lock:
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
    with _cache_lock:
        if _ratings_cache is None:
            return
        try:
            os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
            temp_file = CACHE_FILE + ".tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(_ratings_cache, f, indent=2)
            os.replace(temp_file, CACHE_FILE)
        except Exception as e:
            print(f"Error saving ratings cache: {e}")

def get_rating(username, cache_only=False, force_refresh=False, max_age_seconds=DEFAULT_TTL_SECONDS):
    """
    Fetches the LeetCode contest rating and stats for a given username.
    - If cache_only=True: returns whatever is in cache without making network requests.
    - If cached and not expired (updated_at within max_age_seconds) and not force_refresh: returns cached data.
    - If not in cache, expired (missing updated_at or older than max_age_seconds), or force_refresh:
      fetches fresh data from LeetCode GraphQL and updates cache.
    - If live fetch fails (e.g. rate limit, timeout), falls back to cached data if available.
    """
    if not username:
        return None

    username = username.strip().strip('"').strip("'")
    if not username:
        return None

    username_lower = username.lower()
    cache = load_cache()

    cached_entry = None
    with _cache_lock:
        cached_entry = cache.get(username_lower)

    # Check if cached entry is fresh enough
    if cached_entry is not None:
        has_attended = "attended" in cached_entry
        updated_at = cached_entry.get("updated_at")
        is_fresh = has_attended and (updated_at is not None) and ((time.time() - updated_at) < max_age_seconds)

        if cache_only:
            return cached_entry

        if is_fresh and not force_refresh:
            return cached_entry

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
        response = None
        for attempt in range(3):
            try:
                response = requests.post(LEETCODE_URL, json=json_payload, headers=headers, impersonate="chrome", timeout=15)
                if response.status_code == 200:
                    break
                elif response.status_code == 429:
                    time.sleep(1.5 * (attempt + 1))
            except Exception:
                if attempt == 2:
                    break
                time.sleep(1.0)
                
        if not response or response.status_code != 200:
            # Fallback to cached entry if network fetch failed
            if cached_entry:
                print(f"[!] Live fetch failed for {username}, falling back to cached rating ({cached_entry.get('rating')})")
                return cached_entry
            return None

        # Tiny delay to avoid rate limits
        time.sleep(0.1)

        data = response.json()
        data_payload = data.get("data") or {}

        # If user does not exist on LeetCode
        if not data_payload and "errors" in data:
            if cached_entry:
                return cached_entry
            return None

        stats = { "rating": "0", "attended": 0, "total_solved": 0, "updated_at": time.time() }
        
        ranking = data_payload.get("userContestRanking")
        if ranking:
            if ranking.get("rating") is not None:
                stats["rating"] = str(round(ranking.get("rating")))
            if ranking.get("attendedContestsCount") is not None:
                stats["attended"] = ranking.get("attendedContestsCount")
             
        matched = data_payload.get("matchedUser")
        if matched and matched.get("submitStats"):
            ac_subs = (matched["submitStats"] or {}).get("acSubmissionNum", [])
            for diff in ac_subs:
                if diff.get("difficulty") == "All":
                    stats["total_solved"] = diff.get("count", 0)
                    break
                     
        # Save to memory cache
        with _cache_lock:
            cache[username_lower] = stats
            
        return stats
    except Exception as e:
        print(f"Error fetching stats for {username}: {e}")
        # Fallback to cached entry if an exception occurred
        if cached_entry:
            return cached_entry
        return None

def process_csv_in_memory(input_bytes):
    """
    Processes an uploaded CSV/sheet in memory and injects/updates fresh LeetCode ratings.
    Supports:
    - Single-column lists of usernames (e.g. plain list of handles).
    - Multi-column CSVs with headers (auto-detecting username and rating columns).
    - Multi-column CSVs without headers (standard 6+ column contest report format).
    - ThreadPoolExecutor parallel fetching with batch cache commit.
    """
    try:
        content = input_bytes.decode('utf-8-sig')
    except UnicodeDecodeError:
        try:
            content = input_bytes.decode('utf-8', errors='replace')
        except Exception:
            content = input_bytes.decode('latin-1', errors='replace')

    # Parse all rows with standard csv.reader to handle quotes, commas, escapes
    stream = io.StringIO(content)
    has_delimiter = any(d in content for d in [',', '\t', ';'])
    if has_delimiter:
        try:
            sample = content[:4096]
            dialect = csv.Sniffer().sniff(sample, delimiters=',\t;')
            reader = csv.reader(stream, dialect)
        except Exception:
            stream.seek(0)
            reader = csv.reader(stream)
    else:
        reader = csv.reader(stream)

    raw_rows = [row for row in reader]
    # Filter trailing empty rows
    while raw_rows and not any(cell.strip() for cell in raw_rows[-1]):
        raw_rows.pop()

    if not raw_rows:
        return b""

    # Detect header
    first_row = raw_rows[0]
    header_keywords = [
        "user_slug", "userslug", "username", "user", "handle", "name", 
        "candidate", "participant", "rank", "rating", "score", "email"
    ]
    is_header = any(
        any(kw in cell.strip().lower().replace(" ", "").replace("_", "").replace("-", "") for kw in header_keywords)
        for cell in first_row
    )

    num_cols = max(len(r) for r in raw_rows)

    # Identify column indices
    username_col_idx = 0
    rating_col_idx = -1
    has_explicit_rating_col = False

    if is_header:
        headers = first_row
        data_rows = raw_rows[1:]
        
        # Look for username column
        username_candidates = ["user_slug", "userslug", "username", "user", "handle", "name", "candidate", "participant"]
        for cand in username_candidates:
            for idx, h in enumerate(headers):
                h_clean = h.lower().replace(" ", "").replace("_", "").replace("-", "")
                if cand in h_clean:
                    username_col_idx = idx
                    break
            if username_col_idx != 0 or any(cand in headers[0].lower().replace(" ", "").replace("_", "").replace("-", "") for cand in username_candidates):
                break

        # Look for rating column
        rating_candidates = ["rating", "contest_rating", "contestrating", "user_rating", "score"]
        for cand in rating_candidates:
            for idx, h in enumerate(headers):
                h_clean = h.lower().replace(" ", "").replace("_", "").replace("-", "")
                if cand in h_clean:
                    rating_col_idx = idx
                    has_explicit_rating_col = True
                    break
            if has_explicit_rating_col:
                break
    else:
        data_rows = raw_rows
        # No header:
        if num_cols == 1:
            username_col_idx = 0
            rating_col_idx = 1
            has_explicit_rating_col = False
        elif num_cols >= 6:
            # Standard contest export format: Col 0 = Username, Col 3 = Rating
            username_col_idx = 0
            rating_col_idx = 3
            has_explicit_rating_col = True
        elif num_cols >= 4:
            username_col_idx = 0
            rating_col_idx = 3
            has_explicit_rating_col = True
        elif num_cols >= 2:
            username_col_idx = 0
            rating_col_idx = 1
            has_explicit_rating_col = True

    # Collect all unique usernames to fetch
    unique_usernames = set()
    for row in data_rows:
        if not row:
            continue
        if username_col_idx < len(row):
            uname = row[username_col_idx].strip().strip('"').strip("'")
            if uname and uname.lower() not in ["user", "username", "slug", "name", "user_slug", "handle"]:
                unique_usernames.add(uname)

    # Fetch ratings concurrently with 10 threads
    user_ratings = {}
    
    def fetch_user_rating(uname):
        # Default TTL is 10 days; if user is expired or not cached, fetches live
        stats = get_rating(uname, max_age_seconds=DEFAULT_TTL_SECONDS)
        if stats is not None:
            return uname, stats.get("rating", "0")
        return uname, "0"

    if unique_usernames:
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(fetch_user_rating, unique_usernames))
            for uname, rating_val in results:
                user_ratings[uname.lower()] = rating_val

    # Commit any newly cached entries to disk once for the whole batch
    save_cache()

    # Build output CSV
    output = io.StringIO()
    writer = csv.writer(output)

    if is_header:
        out_header = list(headers)
        if not has_explicit_rating_col:
            out_header.append("Rating")
            rating_col_idx = len(out_header) - 1
        writer.writerow(out_header)
    elif num_cols == 1:
        # For single column input without headers, write header row
        writer.writerow(["Username", "Rating"])

    for row in data_rows:
        if not row:
            writer.writerow([])
            continue

        out_row = list(row)
        uname = ""
        if username_col_idx < len(row):
            uname = row[username_col_idx].strip().strip('"').strip("'")

        rating_val = user_ratings.get(uname.lower(), "0") if uname else "0"

        if num_cols == 1 and not is_header:
            out_row = [uname, rating_val]
        else:
            if has_explicit_rating_col and rating_col_idx >= 0:
                while len(out_row) <= rating_col_idx:
                    out_row.append("")
                out_row[rating_col_idx] = rating_val
            else:
                out_row.append(rating_val)

        writer.writerow(out_row)

    return output.getvalue().encode('utf-8')
