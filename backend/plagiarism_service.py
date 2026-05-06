import os
import csv
import subprocess
import requests
import shutil
import re
from collections import defaultdict
import s3_storage_service as s3

# --- CONFIGURATION ---
JPLAG_JAR = "jplag.jar"
# Using a specific version of JPlag compatible with Java 8+
JPLAG_URL = "https://github.com/jplag/jplag/releases/download/v2.12.1-SNAPSHOT/jplag-2.12.1-SNAPSHOT-jar-with-dependencies.jar"

def get_paths(contest_slug):
    output_dir = os.path.join("resources", f"contest_report_{contest_slug}")
    csv_file = os.path.join(output_dir, "submission_matrix.csv")
    submissions_dir = os.path.join(output_dir, "submissions")
    jplag_results_dir = os.path.join(output_dir, "jplag_results")
    return output_dir, csv_file, submissions_dir, jplag_results_dir

# Union-Find Data Structure
class UnionFind:
    def __init__(self):
        self.parent = {}

    def find(self, i):
        if i not in self.parent:
            self.parent[i] = i
        if self.parent[i] != i:
            self.parent[i] = self.find(self.parent[i])
        return self.parent[i]

    def union(self, i, j):
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            self.parent[root_i] = root_j
            return True
        return False
        
    def get_clusters(self):
        clusters = defaultdict(list)
        for node in self.parent:
            root = self.find(node)
            clusters[root].append(node)
        return dict(clusters)

def setup_jplag():
    if not os.path.exists(JPLAG_JAR):
        print(f"[*] JPlag JAR not found. Downloading from {JPLAG_URL}...")
        try:
            resp = requests.get(JPLAG_URL, stream=True)
            resp.raise_for_status()
            with open(JPLAG_JAR, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            print("[✓] JPlag downloaded successfully.")
        except Exception as e:
            print(f"!! Failed to download JPlag: {e}")
            return False
    return True

def detect_language(code_snippet):
    if "public class" in code_snippet or "class Solution" in code_snippet and "public" in code_snippet:
        return "java"
    if "#include" in code_snippet or "class Solution {" in code_snippet and "public:" in code_snippet:
        return "cpp" 
    if "def " in code_snippet and ":" in code_snippet:
        return "python3"
    return "text"

def load_user_ranks(contest_slug):
    _, csv_file, _, _ = get_paths(contest_slug)
    ranks = {}
    if os.path.exists(csv_file):
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ranks[row["user"]] = row["rank"]
    return ranks

def load_user_slugs(contest_slug):
    _, csv_file, _, _ = get_paths(contest_slug)
    slugs = {}
    if os.path.exists(csv_file):
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Fallback to user if slug missing (for backward compatibility)
                slugs[row["user"]] = row.get("slug", row["user"])
    return slugs

def load_user_submission_ids(contest_slug):
    _, csv_file, _, _ = get_paths(contest_slug)
    # Returns { user: { "Q1": sub_id, "Q2": sub_id... } }
    submissions = defaultdict(dict)
    if os.path.exists(csv_file):
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
            
            # Identify question ID columns (question1_id, question2_id...)
            q_cols = {} # { "question1_id": "Q1", ... }
            for fn in fieldnames:
                if fn.startswith("question") and fn.endswith("_id"):
                    try:
                        num = fn.replace("question", "").replace("_id", "")
                        q_cols[fn] = f"Q{num}"
                    except: pass
            
            for row in reader:
                user = row["user"]
                for col, q_label in q_cols.items():
                    sub_id = row.get(col)
                    if sub_id:
                        submissions[user][q_label] = sub_id
    return submissions

def export_submissions(contest_slug):
    print("[*] Exporting submissions from CSV...")
    _, csv_file, submissions_dir, _ = get_paths(contest_slug)
    
    if not os.path.exists(csv_file):
        print(f"!! CSV file not found: {csv_file}")
        return False
        
    if os.path.exists(submissions_dir):
        shutil.rmtree(submissions_dir)
    
    questions_languages = defaultdict(set)
    
    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        # Determine number of questions from header
        fieldnames = reader.fieldnames
        # Find max N where codeqN exists
        max_q = 0
        for f in fieldnames:
            if f.startswith("codeq"):
                try:
                    num = int(f.replace("codeq", ""))
                    max_q = max(max_q, num)
                except: pass
        
        print(f"[*] Detected {max_q} questions in CSV.")

        for row in reader:
            username = row["user"]
            for i in range(1, max_q + 1):
                q_col_name = f"question{i}_id"
                code_key = f"codeq{i}"
                
                sub_id = row.get(q_col_name)
                code = row.get(code_key)
                q_group = f"Q{i}"
                
                if sub_id and code and len(code.strip()) > 10:
                    lang = detect_language(code)
                    ext = "txt"
                    if lang == "java": ext = "java"
                    elif lang == "cpp": ext = "cpp"
                    elif lang == "python3": ext = "py"
                    
                    q_dir = os.path.join(submissions_dir, q_group, lang)
                    os.makedirs(q_dir, exist_ok=True)
                    
                    questions_languages[q_group].add(lang)
                    safe_username = username.encode('utf-8').hex()
                    file_path = os.path.join(q_dir, f"{safe_username}.{ext}")
                    with open(file_path, "w", encoding="utf-8") as out_f:
                        out_f.write(code)

    print(f"[✓] Export complete.")
    return questions_languages

def get_submission_code(contest_slug, question_id, username):
    _, _, submissions_dir, _ = get_paths(contest_slug)
    # Expected path: submissions_dir/Q#/lang/username.ext
    # We need to find the language and extension
    
    q_dir_base = os.path.join(submissions_dir, question_id)
    if not os.path.exists(q_dir_base):
        return None
        
    # Search all language subdirectories
    for lang in os.listdir(q_dir_base):
        lang_dir = os.path.join(q_dir_base, lang)
        if not os.path.isdir(lang_dir): continue
        
        # Check for user file with any allowed extension
        # Common extensions based on export logic: .java, .cpp, .py, .txt
        possible_exts = ["java", "cpp", "py", "txt"]
        
        safe_username = username.encode('utf-8').hex()
        for ext in possible_exts:
            file_path = os.path.join(lang_dir, f"{safe_username}.{ext}")
            if os.path.exists(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        return f.read()
                except Exception as e:
                    print(f"Error reading file {file_path}: {e}")
                    return None
    return None

_ai_cache = None

def get_title_slug(contest_slug, question_id):
    """
    Reads raw_data.json to find the title_slug for a given question_id (e.g. Q3).
    question_id maps to index 0, 1, 2, 3 in the questions array.
    """
    output_dir, _, _, _ = get_paths(contest_slug)
    raw_path = os.path.join(output_dir, "raw_data.json")
    try:
        import json
        with open(raw_path, "r") as f:
            data = json.load(f)
            q_idx = int(question_id.replace("Q", "")) - 1
            if 0 <= q_idx < len(data.get("questions", [])):
                return data["questions"][q_idx].get("title_slug")
    except Exception:
        pass
    return None

def fetch_typing_replay(contest_slug, title_slug, username):
    from curl_cffi import requests
    import json
    
    # Map username (which might be display name) to user_slug
    slugs_map = load_user_slugs(contest_slug)
    user_slug = slugs_map.get(username, username)
    
    # --- Cache: check for cached replay events on disk ---
    output_dir, _, _, _ = get_paths(contest_slug)
    cache_dir = os.path.join(output_dir, "replays")
    os.makedirs(cache_dir, exist_ok=True)
    # Sanitize filename: replace slashes and special chars
    safe_user = user_slug.replace("/", "_").replace("\\", "_")
    safe_slug = title_slug.replace("/", "_").replace("\\", "_")
    cache_file = os.path.join(cache_dir, f"{safe_user}_{safe_slug}.json")
    
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                cached = json.load(f)
                if cached:
                    return cached
        except Exception:
            pass
    
    # --- Live fetch from LeetCode API ---
    url = "https://leetcode.com/graphql/"
    fake_csrf = "fake_csrf_token_1234567890abcdef"
    headers = {
        "accept": "*/*",
        "content-type": "application/json",
        "x-csrftoken": fake_csrf,
        "cookie": f"csrftoken={fake_csrf};"
    }

    body = {
        "query": "\n    query UserContestReplayEvents($contestSlug: String!, $questionSlug: String!, $username: String) {\n  userContestReplayEvents(\n    contestSlug: $contestSlug\n    questionSlug: $questionSlug\n    username: $username\n  ) {\n    eventType\n    eventData\n    timestamp\n  }\n}\n    ",
        "variables": {
            "contestSlug": contest_slug,
            "questionSlug": title_slug,
            "username": user_slug
        },
        "operationName": "UserContestReplayEvents"
    }

    try:
        import time
        for attempt in range(3):
            response = requests.post(url, headers=headers, json=body, impersonate="chrome", timeout=10)
            if response.status_code == 200:
                data = response.json()
                d = data.get("data")
                if d:
                    events = d.get("userContestReplayEvents") or []
                    if events:
                        # Save to cache
                        try:
                            with open(cache_file, "w") as f:
                                json.dump(events, f)
                        except Exception:
                            pass
                        return events
            # Retry after a short delay if no events returned
            if attempt < 2:
                time.sleep(1)
    except Exception as e:
        print(f"Error fetching typing replay for {username} (slug: {user_slug}): {e}")
    return []

def get_question_id(contest_slug, title_slug):
    """Returns the numeric question_id for a given title_slug."""
    output_dir, _, _, _ = get_paths(contest_slug)
    raw_path = os.path.join(output_dir, "raw_data.json")
    try:
        import json
        with open(raw_path, "r") as f:
            data = json.load(f)
            for q in data.get("questions", []):
                if q.get("title_slug") == title_slug:
                    return str(q.get("question_id"))
    except Exception:
        pass
    return None

def get_typing_replay_frames(contest_slug, title_slug, username):
    events = fetch_typing_replay(contest_slug, title_slug, username)
    frames = []
    code_state = ""
    
    # Get the numeric questionId to filter events for this specific question
    target_qid = get_question_id(contest_slug, title_slug)
    import json
    
    # Pre-parse all events
    parsed_events = []
    for event in events:
        event_type = str(event.get("eventType"))
        event_data_str = event.get("eventData")
        timestamp = event.get("timestamp", 0)
        
        if not event_data_str:
            continue
        try:
            event_data = json.loads(event_data_str)
        except:
            continue
        parsed_events.append((event_type, event_data, timestamp))
    
    for i, (event_type, event_data, timestamp) in enumerate(parsed_events):
        event_qid = str(event_data.get("questionId", ""))
        
        # Filter by questionId
        if target_qid and event_qid and event_qid != target_qid:
            # Exception: switch_language events (types 0, 2) have the SOURCE question's ID.
            # Include them if the NEXT event belongs to our target question.
            if event_type in ("0", "2"):
                if i + 1 < len(parsed_events):
                    next_qid = str(parsed_events[i + 1][1].get("questionId", ""))
                    if next_qid == target_qid:
                        lang = event_data.get("lang", "unknown")
                        frames.append({"timestamp": timestamp, "code": code_state, "event": "switch_language", "lang": lang})
            continue
            
        if event_type == "7":
            if "c" in event_data:
                code_state = event_data.get("c", "")
            else:
                changes = event_data.get("change", {}).get("changes", [])
                for change in changes:
                    from_pos = change.get("from", 0)
                    to_pos = change.get("to", from_pos)
                    insert_text = change.get("insert", "")
                    code_state = code_state[:from_pos] + insert_text + code_state[to_pos:]
                    
                    if len(insert_text) > 50 and not event_data.get("isFromInside", False):
                        frames.append({"timestamp": timestamp, "code": code_state, "event": "external_paste", "chars": len(insert_text)})
            frames.append({"timestamp": timestamp, "code": code_state, "event": "flush"})
            
        elif event_type == "10":
            if "c" in event_data:
                old_changes = event_data["c"]
                if isinstance(old_changes, str):
                    code_state = old_changes
                elif isinstance(old_changes, list):
                    for change in old_changes:
                        if "t" in change:
                            insert_text = change["t"]
                            pos = change.get("l", len(code_state))
                            code_state = code_state[:pos] + insert_text + code_state[pos:]
                            
                            if len(insert_text) > 50:
                                frames.append({"timestamp": timestamp, "code": code_state, "event": "external_paste", "chars": len(insert_text)})
                        elif "l" in change and "d" in change:
                            pos = change["l"]
                            del_len = change["d"]
                            code_state = code_state[:pos] + code_state[pos + del_len:]
            else:
                changes = event_data.get("change", {}).get("changes", [])
                for change in changes:
                    from_pos = change.get("from", 0)
                    to_pos = change.get("to", from_pos)
                    insert_text = change.get("insert", "")
                    code_state = code_state[:from_pos] + insert_text + code_state[to_pos:]
                    
                    if len(insert_text) > 50 and not event_data.get("isFromInside", False):
                        frames.append({"timestamp": timestamp, "code": code_state, "event": "external_paste", "chars": len(insert_text)})
            
            frames.append({"timestamp": timestamp, "code": code_state, "event": "typing"})
            
        elif event_type in ("0", "2"):
            lang = event_data.get("lang", "unknown")
            frames.append({"timestamp": timestamp, "code": code_state, "event": "switch_language", "lang": lang})
            
        elif event_type == "4":
            status = event_data.get("result", {}).get("status", 0)
            frames.append({"timestamp": timestamp, "code": code_state, "event": "run_code", "status": status})
            
        elif event_type == "5":
            status = event_data.get("result", {}).get("status", 0)
            frames.append({"timestamp": timestamp, "code": code_state, "event": "submit_code", "status": status})
            
    return frames

def set_manual_override(contest_slug, username, is_ai):
    import json, os
    output_dir, _, _, _ = get_paths(contest_slug)
    override_path = os.path.join(output_dir, "manual_overrides.json")
    overrides = {}
    if os.path.exists(override_path):
        try:
            with open(override_path, "r") as f: overrides = json.load(f)
        except: pass
    overrides[username] = is_ai
    with open(override_path, "w") as f:
        json.dump(overrides, f)
        
    # Invalidate cache for this user
    global _ai_cache
    if _ai_cache is not None:
        keys_to_delete = [k for k in _ai_cache.keys() if k.startswith(f"{username}_")]
        for k in keys_to_delete:
            del _ai_cache[k]
        cache_path = os.path.join(output_dir, "ai_cache.json")
        try:
            with open(cache_path, "w") as f: json.dump(_ai_cache, f)
        except: pass

# --- TOP 500 AI SUSPECT SCANNER ---

def get_top_n_users(contest_slug, n=500):
    """Reads the already-fetched raw_data.json and returns the top N users sorted by rank."""
    import json
    output_dir, _, _, _ = get_paths(contest_slug)
    raw_json_file = os.path.join(output_dir, "raw_data.json")
    
    if not os.path.exists(raw_json_file):
        return []
    
    try:
        with open(raw_json_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return []
    
    total_rank = data.get("total_rank", [])
    
    # Filter out CN region users and sort by rank
    users = []
    submissions_list = data.get("submissions", [])
    for i, rank_entry in enumerate(total_rank):
        # Check CN region
        is_cn = False
        if i < len(submissions_list):
            for q_val in submissions_list[i].values():
                if isinstance(q_val, dict) and q_val.get("data_region") == "CN":
                    is_cn = True
                    break
        if is_cn:
            continue
            
        users.append({
            "username": rank_entry.get("username"),
            "user_slug": rank_entry.get("user_slug") or rank_entry.get("username"),
            "rank": rank_entry.get("rank", 99999)
        })
    
    # Sort by rank and return top N
    users.sort(key=lambda u: u["rank"])
    return users[:n]

def analyze_replay_for_ai(contest_slug, username, title_slug):
    """Analyzes a single user's typing replay for AI indicators in their pasted code."""
    import json
    
    events = fetch_typing_replay(contest_slug, title_slug, username) or []
    
    if not events:
        return {"ai_score": 0, "reasons": [], "paste_events": [], "paste_ratio": 0, "final_code": ""}
    
    # Process events to extract paste content
    paste_events = []
    code_state = ""
    total_typed_chars = 0
    total_pasted_chars = 0
    
    for event in events:
        event_type = str(event.get("eventType"))
        event_data_str = event.get("eventData")
        timestamp = event.get("timestamp", 0)
        
        if not event_data_str:
            continue
        try:
            event_data = json.loads(event_data_str)
        except:
            continue
        
        if event_type in ("7", "10"):
            if event_type == "7" and "c" in event_data:
                code_state = event_data.get("c", "")
            else:
                changes = event_data.get("change", {}).get("changes", [])
                for change in changes:
                    from_pos = change.get("from", 0)
                    to_pos = change.get("to", from_pos)
                    insert_text = change.get("insert", "")
                    code_state = code_state[:from_pos] + insert_text + code_state[to_pos:]
                    
                    is_from_inside = event_data.get("isFromInside", False)
                    
                    if len(insert_text) > 50 and not is_from_inside:
                        total_pasted_chars += len(insert_text)
                        
                        # Analyze the pasted text for AI markers
                        has_comments = _check_paste_for_comments(insert_text)
                        has_ai_phrases = _check_paste_for_ai_phrases(insert_text)
                        
                        paste_events.append({
                            "timestamp": timestamp,
                            "chars": len(insert_text),
                            "has_comments": has_comments,
                            "has_ai_phrases": has_ai_phrases,
                            "preview": insert_text[:150]
                        })
                    else:
                        total_typed_chars += len(insert_text)
                
                # Handle old format
                if event_type == "10" and "c" in event_data and isinstance(event_data["c"], list):
                    for change in event_data["c"]:
                        if "t" in change:
                            insert_text = change["t"]
                            if len(insert_text) > 50:
                                total_pasted_chars += len(insert_text)
                                paste_events.append({
                                    "timestamp": timestamp,
                                    "chars": len(insert_text),
                                    "has_comments": _check_paste_for_comments(insert_text),
                                    "has_ai_phrases": _check_paste_for_ai_phrases(insert_text),
                                    "preview": insert_text[:150]
                                })
    
    final_code = code_state
    final_code_len = len(final_code) if final_code else 1
    paste_ratio = total_pasted_chars / final_code_len if final_code_len > 0 else 0
    
    # Score computation
    score = 0
    reasons = []
    
    # 1. Any paste with comments = strong AI indicator
    pastes_with_comments = [p for p in paste_events if p["has_comments"]]
    if pastes_with_comments:
        score += 40
        reasons.append(f"Comments detected in {len(pastes_with_comments)} pasted block(s)")
    
    # 2. AI phrases in pasted text
    pastes_with_ai_phrases = [p for p in paste_events if p["has_ai_phrases"]]
    if pastes_with_ai_phrases:
        score += 30
        reasons.append(f"AI-like phrases found in pasted code")
    
    # 3. High paste ratio
    if paste_ratio > 0.8:
        score += 25
        reasons.append(f"Paste ratio: {int(paste_ratio * 100)}% of code was pasted")
    elif paste_ratio > 0.5:
        score += 15
        reasons.append(f"Paste ratio: {int(paste_ratio * 100)}% of code was pasted")
    
    # 4. Very large single paste (> 300 chars)
    max_paste = max((p["chars"] for p in paste_events), default=0)
    if max_paste > 300:
        score += 20
        reasons.append(f"Large single paste of {max_paste} characters")
    
    # 5. Extremely fast completion (entire code pasted in < 30 seconds of editing)
    if len(events) > 0 and len(events) < 10 and paste_ratio > 0.9:
        score += 15
        reasons.append("Extremely few keystrokes — code appears fully pasted")
    
    return {
        "ai_score": min(score, 100),
        "reasons": reasons,
        "paste_events": paste_events,
        "paste_ratio": round(paste_ratio, 2),
        "final_code": final_code
    }

def _check_paste_for_comments(text):
    """Check if pasted text contains explanatory comments (AI signature)."""
    lines = text.split("\n")
    comment_count = 0
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("#"):
            # Exclude simple commented-out code
            if not re.search(r'(//|#)\s*[a-zA-Z_]\w*\s*(<<|>>|=|;|\()', stripped):
                comment_count += 1
    
    # Step-by-step pattern
    step_pattern = re.compile(r'(//|#)\s*(\d+\.|Step\s*\d+:?)', re.IGNORECASE)
    has_steps = any(step_pattern.search(line) for line in lines)
    
    return comment_count >= 2 or has_steps

def _check_paste_for_ai_phrases(text):
    """Check if pasted text contains phrases commonly found in AI-generated code."""
    ai_phrases = [
        "time complexity", "space complexity", "explanation:",
        "approach:", "algorithm:", "intuition:", "helper to",
        "function to", "base case", "edge case", "step 1",
        "step 2", "step 3", "// note:", "# note:"
    ]
    text_lower = text.lower()
    return any(phrase in text_lower for phrase in ai_phrases)

def run_top500_scan(contest_slug, n=500, progress_callback=None):
    """Orchestrates scanning the top N users' replays for AI indicators."""
    import json, time
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    output_dir, _, _, _ = get_paths(contest_slug)
    results_path = os.path.join(output_dir, "top500_ai_results.json")
    
    # Get top N users
    users = get_top_n_users(contest_slug, n=n)
    if not users:
        return {"error": "No users found. Run 'Fetch Submissions' first."}
    
    # Get question slugs for Q3 and Q4
    questions = {}
    for q_id in ["Q3", "Q4"]:
        slug = get_title_slug(contest_slug, q_id)
        if slug:
            questions[q_id] = slug
    
    if not questions:
        return {"error": "Could not determine question slugs. Ensure contest data is fetched."}
    
    total_tasks = len(users) * len(questions)
    completed = 0
    results = []
    
    print(f"[*] Starting Top 500 AI scan: {len(users)} users × {len(questions)} questions = {total_tasks} replay checks")
    
    for user in users:
        username = user["username"]
        user_result = {
            "username": username,
            "user_slug": user["user_slug"],
            "rank": user["rank"],
            "questions": {},
            "total_ai_score": 0,
            "total_reasons": []
        }
        
        max_score = 0
        all_reasons = []
        
        for q_id, title_slug in questions.items():
            try:
                analysis = analyze_replay_for_ai(contest_slug, username, title_slug)
                user_result["questions"][q_id] = {
                    "ai_score": analysis["ai_score"],
                    "reasons": analysis["reasons"],
                    "paste_events": analysis["paste_events"],
                    "paste_ratio": analysis["paste_ratio"],
                    "final_code": analysis["final_code"]
                }
                
                if analysis["ai_score"] > max_score:
                    max_score = analysis["ai_score"]
                all_reasons.extend(analysis["reasons"])
                
            except Exception as e:
                print(f"[!] Error scanning {username} for {q_id}: {e}")
                user_result["questions"][q_id] = {
                    "ai_score": 0, "reasons": ["Scan error"], 
                    "paste_events": [], "paste_ratio": 0, "final_code": ""
                }
            
            completed += 1
            if progress_callback:
                progress_callback(int((completed / total_tasks) * 100))
            
            # Rate limiting — gentle delay between API calls
            time.sleep(0.3)
        
        user_result["total_ai_score"] = max_score
        user_result["total_reasons"] = list(set(all_reasons))
        results.append(user_result)
    
    # Sort by AI score descending
    results.sort(key=lambda r: r["total_ai_score"], reverse=True)
    
    # Save results
    output = {
        "contest_slug": contest_slug,
        "total_scanned": len(users),
        "total_flagged": len([r for r in results if r["total_ai_score"] >= 60]),
        "questions_scanned": list(questions.keys()),
        "suspects": results
    }
    
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    
    print(f"[✓] Top 500 scan complete. {output['total_flagged']} suspects flagged.")
    return output

def load_top500_results(contest_slug):
    """Load previously saved top 500 scan results."""
    import json
    output_dir, _, _, _ = get_paths(contest_slug)
    results_path = os.path.join(output_dir, "top500_ai_results.json")
    
    if not os.path.exists(results_path):
        return None
    
    try:
        with open(results_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None

def analyze_ai_likelihood(code, language="text", username=None, contest_slug=None, title_slug=None):
    """
    Returns a dict with score (0-100) and reasons.
    """
    global _ai_cache
    cache_key = None
    cache_path = None
    
    if username and contest_slug:
        import hashlib, json
        output_dir, _, _, _ = get_paths(contest_slug)
        
        # Check manual overrides first
        override_path = os.path.join(output_dir, "manual_overrides.json")
        if os.path.exists(override_path):
            try:
                with open(override_path, "r") as f:
                    overrides = json.load(f)
                    if username in overrides:
                        is_ai = overrides[username]
                        return {
                            "score": 100 if is_ai else 0,
                            "reasons": [f"Manual override: {'Flagged as AI' if is_ai else 'Verified Human'}"]
                        }
            except: pass

        cache_path = os.path.join(output_dir, "ai_cache.json")
        if _ai_cache is None:
            if os.path.exists(cache_path):
                try:
                    with open(cache_path, "r") as f: _ai_cache = json.load(f)
                except: _ai_cache = {}
            else:
                _ai_cache = {}
                
        code_hash = hashlib.md5(code.encode('utf-8')).hexdigest()
        cache_key = f"{username}_{code_hash}"
        if cache_key in _ai_cache:
            return _ai_cache[cache_key]

    import re
    score = 0
    reasons = []

    # Try Ollama First
    def evaluate_with_ollama(code_text):
        import urllib.request, urllib.error, json
        prompt = f"""You are an expert AI detection system for competitive programming.
Analyze the following LeetCode submission and determine if it was written by an AI (like ChatGPT) or a human.
Respond ONLY with a valid JSON object containing exactly two keys:
1. "score": an integer from 0 to 100 representing the likelihood it is AI generated.
2. "reasons": a list of string reasons explaining the score (keep them brief).

Code:
```
{code_text}
```
"""
        req = urllib.request.Request("http://localhost:11434/api/generate", data=json.dumps({
            "model": "qwen2.5-coder:1.5b",
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=25) as response:
                result = json.loads(response.read().decode())
                response_text = result.get("response", "{}")
                return json.loads(response_text)
        except Exception:
            return None

    ollama_result = evaluate_with_ollama(code)
    if ollama_result and isinstance(ollama_result, dict) and "score" in ollama_result:
        score = int(ollama_result.get("score", 0))
        reasons = ollama_result.get("reasons", [])
        if not isinstance(reasons, list): reasons = [str(reasons)]
        reasons.insert(0, "[Local LLM Evaluation]")
    else:
        # Fallback to static heuristics if Ollama is down/unavailable
    
        # 0. Clean Boilerplate
        clean_code = code
        clean_code = re.sub(r'/\*\*.*?\*/', '', clean_code, flags=re.DOTALL) # Multi-line comments usually at top
        clean_code = re.sub(r'// Note: The returned array must be malloced.*', '', clean_code)
        
        code_lines = [line.strip() for line in clean_code.split('\n') if line.strip()]
        total_lines = len(code_lines)
        
        comments = []
        if language in ["cpp", "java", "c"]:
            comments = [l for l in code_lines if l.startswith("//") or " //" in l or l.startswith("/*")]
        elif language == "python3":
            comments = [l for l in code_lines if l.startswith("#") or " #" in l]
            
        # Filter out commented-out code (rough heuristic: if it contains a semicolon or standard operator at the end, it might be code)
        actual_comments = []
        for c in comments:
            # If it's a C++ comment with code like `// cout << x;`
            if re.search(r'//\s*[a-zA-Z_]\w*\s*(<<|>>|=|;|\()', c): continue
            if re.search(r'#\s*[a-zA-Z_]\w*\s*(=|\()', c): continue
            actual_comments.append(c)

        comment_lines = len(actual_comments)
        
        # 1. Step-by-Step Comment Detection (The "ChatGPT Signature")
        step_pattern = re.compile(r'(//|#)\s*(\d+\.|Step\s*\d+:?)', re.IGNORECASE)
        step_comments = [c for c in actual_comments if step_pattern.search(c)]
        
        if len(step_comments) >= 2: # At least 2 steps implies a sequence
            score += 45
            reasons.append("Step-by-step algorithmic breakdown in comments")
            
        # 2. Adjusted Comment Ratio
        if total_lines > 0:
            ratio = comment_lines / total_lines
            if ratio > 0.15:
                score += 30
                reasons.append(f"High comment ratio ({int(ratio*100)}%)")
            elif ratio > 0.08:
                score += 15
                reasons.append("Contains explanatory comments")

        # 3. Suspicious Phrases
        ai_phrases = [
            "time complexity", "space complexity", "explanation:",
            "generated by", "happy coding", "hope this helps",
            "approach:", "algorithm:", "intuition:", "helper to", "function to"
        ]
        
        found_phrases = [p for p in ai_phrases if p in clean_code.lower()]
        if found_phrases:
            score += 40
            reasons.append(f"AI-like phrases found: {', '.join(found_phrases[:2])}")

        # 4. Advanced Variable Naming
        # Extract variables, ignore short ones and standard keywords
        tokens = re.findall(r'\b[a-zA-Z_]\w*\b', clean_code)
        keywords = {"int", "long", "return", "if", "else", "for", "while", "class", "public", "void", "def", "self", "import"}
        vars = [t for t in tokens if t not in keywords and len(t) > 3]
        
        long_vars = [t for t in vars if len(t) >= 14 and re.search(r'[a-z][A-Z]', t)] # CamelCase and long
        if len(set(long_vars)) >= 2:
            score += 20
            reasons.append(f"Verbose CamelCase variables ({', '.join(list(set(long_vars))[:2])})")

    # 5. Typing Replay Paste Detection
    if username and contest_slug and title_slug:
        events = fetch_typing_replay(contest_slug, title_slug, username) or []
        max_paste_len = 0
        import json
        for e in events:
            if str(e.get("eventType")) in ["7", "10"]:
                try:
                    event_data = json.loads(e.get("eventData", "{}"))
                    # New format
                    changes = event_data.get("change", {}).get("changes", [])
                    for change in changes:
                        insert_text = change.get("insert", "")
                        if "class Solution" not in insert_text and "class " not in insert_text:
                            max_paste_len = max(max_paste_len, len(insert_text))
                    
                    # Old format
                    old_changes = event_data.get("c", [])
                    if isinstance(old_changes, list):
                        for change in old_changes:
                            if "t" in change:
                                insert_text = change["t"]
                                if "class Solution" not in insert_text and "class " not in insert_text:
                                    max_paste_len = max(max_paste_len, len(insert_text))
                except Exception:
                    pass
        
        if max_paste_len > 150:
            score += 50
            reasons.append(f"Massive code copy-paste detected via replay ({max_paste_len} chars pasted at once)")

    # 6. User Profile Anomaly Detection
    if username and contest_slug:
        import rating_fetcher
        
        ranks = load_user_ranks(contest_slug)
        try:
            current_rank = int(ranks.get(username, "999999"))
        except ValueError:
            current_rank = 999999
            
        stats = rating_fetcher.get_rating(username)
        if stats:
            try:
                hist_rating = int(stats.get("rating", "0"))
                total_solved = int(stats.get("total_solved", 0))
                
                # Reduced weighting slightly
                if current_rank <= 500 and hist_rating < 1700 and total_solved < 100:
                    score += 45
                    reasons.append(f"Profile Anomaly: Top {current_rank} rank but {total_solved} solved & {hist_rating} rating")
                elif current_rank <= 1000 and hist_rating < 1600 and total_solved < 50:
                    score += 25
                    reasons.append(f"Profile Anomaly: Top {current_rank} rank but lacks experience ({total_solved} solved)")
            except Exception:
                pass

    result = {
        "score": min(score, 100),
        "reasons": reasons
    }
    
    if cache_key and cache_path:
        _ai_cache[cache_key] = result
        try:
            with open(cache_path, "w") as f: json.dump(_ai_cache, f)
        except: pass
        
    return result

def get_references_dir(contest_slug):
    output_dir, _, _, _ = get_paths(contest_slug)
    # resource/contest_report_slug/references
    return os.path.join(output_dir, "references")

def save_reference_code(contest_slug, question_id, language, code):
    ref_dir = get_references_dir(contest_slug)
    # e.g. references/Q1/cpp/_AI_REFERENCE_.cpp
    
    ext = "txt"
    if language == "java": ext = "java"
    elif language == "cpp": ext = "cpp"
    elif language == "python3": ext = "py"
    
    target_dir = os.path.join(ref_dir, question_id, language) # question_id is roughly "Q1" or "1" needs checks
    os.makedirs(target_dir, exist_ok=True)
    
    # We use a fixed username for the reference to easily identify it
    file_path = os.path.join(target_dir, f"_AI_REFERENCE_.{ext}")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(code)
        
    # Cloud sync folder
    output_dir, _, _, _ = get_paths(contest_slug)
    s3.upload_directory(output_dir)
    return True

def get_saved_references(contest_slug):
    ref_dir = get_references_dir(contest_slug)
    refs = []
    if not os.path.exists(ref_dir):
        return refs
        
    for q_folder in os.listdir(ref_dir):
        q_path = os.path.join(ref_dir, q_folder)
        if os.path.isdir(q_path):
            for lang in os.listdir(q_path):
                lang_path = os.path.join(q_path, lang)
                if os.path.isdir(lang_path):
                    for f in os.listdir(lang_path):
                        if "_AI_REFERENCE_" in f:
                            # Read code
                            with open(os.path.join(lang_path, f), "r") as code_f:
                                content = code_f.read()
                            refs.append({
                                "question_id": q_folder,
                                "language": lang,
                                "code": content
                            })
    return refs

def inject_references(contest_slug, submissions_dir):
    """
    Copies stored references into the active submissions directory so JPlag sees them.
    """
    print("[*] Injecting AI references...")
    ref_dir = get_references_dir(contest_slug)
    if not os.path.exists(ref_dir):
        return

    # Walk through references and copy to submissions_dir
    # references layout: references/Q1/cpp/_AI_REFERENCE_.cpp
    # submissions layout: submissions/Q1/cpp/username.cpp
    
    # We need to map reference Q-folders to submission Q-folders
    # Assuming user provides Q-folder correctly as "Q1", "Q2" etc via API
    
    copied_count = 0
    for root, dirs, files in os.walk(ref_dir):
        for file in files:
            if "_AI_REFERENCE_" in file:
                src_path = os.path.join(root, file)
                
                # Determine relative path from ref_dir
                rel_path = os.path.relpath(src_path, ref_dir)
                dest_path = os.path.join(submissions_dir, rel_path)
                
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                shutil.copy2(src_path, dest_path)
                copied_count += 1
                
    print(f"[*] Injected {copied_count} reference files.")

def run_jplag(contest_slug, questions_languages):
    print("[*] Running JPlag...")
    _, _, submissions_dir, jplag_results_dir = get_paths(contest_slug)
    
    for q_id, languages in questions_languages.items():
        for lang in languages:
            src_dir = os.path.join(submissions_dir, q_id, lang)
            result_dir = os.path.join(jplag_results_dir, q_id, lang)
            os.makedirs(result_dir, exist_ok=True)
            
            jplag_lang = "java17" 
            if lang == "cpp": jplag_lang = "c/c++"
            elif lang == "python3": jplag_lang = "python3"
            elif lang == "java": jplag_lang = "java17"
            
            if lang == "text": continue
            
            print(f"    Processing Q:{q_id} Lang:{lang}...")

            cmd = [
                "java", "-jar", JPLAG_JAR,
                "-l", jplag_lang,
                "-r", result_dir,
                "-s", src_dir,
                "-m", "10"
            ]
            
            subprocess.run(cmd, capture_output=True, text=True)

def parse_and_cluster(contest_slug, threshold=50.0):
    print(f"[*] Parsing results with threshold {threshold}%...")
    _, _, _, jplag_results_dir = get_paths(contest_slug)
    
    # Dictionary to hold UF for each question: { "Q1": UnionFind(), "Q2": UnionFind()... }
    question_ufs = defaultdict(UnionFind)
    
    if not os.path.exists(jplag_results_dir):
        return question_ufs
        
    for q_id in os.listdir(jplag_results_dir):
        q_path = os.path.join(jplag_results_dir, q_id)
        if not os.path.isdir(q_path): continue
        
        # Ensure we have a UF for this question even if no matches found yet
        if q_id not in question_ufs:
            question_ufs[q_id] = UnionFind()
        
        for lang in os.listdir(q_path):
            lang_path = os.path.join(q_path, lang)
            if not os.path.isdir(lang_path): continue
            
            csv_path = os.path.join(lang_path, "matches_avg.csv")
            if os.path.exists(csv_path):
                with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        try:
                            parts = line.strip().split(';')
                            if len(parts) < 4:
                                continue
                            
                            user1_file = parts[0]
                            u1_safe = user1_file.rsplit('.', 1)[0]
                            try:
                                u1 = bytes.fromhex(u1_safe).decode('utf-8')
                            except Exception:
                                u1 = u1_safe
                            
                            idx = 1
                            while idx + 2 < len(parts):
                                user2_file = parts[idx+1]
                                score_str = parts[idx+2]
                                
                                if not user2_file or not score_str:
                                    idx += 3
                                    continue
                                    
                                try:
                                    score = float(score_str)
                                    u2_safe = user2_file.rsplit('.', 1)[0]
                                    try:
                                        u2 = bytes.fromhex(u2_safe).decode('utf-8')
                                    except Exception:
                                        u2 = u2_safe
                                    
                                    if score >= threshold:
                                        # Union in the specific question's UF
                                        question_ufs[q_id].union(u1, u2)
                                except ValueError:
                                    pass
                                    
                                idx += 3
                        except Exception:
                            continue

    return question_ufs

def generate_plagiarism_report(contest_slug, question_ufs):
    print("[*] Generating Plagiarism Report...")
    output_dir, _, _, _ = get_paths(contest_slug)
    
    report_path = os.path.join(output_dir, "plagiarism_report.csv")
    with open(report_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["question", "cluster_id", "users_count", "users"])
        
        total_clusters = 0
        for q_id, uf in question_ufs.items():
            clusters = uf.get_clusters()
            for i, (root, members) in enumerate(clusters.items()):
                if len(members) > 1:
                    writer.writerow([q_id, i+1, len(members), ", ".join(members)])
                    total_clusters += 1
                
    print(f"[✓] Report saved to: {report_path}")
    print(f"    Found {total_clusters} clusters of potential plagiarism across all questions.")

def run_pipeline(contest_slug):
    if not setup_jplag():
        return False

    questions_languages = export_submissions(contest_slug)
    if questions_languages:
        # Inject references! (Assuming questions_languages structure is updated or we just copy blindly)
        # We need to explicitly make sure the pipeline knows about the languages if they were ONLY in references
        # But for now, we assume references strictly match languages present in the contest or JPlag will just skip/process them
        _, _, submissions_dir, _ = get_paths(contest_slug)
        inject_references(contest_slug, submissions_dir)
        
        run_jplag(contest_slug, questions_languages)
        
    question_ufs = parse_and_cluster(contest_slug, 50.0)
    generate_plagiarism_report(contest_slug, question_ufs)
    
    # Cloud sync folder
    output_dir, _, _, _ = get_paths(contest_slug)
    s3.upload_directory(output_dir)
    
    return True

if __name__ == "__main__":
    run_pipeline("biweekly-contest-172")
