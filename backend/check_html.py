from curl_cffi import requests

response = requests.get("https://leetcode.com/contest/weekly-contest-431/submissions/detail/1501309832/", impersonate="chrome")
with open("test_html.txt", "w") as f:
    f.write(response.text)
print(len(response.text))
