from playwright.sync_api import sync_playwright
import json

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    
    def handle_request(route):
        request = route.request
        if "graphql" in request.url:
            print("GraphQL Request:", request.post_data[:200])
        route.continue_()

    page.route("**/*", handle_request)
    
    page.goto("https://leetcode.com/contest/weekly-contest-431/submissions/detail/1501309832/", wait_until="networkidle")
    
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
