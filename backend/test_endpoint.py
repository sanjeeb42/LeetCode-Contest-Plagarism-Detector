import server
import plagiarism_service as ps
slug = "weekly-contest-500"
question_id = "Q4"

output_dir, _, _, _ = ps.get_paths(slug)
import os, json
raw_path = os.path.join(output_dir, "raw_data.json")
try:
    with open(raw_path, "r") as f:
        data = json.load(f)
        q_idx = int(question_id.replace("Q", "")) - 1
        if 0 <= q_idx < len(data.get("questions", [])):
            print(data["questions"][q_idx].get("title_slug"))
except Exception as e:
    import traceback
    traceback.print_exc()
