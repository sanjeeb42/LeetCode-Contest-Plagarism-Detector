from playwright.sync_api import sync_playwright
import json

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    
    def handle_request(route):
        request = route.request
        if "graphql" in request.url:
            post_data = request.post_data
            if post_data and "userContestReplayEvents" in post_data:
                print("--- FOUND REPLAY REQUEST ---")
                print(post_data)
        route.continue_()

    page.route("**/*", handle_request)
    
    print("Navigating to replay URL...")
    # Go directly to a submission detail page that plays a replay!
    # Wait, the replay URL is /contest/weekly-contest-431/submissions/detail/1501309832/
    # But wait, without login, it might redirect to login. The user said it is accessible without login.
    page.goto("https://leetcode.com/contest/weekly-contest-431/submissions/detail/1501309832/", wait_until="networkidle")
    print("Page loaded. URL:", page.url)
    
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
