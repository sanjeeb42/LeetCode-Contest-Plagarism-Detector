from playwright.sync_api import sync_playwright
import json

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    
    # We want to intercept graphql requests
    graphql_requests = []
    
    def handle_response(response):
        if "graphql" in response.url:
            try:
                req = response.request
                post_data = req.post_data
                if post_data and "Replay" in post_data:
                    print("--- FOUND REPLAY REQUEST ---")
                    print("Payload:", post_data)
            except Exception as e:
                pass

    page.on("response", handle_response)
    page.goto("https://leetcode.com/contest/weekly-contest-431/ranking/")
    
    # Wait for the table to load
    page.wait_for_selector("table", timeout=10000)
    
    # Find a submission link (the time/score cells have links to submissions)
    # The links are usually in the format /contest/.../submissions/detail/...
    links = page.locator("a[href*='/submissions/detail/']").all()
    if links:
        print(f"Found {len(links)} submission links. Clicking the first one...")
        links[0].click()
        page.wait_for_timeout(5000) # wait for replay to load
    else:
        print("No submission links found.")
        
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
