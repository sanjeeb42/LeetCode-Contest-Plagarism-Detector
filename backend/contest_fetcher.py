import os
import time
import csv
import json
import warnings
import random
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from curl_cffi import requests
import s3_storage_service as s3

# 1. Setup & Silence Warnings
warnings.filterwarnings("ignore")

# --- CONFIGURATION ---
LIMIT_USERS = 100
MAX_WORKERS = 5

def get_paths(contest_slug):
    output_dir = os.path.join("resources", f"contest_report_{contest_slug}")
    raw_json_file = os.path.join(output_dir, "raw_data.json")
    report_file = os.path.join(output_dir, "submission_matrix.csv")
    meta_file = os.path.join(output_dir, "fetch_meta.json")
    return output_dir, raw_json_file, report_file, meta_file

def save_meta(contest_slug, pages_fetched):
    """Saves metadata about the fetch operation."""
    _, _, _, meta_file = get_paths(contest_slug)
    with open(meta_file, "w") as f:
        json.dump({"pages_fetched": pages_fetched, "last_fetched": time.time()}, f)

def load_meta(contest_slug):
    """Loads metadata about the previous fetch operation."""
    _, _, _, meta_file = get_paths(contest_slug)
    if os.path.exists(meta_file):
        try:
            with open(meta_file, "r") as f:
                return json.load(f)
        except: pass
    return None

def fetch_contest_data(session, contest_slug, page_limit=10, progress_callback=None):
    """Fetches key data from LeetCode, iterating through pages."""
    print(f"[*] Fetching live data for {contest_slug} (Limit: {page_limit} pages)...")
    
    output_dir, raw_json_file, _, _ = get_paths(contest_slug)
    os.makedirs(output_dir, exist_ok=True)

    aggregated_data = {
        "total_rank": [],
        "submissions": [],
        "questions": []
    }

    try:
        for page in range(1, page_limit + 1):
            url = f"https://leetcode.com/contest/api/ranking/{contest_slug}/?pagination={page}&region=global"
            resp = session.get(url, timeout=30)
            
            if resp.status_code == 200:
                data = resp.json()
                
                # On first page, grab questions
                if page == 1:
                    aggregated_data["questions"] = data.get("questions", [])
                
                aggregated_data["total_rank"].extend(data.get("total_rank", []))
                aggregated_data["submissions"].extend(data.get("submissions", []))
                
                print(f"    Fetched page {page}/{page_limit}")
                if progress_callback:
                    # Allocate first 40% of progress to ranking fetch
                    # percent = (page / page_limit) * 40
                    pass
            else:
                print(f"!! Failed page {page} with status: {resp.status_code}")
                # If a page fails, we might want to stop or continue. 
                # For now, let's stop to avoid partial/corrupt states
                break
            
            # Gentle pacing
            time.sleep(0.2)
            
        # Save aggregated raw data
        with open(raw_json_file, "w", encoding="utf-8") as f:
            json.dump(aggregated_data, f, indent=4)
            
        return aggregated_data

    except Exception as e:
        print(f"!! Network Error: {e}")
    return None

def load_cache(report_file):
    """Loads existing submissions from the CSV report into a dictionary."""
    cache = {}
    if not os.path.exists(report_file):
        return cache
    
    try:
        with open(report_file, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            if not header:
                return cache
            
            # Identify columns dynamically
            # We expect headers like: user, rank, question1_id, ..., codeq1, ...
            sub_indices = [i for i, h in enumerate(header) if h.startswith("question") and h.endswith("_id")]
            code_indices = [i for i, h in enumerate(header) if h.startswith("codeq")]
            
            for row in reader:
                if len(row) <= max(code_indices, default=-1): continue
                
                for si, ci in zip(sub_indices, code_indices):
                    sub_id = row[si]
                    code = row[ci]
                    
                    if sub_id and code:
                        cache[sub_id] = code
                            
    except Exception as e:
        print(f"[!] Error loading cache: {e}")
        
    print(f"[*] Loaded {len(cache)} cached submissions.")
    return cache

def fetch_worker(submission_ids, cache, lc_session_cookie=None):
    """Worker function for concurrent fetching. processes a list of submission IDs."""
    results = {}
    
    # Each thread gets its own session
    with requests.Session(impersonate="chrome") as session:
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://leetcode.com/"
        })
        if lc_session_cookie:
             session.cookies.set("LEETCODE_SESSION", lc_session_cookie)
             
        for sub_id in submission_ids:
            if not sub_id:
                results[sub_id] = ""
                continue
                
            if cache and sub_id in cache:
                 results[sub_id] = cache[sub_id]
                 continue
                 
            url = f"https://leetcode.com/api/submissions/{sub_id}/"
            try:
                # Randomized delay to minimize footprint while being fast
                time.sleep(random.uniform(0.5, 1.0)) 
                
                resp = session.get(url, timeout=30)
                if resp.status_code == 200:
                    code = resp.json().get("code", "")
                    results[sub_id] = code
                else:
                    results[sub_id] = ""
            except Exception:
                results[sub_id] = ""
                
    return results

def generate_report(data, session, contest_slug, progress_callback=None):
    """Maps parallel 'total_rank' and 'submissions' arrays to a CSV."""
    print("[*] Generating CSV Report...")
    
    output_dir, raw_json_file, report_file, _ = get_paths(contest_slug)
    
    # Load Cache
    cache = load_cache(report_file)

    total_rank = data.get("total_rank", [])
    submissions_list = data.get("submissions", [])
    questions_list = data.get("questions", [])

    # Identify questions
    sorted_questions = sorted(questions_list, key=lambda x: x['id'])
    q_ids = [str(q['question_id']) for q in sorted_questions]
    num_questions = len(q_ids)
    print(f"[*] Found {num_questions} questions for this contest.")
    
    # 1. Collect all Submission IDs needed
    # Map: username -> { rank, submissions: { q_id: sub_id } }
    users_data = [] 
    all_submission_ids = []

    for rank_entry, sub_entry in zip(total_rank, submissions_list):
        username = rank_entry.get("username")
        slug = rank_entry.get("user_slug") or username
        rank = rank_entry.get("rank")
        
        # Check for CN region
        is_cn = False
        for q_val in sub_entry.values():
            if q_val.get("data_region") == "CN":
                is_cn = True
                break
        
        if is_cn:
            continue
            
        user_submissions = {}
        for q_id in q_ids:
             q_data = sub_entry.get(q_id, {})
             sub_id = str(q_data.get("submission_id", ""))
             user_submissions[q_id] = sub_id
             if sub_id and sub_id not in cache:
                 all_submission_ids.append(sub_id)
                 
        users_data.append({
            "username": username,
            "slug": slug,
            "rank": rank,
            "submissions": user_submissions
        })

    # 2. Concurrent Fetch
    print(f"[*] Fetching {len(all_submission_ids)} missing submissions concurrently...")
    
    # Helper to chunk list
    def chunk_list(l, n):
        for i in range(0, len(l), n):
            yield l[i:i + n]

    # Ideally spread across MAX_WORKERS
    chunk_size = max(1, len(all_submission_ids) // MAX_WORKERS) if all_submission_ids else 1
    chunks = list(chunk_list(all_submission_ids, chunk_size + 1)) # +1 to ensure not too many tiny chunks if odd division
    
    fetched_code_map = {}
    lc_session_cookie = os.environ.get("LEETCODE_SESSION")
    
    completed_submissions = 0
    total_to_fetch = len(all_submission_ids)
    
    # If nothing to fetch, we still want to show progress complete
    if total_to_fetch == 0 and progress_callback:
        progress_callback(50) # Arbitrary midpoint
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_worker, chunk, cache, lc_session_cookie): chunk for chunk in chunks}
        
        for future in as_completed(futures):
            result_map = future.result()
            fetched_code_map.update(result_map)
            
            completed_submissions += len(result_map)
            if progress_callback and total_to_fetch > 0:
                 # Progress is 50% + (50% * fetch_progress) 
                 # Reserve first 50% for "preparation/ranking fetch" conceptually or just map 0-100 logic
                 # Let's simple map fetch completion to linear progress
                 percent = int((completed_submissions / total_to_fetch) * 100)
                 progress_callback(percent)

    # Incorporate Cache
    fetched_code_map.update(cache)

    # 3. Write CSV
    print("[*] Writing final report...")
    with open(report_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        header = ["user", "slug", "rank"]
        for i in range(1, num_questions + 1):
            header.append(f"question{i}_id")
        for i in range(1, num_questions + 1):
            header.append(f"codeq{i}")
        writer.writerow(header)

        for i, u_data in enumerate(users_data):
            row = [u_data["username"], u_data["slug"], u_data["rank"]]
            
            # IDs
            for q_id in q_ids:
                row.append(u_data["submissions"].get(q_id, ""))
            
            # Code
            for q_id in q_ids:
                s_id = u_data["submissions"].get(q_id)
                code = fetched_code_map.get(s_id, "") if s_id else ""
                row.append(code)
            
            writer.writerow(row)
            
    if progress_callback:
        progress_callback(100)

    print(f"[✓] Success! Report saved to: {report_file}")
    return True

def run_data_collection(contest_slug, progress_callback=None, page_limit=10):
    """Main execution function for data collection."""
    
    # Check Cache
    meta = load_meta(contest_slug)
    if meta and meta.get("pages_fetched", 0) >= page_limit:
        print(f"[SKIP] Already fetched {meta['pages_fetched']} pages. Requested {page_limit}. Using cache.")
        if progress_callback:
            progress_callback(100)
        return True

    # Session setup
    with requests.Session(impersonate="chrome") as session:
        session.headers.update({
             "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        })

        lc_session = os.environ.get("LEETCODE_SESSION")
        if lc_session:
            print("[*] Using provided LEETCODE_SESSION cookie.")
            session.cookies.set("LEETCODE_SESSION", lc_session)
        else:
             print("[*] No LEETCODE_SESSION provided. Attempting anonymous fetch...")
        
        print("[*] Visiting homepage to initialize session...")
        try:
            session.get("https://leetcode.com/", timeout=10)
            csrf_token = session.cookies.get("csrftoken")
            if csrf_token:
                session.headers.update({"x-csrftoken": csrf_token})
                print(f"[*] CSRF Token extracted and set.")
        except Exception as e:
            print(f"[!] Warning: Failed to visit homepage: {e}")

        session.headers.update({"Referer": "https://leetcode.com/"})

        data = fetch_contest_data(session, contest_slug, page_limit, progress_callback)
        if data:
            if generate_report(data, session, contest_slug, progress_callback):
                save_meta(contest_slug, page_limit)
                
                # Cloud sync folder
                output_dir, _, _, _ = get_paths(contest_slug)
                s3.upload_directory(output_dir)
                
                return True
            return False
        else:
            print("!! Pipeline failed at data collection stage.")
            return False

if __name__ == "__main__":
    run_data_collection("biweekly-contest-172")