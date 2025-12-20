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
    
    uf = UnionFind()
    user_questions = defaultdict(set)
    
    if not os.path.exists(jplag_results_dir):
        return uf, user_questions
        
    for q_id in os.listdir(jplag_results_dir):
        q_path = os.path.join(jplag_results_dir, q_id)
        if not os.path.isdir(q_path): continue
        
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
                                        uf.union(u1, u2)
                                        user_questions[u1].add(q_id)
                                        user_questions[u2].add(q_id)
                                except ValueError:
                                    pass
                                    
                                idx += 3
                        except Exception:
                            continue

    return uf, user_questions

def generate_plagiarism_report(contest_slug, uf, user_questions):
    print("[*] Generating Plagiarism Report...")
    output_dir, _, _, _ = get_paths(contest_slug)
    
    clusters = uf.get_clusters()
    
    report_path = os.path.join(output_dir, "plagiarism_report.csv")
    with open(report_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["cluster_id", "users_count", "questions", "users"])
        
        for i, (root, members) in enumerate(clusters.items()):
            if len(members) > 1:
                involved_qs = set()
                for member in members:
                    involved_qs.update(user_questions[member])
                
                questions_str = ", ".join(sorted(involved_qs))
                writer.writerow([i+1, len(members), questions_str, ", ".join(members)])
                
    print(f"[✓] Report saved to: {report_path}")
    print(f"    Found {len([c for c in clusters.values() if len(c)>1])} clusters of potential plagiarism.")

def run_pipeline(contest_slug):
    if not setup_jplag():
        return False

    questions_languages = export_submissions(contest_slug)
    if questions_languages:
        run_jplag(contest_slug, questions_languages)
        
    uf, user_questions = parse_and_cluster(contest_slug, 50.0)
    generate_plagiarism_report(contest_slug, uf, user_questions)
    return True

if __name__ == "__main__":
    run_pipeline("biweekly-contest-172")
