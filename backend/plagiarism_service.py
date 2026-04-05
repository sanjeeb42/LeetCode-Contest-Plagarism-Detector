import os
import csv
import subprocess
import requests
import shutil
import re
from collections import defaultdict

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
                    
                    file_path = os.path.join(q_dir, f"{username}.{ext}")
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
        
        for ext in possible_exts:
            file_path = os.path.join(lang_dir, f"{username}.{ext}")
            if os.path.exists(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        return f.read()
                except Exception as e:
                    print(f"Error reading file {file_path}: {e}")
                    return None
    return None

def analyze_ai_likelihood(code, language="text"):
    """
    Returns a dict with score (0-100) and reasons.
    """
    score = 0
    reasons = []
    
    # 1. Comment Analysis (AI explains, humans speed-code)
    # Removing headers/imports to focus on logic
    code_lines = code.split('\n')
    comment_lines = 0
    total_lines = len(code_lines)
    
    comments = []
    if language in ["cpp", "java", "c"]:
        comments = [l for l in code_lines if "//" in l or "/*" in l]
    elif language == "python3":
        comments = [l for l in code_lines if "#" in l]
        
    comment_lines = len(comments)
    
    if total_lines > 0:
        ratio = comment_lines / total_lines
        if ratio > 0.1: # >10% comments is very suspicious for contest
            score += 40
            reasons.append(f"High comment ratio ({int(ratio*100)}%)")
        elif ratio > 0.05:
            score += 20
            reasons.append("Contains explanatory comments")

    # 2. Suspicious Phrases
    ai_phrases = [
        "time complexity", "space complexity", "explanation:",
        "generated by", "happy coding", "hope this helps",
        "approach:", "algorithm:", "intuition:"
    ]
    
    found_phrases = [p for p in ai_phrases if p in code.lower()]
    if found_phrases:
        score += 50
        reasons.append(f"AI-like phrases found: {', '.join(found_phrases[:2])}")

    # 3. Code Style (Very dependent on language, keeping simple)
    # AI tends to use very descriptive variable names like 'current_index' vs 'i'
    # Simple check for average token length (proxy)
    import re
    tokens = re.findall(r'\b[a-zA-Z_]\w*\b', code)
    # Filter keywords roughly
    if tokens:
        avg_len = sum(len(t) for t in tokens) / len(tokens)
        if avg_len > 7: # Threshold for "descriptive" naming
            score += 15
            reasons.append("Verbose variable naming")

    return {
        "score": min(score, 100),
        "reasons": reasons
    }

    return {
        "score": min(score, 100),
        "reasons": reasons
    }

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
                            u1 = user1_file.rsplit('.', 1)[0]
                            
                            idx = 1
                            while idx + 2 < len(parts):
                                user2_file = parts[idx+1]
                                score_str = parts[idx+2]
                                
                                if not user2_file or not score_str:
                                    idx += 3
                                    continue
                                    
                                try:
                                    score = float(score_str)
                                    u2 = user2_file.rsplit('.', 1)[0]
                                    
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
    return True

if __name__ == "__main__":
    run_pipeline("biweekly-contest-172")
