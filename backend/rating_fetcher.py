from curl_cffi import requests
import io
import concurrent.futures
import time

LEETCODE_URL = "https://leetcode.com/graphql"
QUERY = """
query ($username: String!) {
  userContestRanking(username: $username) {
    rating
  }
}
"""

def get_rating(username):
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
        response = requests.post(LEETCODE_URL, json=json_payload, headers=headers, impersonate="chrome", timeout=10)
        if response.status_code != 200:
            return None

        # Add a tiny delay to help avoid immediate rate limits on massive lists
        time.sleep(0.2)

        data = response.json()
        ranking = data.get("data", {}).get("userContestRanking")
        if ranking and ranking.get("rating") is not None:
             return str(round(ranking.get("rating")))
        return "0"
    except Exception as e:
        print(f"Error fetching rating for {username}: {e}")
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
            rating = get_rating(username)
            if rating is not None:
                parts[3] = rating
            else:
                parts[3] = "0"
            
        return ",".join(parts)

    output_lines = []
    # Using thread pool to iterate quickly
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        output_lines = list(executor.map(process_line, lines))

    output_content = "\n".join(output_lines) + "\n"
    return output_content.encode('utf-8')
