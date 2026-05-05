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
        response = requests.post(url, headers=headers, json=body, impersonate="chrome", timeout=5)
        if response.status_code == 200:
            data = response.json()
            d = data.get("data")
            if d:
                return d.get("userContestReplayEvents") or []
    except Exception as e:
        print(f"Error fetching typing replay for {username} (slug: {user_slug}): {e}")
    return []

def get_typing_replay_frames(contest_slug, title_slug, username):
    events = fetch_typing_replay(contest_slug, title_slug, username)
    frames = []
    code_state = ""
    
    import json
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
            
        if event_type == "7":
            if "c" in event_data:
                code_state = event_data.get("c", "")
            else:
                changes = event_data.get("change", {}).get("changes", [])
                for change in changes:
                    from_pos = change.get("from", 0)
                    to_pos = change.get("to", from_pos)
                    code_state = code_state[:from_pos] + change.get("insert", "") + code_state[to_pos:]
            frames.append({"timestamp": timestamp, "code": code_state, "event": "flush"})
            
        elif event_type == "10":
            if "c" in event_data:
                changes = event_data.get("c", [])
                for change in changes:
                    if "l" in change and "t" in change:
                        pos = change["l"]
                        text = change["t"]
                        code_state = code_state[:pos] + text + code_state[pos:]
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
            
            frames.append({"timestamp": timestamp, "code": code_state, "event": "typing"})
            
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
