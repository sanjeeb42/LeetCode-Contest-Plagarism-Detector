import json
from curl_cffi import requests

def fetch_events(submission_id):
    url = "https://leetcode.com/graphql/"
    query = """
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        runtime
        runtimeDisplay
        runtimePercentile
        runtimeDistribution
        memory
        memoryDisplay
        memoryPercentile
        memoryDistribution
        code
        timestamp
        statusCode
        lang {
          name
          verboseName
        }
        question {
          questionId
        }
        notes
        topicTags {
          tagId
          slug
          name
        }
        runtimeError
        compileError
        lastTestcase
        totalCorrect
        totalTestcases
        fullCodeOutput
        testDescriptions
        testBodies
        testInfo
        stdOutput
      }
    }
    """
    body = {
        "query": query,
        "variables": {
            "submissionId": submission_id
        },
        "operationName": "submissionDetails"
    }
    
    headers = {
        "Content-Type": "application/json",
    }
    
    response = requests.post(url, headers=headers, json=body, impersonate="chrome", timeout=5)
    return response.text

print(fetch_events(1501309832))
