import os
import time
import csv
import json
import warnings
from curl_cffi import requests

# 1. Setup & Silence Warnings
warnings.filterwarnings("ignore")

# --- CONFIGURATION ---
CONTEST_SLUG = "weekly-contest-480"
LIMIT_USERS = 100
OUTPUT_DIR = f"contest_report_{CONTEST_SLUG}"
RAW_JSON_FILE = os.path.join(OUTPUT_DIR, "raw_data.json")
REPORT_FILE = os.path.join(OUTPUT_DIR, "submission_matrix.csv")

# Create Workspace
os.makedirs(OUTPUT_DIR, exist_ok=True)

def fetch_contest_data():
    """Fetches the parallel array structure from LeetCode."""
    url = f"https://leetcode.com/contest/api/ranking/{CONTEST_SLUG}/?pagination=1&region=global"
    print(f"[*] Fetching live data for {CONTEST_SLUG}...")

    try:
        # impersonate="chrome" handles the TLS fingerprinting to bypass 403
        resp = requests.get(url, impersonate="chrome", timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            with open(RAW_JSON_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4)
            return data
        else:
            print(f"!! Failed with status: {resp.status_code}")
    except Exception as e:
        print(f"!! Network Error: {e}")
    return None

def generate_report(data):
    """Maps parallel 'total_rank' and 'submissions' arrays to a CSV."""
    print("[*] Generating CSV Report...")

    total_rank = data.get("total_rank", [])
    submissions_list = data.get("submissions", [])
    questions_list = data.get("questions", [])

    # Identify and sort Question IDs (3566, 3502, 3607, 3603)
    # Sorting by the internal 'id' ensures Q1-Q4 order
    sorted_questions = sorted(questions_list, key=lambda x: x['id'])
    q_ids = [str(q['question_id']) for q in sorted_questions]

    with open(REPORT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        # Build Header
        header = ["user", "rank", "question1_id", "question2_id", "question3_id", "question4_id"]
        writer.writerow(header)

        # ZIP the parallel lists: index i in rank matches index i in submissions
        for rank_entry, sub_entry in zip(total_rank, submissions_list):
            username = rank_entry.get("username")
            rank = rank_entry.get("rank")

            row = [username, rank]

            # Map Submission IDs to the correct columns
            for q_id in q_ids:
                q_data = sub_entry.get(q_id, {})
                sub_id = q_data.get("submission_id", "")
                row.append(sub_id)

            writer.writerow(row)

    print(f"[✓] Success! Report saved to: {REPORT_FILE}")

def main():
    # Step 1: Get Data
    data = fetch_contest_data()

    # Step 2: Generate Report
    if data:
        generate_report(data)
    else:
        print("!! Pipeline failed at data collection stage.")

if __name__ == "__main__":
    main()