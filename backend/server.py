from flask import Flask, jsonify, request, send_file
import rating_fetcher
import io
from flask_cors import CORS
import threading
import json
import os
import contest_fetcher as data_collector
import plagiarism_service as plagiarism_detector
import s3_storage_service as s3

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global state for task tracking
# task_status = { "contest_slug": { "fetch": {...}, "analyze": {...} } }
task_status = {}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONTESTS_FILE = os.path.join(BASE_DIR, "contests.json")

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
    
    # Cloud sync
    s3.upload_file(CONTESTS_FILE)

def init_task_status(slug):
    if slug not in task_status:
        task_status[slug] = {
            "fetch": {"status": "idle", "message": "", "progress": 0},
            "analyze": {"status": "idle", "message": "", "progress": 0},
            "top500_scan": {"status": "idle", "message": "", "progress": 0},
            "keyword_scan": {"status": "idle", "message": "", "progress": 0}
        }
    else:
        if "top500_scan" not in task_status[slug]:
            task_status[slug]["top500_scan"] = {"status": "idle", "message": "", "progress": 0}
        if "keyword_scan" not in task_status[slug]:
            task_status[slug]["keyword_scan"] = {"status": "idle", "message": "", "progress": 0}

def run_keyword_scan_task(slug, keywords=None, limit=500, questions=None):
    global task_status
    try:
        def update_progress(p):
            task_status[slug]["keyword_scan"]["progress"] = p

        result = plagiarism_detector.run_keyword_replay_scan(slug, keywords=keywords, limit=limit, questions_to_scan=questions, progress_callback=update_progress)
        if "error" in result:
            task_status[slug]["keyword_scan"] = {"status": "error", "message": result["error"]}
        else:
            task_status[slug]["keyword_scan"] = {
                "status": "success",
                "message": f"Keyword scan complete. {result.get('total_flagged', 0)} cheaters flagged.",
                "progress": 100
            }
    except Exception as e:
        task_status[slug]["keyword_scan"] = {"status": "error", "message": str(e)}

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

def run_top500_scan_task(slug, limit=500, start_rank=1, questions_to_scan=None):
    global task_status
    try:
        def update_progress(p):
            task_status[slug]["top500_scan"]["progress"] = p

        result = plagiarism_detector.run_top500_scan(slug, n=limit, start_rank=start_rank, progress_callback=update_progress, questions_to_scan=questions_to_scan)
        if "error" in result:
            task_status[slug]["top500_scan"] = {"status": "error", "message": result["error"]}
        else:
            task_status[slug]["top500_scan"] = {
                "status": "success",
                "message": f"Scan complete. {result.get('total_flagged', 0)} suspects flagged.",
                "progress": 100
            }
    except Exception as e:
        task_status[slug]["top500_scan"] = {"status": "error", "message": str(e)}

@app.route('/api/contests', methods=['GET'])
def get_contests_route():
    return jsonify(load_contests())

@app.route('/api/contests', methods=['POST'])
def save_contests_route():
    contests = request.json
    save_contests(contests)
    return jsonify({"message": "Saved"})

@app.route('/api/contest', methods=['DELETE'])
def delete_contest():
    slug = request.args.get('contest_slug')
    if not slug:
        return jsonify({"error": "Missing contest_slug"}), 400

    try:
        import shutil
        output_dir = os.path.join("resources", f"contest_report_{slug}")
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)

        contests = load_contests()
        filtered_contests = [c for c in contests if c.get("slug") != slug]
        save_contests(filtered_contests)
        
        if slug in task_status:
            del task_status[slug]

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
                        member_info = {"username": member, "rank": rank, "slug": uslug}
                        
                        if q_id in ["Q3", "Q4"]:
                            code = plagiarism_detector.get_submission_code(slug, q_id, member)
                            if code:
                                lang = "text"
                                if "def " in code: lang = "python3"
                                elif "public class" in code: lang = "java"
                                elif "#include" in code: lang = "cpp"
                                title_slug = plagiarism_detector.get_title_slug(slug, q_id)
                                ai_analysis = plagiarism_detector.analyze_ai_likelihood(code, lang, member, slug, title_slug)
                                member_info["ai_score"] = ai_analysis["score"]
                                member_info["is_ai_generated"] = ai_analysis["score"] >= 60
                                member_info["ai_reasons"] = ai_analysis["reasons"]
                        
                        member_details.append(member_info)
                    
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

@app.route('/api/override_ai', methods=['POST'])
def override_ai():
    data = request.json
    contest_slug = data.get('contest_slug')
    username = data.get('username')
    is_ai = data.get('is_ai')

    if not all([contest_slug, username]) or 'is_ai' not in data:
        return jsonify({"error": "Missing required fields"}), 400

    try:
        plagiarism_detector.set_manual_override(contest_slug, username, is_ai)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/manual_overrides', methods=['GET'])
def get_manual_overrides():
    slug = request.args.get('contest_slug')
    if not slug:
        return jsonify({"error": "Missing contest_slug"}), 400
    
    overrides = plagiarism_detector.get_manual_overrides(slug)
    return jsonify(overrides)

@app.route('/api/export_ai_cheaters', methods=['GET'])
def export_ai_cheaters():
    slug = request.args.get('contest_slug')
    if not slug:
        return jsonify({"error": "Missing contest_slug"}), 400
        
    try:
        overrides = plagiarism_detector.get_manual_overrides(slug)
        top500 = plagiarism_detector.load_top500_results(slug)
        
        import io
        import csv
        from flask import Response
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Username", "User Slug", "Rank", "AI Score", "Flagged As AI"])
        
        if top500 and "suspects" in top500:
            exported = set()
            for s in top500["suspects"]:
                username = s["username"]
                user_slug = s.get("user_slug", username)
                if overrides.get(user_slug) is True or overrides.get(username) is True:
                    writer.writerow([username, user_slug, s.get("rank", ""), s.get("total_ai_score", ""), "Yes"])
                    exported.add(user_slug)
                    exported.add(username)
            
            # Export any others in manual_overrides not in top500
            for uid, is_ai in overrides.items():
                if is_ai and uid not in exported:
                    writer.writerow(["", uid, "", "", "Yes"])
        else:
            for uid, is_ai in overrides.items():
                if is_ai:
                    writer.writerow(["", uid, "", "", "Yes"])
                    
        return Response(output.getvalue(), mimetype="text/csv", headers={"Content-disposition": f"attachment; filename=ai_cheaters_{slug}.csv"})
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
        
        analysis = plagiarism_detector.analyze_ai_likelihood(code, lang, username, slug)
        return jsonify({
            "code": code,
            "ai_analysis": analysis
        })
    else:
        return jsonify({"error": "Code not found"}), 404

@app.route('/api/typing_replay', methods=['POST'])
def typing_replay():
    data = request.json
    slug = data.get("contest_slug")
    question_id = data.get("question_id")
    username = data.get("username")
    user_slug = data.get("user_slug")
    
    if not all([slug, question_id, username]):
        return jsonify({"error": "Missing required fields"}), 400
        
    title_slug = plagiarism_detector.get_title_slug(slug, question_id)
    if not title_slug:
        return jsonify({"error": "Could not determine title slug"}), 404
        
    frames = plagiarism_detector.get_typing_replay_frames(slug, title_slug, username)
    
    # Resolve username to user_slug if user_slug is not provided
    if not user_slug:
        try:
            slugs_map = plagiarism_detector.load_user_slugs(slug)
            user_slug = slugs_map.get(username, username)
        except Exception:
            user_slug = username
            
    # Fetch stats from cache only (avoid runtime network requests)
    rating = None
    attended = 0
    try:
        stats = rating_fetcher.get_rating(user_slug, cache_only=True)
        if stats:
            if "rating" in stats:
                rating = stats["rating"]
            if "attended" in stats:
                attended = stats["attended"]
    except Exception as e:
        print(f"Error fetching stats for {user_slug} from cache: {e}")
        
    return jsonify({
        "frames": frames,
        "rating": rating,
        "attended": attended
    })

@app.route('/api/top500_scan', methods=['POST'])
def trigger_top500_scan():
    data = request.json
    slug = data.get("contest_slug")
    if not slug:
        return jsonify({"error": "Missing contest_slug"}), 400

    init_task_status(slug)

    if task_status[slug]["top500_scan"]["status"] == "running":
        return jsonify({"error": "Top 500 scan already in progress"}), 409

    task_status[slug]["top500_scan"] = {"status": "running", "message": "Starting scan...", "progress": 0}

    limit = int(data.get("limit", 500))
    start_rank = int(data.get("start_rank", 1))
    questions_to_scan = data.get("questions", ["Q3", "Q4"])
    thread = threading.Thread(target=run_top500_scan_task, kwargs={"slug": slug, "limit": limit, "start_rank": start_rank, "questions_to_scan": questions_to_scan})
    thread.start()
    return jsonify({"message": f"Top 500 AI scan started for {slug}"}), 202

@app.route('/api/top500_results', methods=['GET'])
def get_top500_results():
    slug = request.args.get('contest_slug')
    if not slug:
        return jsonify({"error": "Missing contest_slug"}), 400

    results = plagiarism_detector.load_top500_results(slug)
    if results:
        return jsonify(results)
    else:
        return jsonify({"error": "No scan results found. Run the Top 500 scan first."}), 404

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

@app.route('/api/generate_report', methods=['POST'])
def generate_report():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file:
        input_bytes = file.read()
        

        # Process entirely in memory (Don't save anywhere)
        try:
            output_bytes = rating_fetcher.process_csv_in_memory(input_bytes)
            
            return send_file(
                io.BytesIO(output_bytes),
                mimetype='text/csv',
                as_attachment=True,
                download_name=f"output_{file.filename}"
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

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
        writer.writerow(["Question", "Cluster ID", "Size", "Members (User [Rank])", "Members (User [Submission ID])", "Members (AI Score)"])

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
                    member_details_ai = []
                    
                    for member in members:
                        rank = user_ranks.get(member, "N/A")
                        member_details_rank.append(f"{member} [{rank}]")
                        
                        sub_id = user_subs.get(member, {}).get(q_id, "N/A")
                        member_details_sub.append(f"{member} [{sub_id}]")
                        
                        if q_id in ["Q3", "Q4"]:
                            code = plagiarism_detector.get_submission_code(slug, q_id, member)
                            if code:
                                lang = "text"
                                if "def " in code: lang = "python3"
                                elif "public class" in code: lang = "java"
                                elif "#include" in code: lang = "cpp"
                                ai_analysis = plagiarism_detector.analyze_ai_likelihood(code, lang, member, slug)
                                member_details_ai.append(f"{member} [AI: {ai_analysis['score']}]")
                            else:
                                member_details_ai.append(f"{member} [AI: N/A]")
                        else:
                            member_details_ai.append(f"{member} [N/A]")
                    
                    writer.writerow([q_id, local_cluster_id, len(members), ", ".join(member_details_rank), ", ".join(member_details_sub), ", ".join(member_details_ai)])
                    local_cluster_id += 1
        
        return Response(output.getvalue(), mimetype="text/csv", headers={"Content-disposition": f"attachment; filename=plagiarism_report_{slug}_{threshold}.csv"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/contest_keywords', methods=['GET', 'POST'])
def manage_contest_keywords():
    if request.method == 'GET':
        slug = request.args.get('contest_slug')
        if not slug: return jsonify({"error": "Missing contest_slug"}), 400
        keywords = plagiarism_detector.get_contest_keywords(slug)
        return jsonify({"keywords": keywords})

    if request.method == 'POST':
        data = request.json
        slug = data.get('contest_slug')
        keywords = data.get('keywords', [])
        if not slug: return jsonify({"error": "Missing contest_slug"}), 400
        saved = plagiarism_detector.save_contest_keywords(slug, keywords)
        return jsonify({"keywords": saved})

@app.route('/api/keyword_scan', methods=['POST'])
def trigger_keyword_scan():
    data = request.json
    slug = data.get("contest_slug")
    if not slug:
        return jsonify({"error": "Missing contest_slug"}), 400

    init_task_status(slug)

    if task_status[slug]["keyword_scan"]["status"] == "running":
        return jsonify({"error": "Keyword scan already in progress"}), 409

    task_status[slug]["keyword_scan"] = {"status": "running", "message": "Starting keyword scan...", "progress": 0}

    keywords = data.get("keywords")
    limit = int(data.get("limit", 500))
    questions = data.get("questions", ["Q1", "Q2", "Q3", "Q4"])

    thread = threading.Thread(target=run_keyword_scan_task, args=(slug, keywords, limit, questions))
    thread.start()
    return jsonify({"message": f"Keyword scan started for {slug}"}), 202

@app.route('/api/keyword_results', methods=['GET'])
def get_keyword_results():
    slug = request.args.get('contest_slug')
    if not slug:
        return jsonify({"error": "Missing contest_slug"}), 400

    results = plagiarism_detector.load_keyword_results(slug)
    if results:
        return jsonify(results)
    else:
        return jsonify({"error": "No keyword scan results found. Please configure keywords and run scan first."}), 404

@app.route('/api/export_keyword_cheaters', methods=['GET'])
def export_keyword_cheaters():
    slug = request.args.get('contest_slug')
    if not slug:
        return jsonify({"error": "Missing contest_slug"}), 400

    try:
        results = plagiarism_detector.load_keyword_results(slug)
        if not results or "suspects" not in results:
            return jsonify({"error": "No keyword cheaters found to export."}), 404

        import io
        import csv
        from flask import Response

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Username", "User Slug", "Rank", "Rating", "Matched Keywords", "Reasons"])

        for s in results["suspects"]:
            kws = ", ".join(s.get("matched_keywords", []))
            reasons = "; ".join(s.get("reasons", []))
            writer.writerow([
                s.get("username", ""),
                s.get("user_slug", ""),
                s.get("rank", ""),
                s.get("rating", ""),
                kws,
                reasons
            ])

        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-disposition": f"attachment; filename=keyword_cheaters_{slug}.csv"}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Initial Cloud Sync in background so it doesn't block Render port binding
    threading.Thread(target=s3.download_all, daemon=True).start()
    
    port = int(os.environ.get('PORT', 5050))
    # Starting Flask server
    app.run(host='0.0.0.0', port=port, debug=False)
