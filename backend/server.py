from flask import Flask, jsonify, request
from flask_cors import CORS
import threading
import json
import os
import contest_fetcher as data_collector
import plagiarism_service as plagiarism_detector

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global state for task tracking
# task_status = { "contest_slug": { "fetch": {...}, "analyze": {...} } }
task_status = {}

CONTESTS_FILE = "contests.json"

def load_contests():
    if not os.path.exists(CONTESTS_FILE):
        return [
           { "name": "Biweekly Contest 172", "slug": "biweekly-contest-172", "color": "sky" },
           { "name": "Weekly Contest 480", "slug": "weekly-contest-480", "color": "violet" },
           { "name": "Weekly Contest 481", "slug": "weekly-contest-481", "color": "emerald" },
           { "name": "Biweekly Contest 173", "slug": "biweekly-contest-173", "color": "rose" },
        ]
    try:
        with open(CONTESTS_FILE, "r") as f:
            return json.load(f)
    except:
        return []

def save_contests(contests):
    with open(CONTESTS_FILE, "w") as f:
        json.dump(contests, f, indent=4)

def init_task_status(slug):
    if slug not in task_status:
        task_status[slug] = {
            "fetch": {"status": "idle", "message": "", "progress": 0},
            "analyze": {"status": "idle", "message": "", "progress": 0}
        }

def run_fetch_task(slug, limit=10):
    global task_status
    # Status is already set to running by the triggering endpoint
    try:
        def update_progress(p):
            task_status[slug]["fetch"]["progress"] = p
            
        success = data_collector.run_data_collection(slug, progress_callback=update_progress, page_limit=limit)
        if success:
            task_status[slug]["fetch"] = {"status": "success", "message": "Data collection complete.", "progress": 100}
        else:
            task_status[slug]["fetch"] = {"status": "error", "message": "Data collection failed."}
    except Exception as e:
        task_status[slug]["fetch"] = {"status": "error", "message": str(e)}

def run_analyze_task(slug):
    global task_status
    try:
        success = plagiarism_detector.run_pipeline(slug)
        if success:
            task_status[slug]["analyze"] = {"status": "success", "message": "Analysis complete."}
        else:
            task_status[slug]["analyze"] = {"status": "error", "message": "Analysis failed."}
    except Exception as e:
        task_status[slug]["analyze"] = {"status": "error", "message": str(e)}

@app.route('/api/contests', methods=['GET'])
def get_contests_route():
    return jsonify(load_contests())

@app.route('/api/contests', methods=['POST'])
def save_contests_route():
    contests = request.json
    save_contests(contests)
    return jsonify({"message": "Saved"})

@app.route('/api/fetch', methods=['POST'])
def trigger_fetch():
    data = request.json
    slug = data.get("contest_slug")
    if not slug:
        return jsonify({"error": "Missing contest_slug"}), 400

    init_task_status(slug)
        
    if task_status[slug]["fetch"]["status"] == "running":
        return jsonify({"error": "Fetch already in progress"}), 409
    
    # Synchronous update to avoid race condition
    task_status[slug]["fetch"] = {"status": "running", "message": "Starting fetch...", "progress": 0}

    limit = int(data.get("limit", 10))
    thread = threading.Thread(target=run_fetch_task, args=(slug, limit))
    thread.start()
    return jsonify({"message": f"Fetch started for {slug}"}), 202

@app.route('/api/analyze', methods=['POST'])
def trigger_analyze():
    data = request.json
    slug = data.get("contest_slug")
    if not slug:
        return jsonify({"error": "Missing contest_slug"}), 400

    init_task_status(slug)

    if task_status[slug]["analyze"]["status"] == "running":
        return jsonify({"error": "Analysis already in progress"}), 409

    # Synchronous update
    task_status[slug]["analyze"] = {"status": "running", "message": "Starting analysis..."}
        
    thread = threading.Thread(target=run_analyze_task, args=(slug,))
    thread.start()
    return jsonify({"message": f"Analysis started for {slug}"}), 202

@app.route('/api/status', methods=['GET'])
def get_status():
    slug = request.args.get('contest_slug')
    if not slug or slug not in task_status:
        # Return default idle structure if slug not found/provided for safety
        return jsonify({
            "fetch": {"status": "idle", "message": ""},
            "analyze": {"status": "idle", "message": ""}
        })
    return jsonify(task_status[slug])

@app.route('/api/results', methods=['GET'])
def get_results():
    slug = request.args.get('contest_slug')
    if not slug:
        return jsonify({"error": "Missing contest_slug"}), 400

    try:
        threshold = float(request.args.get('threshold', 50.0))
        # Now returns a dict: { "Q1": UnionFind, "Q2": UnionFind... }
        question_ufs = plagiarism_detector.parse_and_cluster(slug, threshold)
        user_ranks = plagiarism_detector.load_user_ranks(slug)
        user_slugs = plagiarism_detector.load_user_slugs(slug)
        
        # Structure: { "Q1": [ {size, members: []} ], "Q2": ... }
        results_by_question = {}
        
        # Sort questions (Q1, Q2, Q3, Q4...)
        sorted_qs = sorted(question_ufs.keys())
        
        for q_id in sorted_qs:
            uf = question_ufs[q_id]
            clusters = uf.get_clusters()
            
            q_results = []
            sorted_clusters = sorted(clusters.items(), key=lambda x: len(x[1]), reverse=True)
            
            for _, members in sorted_clusters:
                if len(members) > 1:
                    member_details = []
                    for member in members:
                        rank = user_ranks.get(member, "N/A")
                        uslug = user_slugs.get(member, member)
                        member_details.append({"username": member, "rank": rank, "slug": uslug})
                    
                    # Sort members by rank
                    def rank_key(m):
                        try: return int(m["rank"])
                        except: return 999999
                    member_details.sort(key=rank_key)

                    q_results.append({
                        "size": len(members),
                        "members": member_details
                    })
            
            if q_results:
                results_by_question[q_id] = q_results
                
        return jsonify(results_by_question)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/submission_code', methods=['POST'])
def get_submission_code():
    data = request.json
    slug = data.get("contest_slug")
    question_id = data.get("question_id")
    username = data.get("username")
    
    if not all([slug, question_id, username]):
        return jsonify({"error": "Missing required fields"}), 400
        
    code = plagiarism_detector.get_submission_code(slug, question_id, username)
    if code:
        # Detect language (simple guess or pass based on file ext logic if we had it)
        # For now, simplistic detection based on content
        lang = "text"
        if "def " in code: lang = "python3"
        elif "public class" in code: lang = "java"
        elif "#include" in code: lang = "cpp"
        
        analysis = plagiarism_detector.analyze_ai_likelihood(code, lang)
        return jsonify({
            "code": code,
            "ai_analysis": analysis
        })
    else:
        return jsonify({"error": "Code not found"}), 404

@app.route('/api/reference', methods=['GET', 'POST'])
def manage_references():
    if request.method == 'GET':
        slug = request.args.get("contest_slug")
        if not slug: return jsonify({"error": "Missing slug"}), 400
        refs = plagiarism_detector.get_saved_references(slug)
        return jsonify(refs)
        
    if request.method == 'POST':
        data = request.json
        slug = data.get("contest_slug")
        q_id = data.get("question_id") # Expected "Q1", "Q2"
        lang = data.get("language")
        code = data.get("code")
        
        if not all([slug, q_id, lang, code]):
            return jsonify({"error": "Missing fields"}), 400
            
        success = plagiarism_detector.save_reference_code(slug, q_id, lang, code)
        return jsonify({"success": success})

@app.route('/api/export', methods=['GET'])
def export_results():
    slug = request.args.get('contest_slug')
    if not slug:
        return jsonify({"error": "Missing contest_slug"}), 400

    try:
        threshold = float(request.args.get('threshold', 50.0))
        question_ufs = plagiarism_detector.parse_and_cluster(slug, threshold)
        user_ranks = plagiarism_detector.load_user_ranks(slug)
        user_subs = plagiarism_detector.load_user_submission_ids(slug)
        
        # Prepare CSV data
        import io
        import csv
        from flask import Response

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Question", "Cluster ID", "Size", "Members (User [Rank])", "Members (User [Submission ID])"])

        sorted_qs = sorted(question_ufs.keys())

        for q_id in sorted_qs:
            uf = question_ufs[q_id]
            clusters = uf.get_clusters()
            sorted_clusters = sorted(clusters.items(), key=lambda x: len(x[1]), reverse=True)
            
            local_cluster_id = 1
            for _, members in sorted_clusters:
                if len(members) > 1:
                    member_details_rank = []
                    member_details_sub = []
                    
                    for member in members:
                        rank = user_ranks.get(member, "N/A")
                        member_details_rank.append(f"{member} [{rank}]")
                        
                        sub_id = user_subs.get(member, {}).get(q_id, "N/A")
                        member_details_sub.append(f"{member} [{sub_id}]")
                    
                    writer.writerow([q_id, local_cluster_id, len(members), ", ".join(member_details_rank), ", ".join(member_details_sub)])
                    local_cluster_id += 1
        
        return Response(output.getvalue(), mimetype="text/csv", headers={"Content-disposition": f"attachment; filename=plagiarism_report_{slug}_{threshold}.csv"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5050))
    app.run(host='0.0.0.0', port=port, debug=False)
